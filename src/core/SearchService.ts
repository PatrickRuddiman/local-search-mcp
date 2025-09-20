import { FileProcessor } from './FileProcessor.js';
import { TextChunker, ChunkingConfig } from './TextChunker.js';
import { EmbeddingService, EmbeddingConfig } from './EmbeddingService.js';
import { VectorIndex } from './VectorIndex.js';
import {
  DocumentChunk,
  IndexingResult,
  SearchResult,
  SearchOptions,
  IndexOptions,
  ConcurrencyConfig,
  FileProcessingError,
  EmbeddingError,
  StorageError
} from '../types/index.js';
import path from 'path';
import { promises as fs, Stats } from 'fs';
import pLimit from 'p-limit';
import os from 'os';

export interface SearchServiceConfig {
  textChunkerConfig?: ChunkingConfig;
  embeddingConfig?: EmbeddingConfig;
  defaultIndexPath?: string;
}

export class SearchService {
  private fileProcessor: FileProcessor;
  private textChunker: TextChunker;
  private embeddingService: EmbeddingService;
  private vectorIndex: VectorIndex;
  private config: Required<SearchServiceConfig>;

  constructor(config: SearchServiceConfig = {}) {
    this.config = {
      textChunkerConfig: {},
      embeddingConfig: {},
      defaultIndexPath: './local-search-index.db',
      ...config
    };

    this.fileProcessor = new FileProcessor();
    this.textChunker = new TextChunker(this.config.textChunkerConfig);
    this.embeddingService = new EmbeddingService(this.config.embeddingConfig);
    this.vectorIndex = new VectorIndex(this.config.defaultIndexPath);
  }

  /**
   * Index files from a directory with parallel processing
   * @param folderPath Absolute path to folder
   * @param options Indexing configuration
   * @param concurrencyConfig Optional concurrency control
   * @returns Indexing results
   */
  async indexFiles(
    folderPath: string,
    options: IndexOptions = {},
    concurrencyConfig: ConcurrencyConfig = {}
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processedFiles = 0;
    let totalChunks = 0;
    let totalTokens = 0;

    try {
      // Validate and normalize path
      const normalizedPath = FileProcessor.normalizePath(folderPath);

      // Get all files in directory (recursive)
      const files = await this.getAllFilesParallel(normalizedPath, concurrencyConfig);

      // Filter supported files
      const supportedFiles = files.filter((file: string) =>
        this.fileProcessor.isFileSupported(file) && this.shouldIncludeFile(file, options)
      );

      if (supportedFiles.length === 0) {
        console.log('No supported files found to process');
        return {
          totalFiles: files.length,
          processedFiles: 0,
          totalChunks: 0,
          totalTokens: 0,
          processingTime: Date.now() - startTime,
          errors: ['No supported files found']
        };
      }

      console.log(`Starting parallel processing of ${supportedFiles.length} files...`);

      // Configure concurrency limiter - default to CPU count
      const maxConcurrency = concurrencyConfig.maxFileProcessingConcurrency || os.cpus().length;
      const fileLimit = pLimit(maxConcurrency);

      console.log(`Using concurrency limit of ${maxConcurrency} for file processing`);

      // Create async tasks for each file
      const fileTasks = supportedFiles.map((file: string, index: number) => {
        return fileLimit(async () => {
          try {
            await this.processFile(file, options);
            console.log(`[${index + 1}/${supportedFiles.length}] Processed: ${path.relative(normalizedPath, file)}`);
            return { success: true, file };
          } catch (fileError) {
            const errorMsg = `Failed to process ${file}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.warn(errorMsg);
            return { success: false, file, error: fileError };
          }
        });
      });

      // Execute all tasks in parallel with concurrency control
      const results = await Promise.all(fileTasks);

      // Count successful processes
      processedFiles = results.filter((result) => result.success).length;

      console.log(`Parallel processing complete: ${processedFiles}/${supportedFiles.length} files processed`);

      // Calculate totals
      const stats = await this.vectorIndex.getStatistics();
      totalChunks = stats.totalChunks;
      totalTokens = stats.totalTokens;

      const processingTime = Date.now() - startTime;

      const result: IndexingResult = {
        totalFiles: files.length,
        processedFiles,
        totalChunks,
        totalTokens,
        processingTime,
        errors
      };

      console.log(`Indexing completed in ${processingTime}ms - ${totalChunks} chunks, ${totalTokens} tokens`);
      return result;

    } catch (error) {
      const errorMessage = `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      console.error('Indexing error:', error);

      return {
        totalFiles: 0,
        processedFiles: 0,
        totalChunks: 0,
        totalTokens: 0,
        processingTime: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Process a single file: extract text, chunk it, embed it, store it
   * @param filePath Absolute file path
   * @param options Processing options
   */
  private async processFile(filePath: string, options: IndexOptions = {}): Promise<void> {
    try {
      // Extract text from file
      const text = await this.fileProcessor.extractText(filePath);

      if (text.trim().length === 0) {
        throw new FileProcessingError(`File ${filePath} is empty or contains no processable content`);
      }

      // Chunk the text
      const chunks = this.textChunker.chunkText(text, filePath, {
        chunkSize: options.chunkSize || 1000,
        overlap: options.overlap || 200,
        method: 'fixed'
      });

      if (chunks.length === 0) {
        throw new FileProcessingError(`No chunks created for file ${filePath}`);
      }

      // Generate embeddings for chunks
      const embeddedChunks = await this.embeddingService.generateEmbeddings(chunks);

      if (embeddedChunks.length === 0) {
        throw new EmbeddingError(`Failed to generate embeddings for ${filePath}`);
      }

      // Store chunks in vector index
      const storedCount = await this.vectorIndex.storeChunks(embeddedChunks);

      if (storedCount === 0) {
        throw new StorageError(`Failed to store chunks for ${filePath}`);
      }

    } catch (error: any) {
      // Re-throw with context
      if (error instanceof FileProcessingError ||
          error instanceof EmbeddingError ||
          error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Processing failed for ${filePath}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search for documents using semantic similarity
   * @param query Natural language query
   * @param options Search configuration
   * @returns Search results
   */
  async searchDocuments(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.embedQuery(query);

      // Search for similar chunks in the vector index
      const results = await this.vectorIndex.searchSimilar(
        queryEmbedding,
        options.limit || 10,
        options.minScore || 0.0
      );

      const searchTime = Date.now() - startTime;
      const totalResults = results.length;

      return {
        query,
        results,
        totalResults,
        searchTime,
        options
      };

    } catch (error) {
      // Return empty result set on error
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        options
      };
    }
  }

  /**
   * Get file details and content
   * @param filePath Absolute file path
   * @param chunkIndex Optional specific chunk index
   * @param contextLines Number of surrounding lines for context
   * @returns File chunks and content
   */
  async getFileDetails(filePath: string, chunkIndex?: number, contextLines: number = 3): Promise<DocumentChunk[]> {
    try {
      if (chunkIndex !== undefined) {
        // Get specific chunk
        const chunkId = `${filePath}:${chunkIndex}`;
        const chunk = await this.vectorIndex.getChunk(chunkId);
        return chunk ? [chunk] : [];
      } else {
        // Get all chunks for the file
        const chunks = await this.vectorIndex.getFileChunks(filePath);
        return chunks;
      }
    } catch (error) {
      console.error(`Failed to get file details for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Delete file from index
   * @param filePath Absolute file path
   * @returns Number of deleted chunks
   */
  async deleteFile(filePath: string): Promise<number> {
    try {
      return await this.vectorIndex.deleteFile(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Get index statistics
   * @returns Index statistics
   */
  async getStatistics() {
    try {
      return await this.vectorIndex.getStatistics();
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalChunks: 0,
        totalFiles: 0,
        totalTokens: 0,
        embeddingModel: 'unknown',
        lastUpdated: new Date(),
        dbSize: 0
      };
    }
  }

  /**
   * Get all files in a directory with parallel processing
   * @param dirPath Directory path to scan
   * @param concurrencyConfig Concurrency configuration
   * @returns Array of file paths
   */
  private async getAllFilesParallel(dirPath: string, concurrencyConfig: ConcurrencyConfig): Promise<string[]> {
    const maxDirConcurrency = concurrencyConfig.maxDirectoryConcurrency || os.cpus().length * 2;
    const dirLimit = pLimit(maxDirConcurrency);

    console.log(`Scanning directory with concurrency limit of ${maxDirConcurrency}`);

    return await this.scanDirectoryParallel(dirPath, dirLimit);
  }

  /**
   * Scan directory recursively with parallel processing
   * @param dirPath Directory to scan
   * @param dirLimit Concurrency limiter
   * @returns Array of file paths
   */
  private async scanDirectoryParallel(dirPath: string, dirLimit: any): Promise<string[]> {
    const dirLimitFunction = dirLimit ? dirLimit : (fn: () => any) => fn();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];
      const subDirectoryTasks: Promise<string[]>[] = [];

      // Process immediate files synchronously
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
          // Limit concurrency for subdirectories
          subDirectoryTasks.push(
            dirLimitFunction(async () => {
              try {
                return await this.scanDirectoryParallel(fullPath, dirLimit);
              } catch (error) {
                console.warn(`Skipping inaccessible directory: ${fullPath}`);
                return []; // Return empty array for inaccessible directories
              }
            })
          );
        }
      }

      // Wait for all subdirectory scans to complete
      const subDirectoryResults = await Promise.all(subDirectoryTasks);

      // Flatten results and add to files array
      for (const subFiles of subDirectoryResults) {
        files.push(...subFiles);
      }

      return files;

    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Utility: Recursively get all files in a directory (sequential fallback)
   * @param dirPath Directory path
   * @returns Array of file paths
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const fs = await import('fs').then(m => m.promises);
    const pathModule = await import('path');

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = pathModule.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be indexed
          if (!this.shouldSkipDirectory(entry.name)) {
            const subFiles = await this.getAllFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }

      return files;

    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Check if file should be included based on options
   * @param filePath File path
   * @param options Index options
   * @returns true if should include
   */
  private shouldIncludeFile(filePath: string, options: IndexOptions): boolean {
    // Check file extensions
    if (options.fileTypes && options.fileTypes.length > 0) {
      const ext = path.basename(filePath).split('.').pop()?.toLowerCase();
      if (ext && !options.fileTypes.includes(`.${ext}`)) {
        return false;
      }
    }

    // Check patterns
    if (options.excludePatterns) {
      for (const pattern of options.excludePatterns) {
        if (filePath.includes(pattern)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if directory should be skipped
   * @param dirName Directory name
   * @returns true if should skip
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'tmp',
      '__pycache__',
      '.next',
      '.venv',
      'venv'
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Close all resources
   */
  dispose(): void {
    try {
      this.vectorIndex.close();
      this.embeddingService.dispose();
    } catch (error) {
      console.error('Error disposing resources:', error);
    }
  }
}
