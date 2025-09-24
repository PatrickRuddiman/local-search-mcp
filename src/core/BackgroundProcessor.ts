import { FileProcessor } from './FileProcessor.js';
import { TextChunker } from './TextChunker.js';
import { EmbeddingService } from './EmbeddingService.js';
import { VectorIndex } from './VectorIndex.js';
import { JobManager } from './JobManager.js';
import { log } from './Logger.js';
import { getMcpPaths, ensureDirectoryExists, extractRepoName } from './PathUtils.js';
import { runCli } from 'repomix';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  FileProcessingError,
  EmbeddingError,
  StorageError,
  DocumentChunk
} from '../types/index.js';

interface FileDownloadOptions {
  overwrite?: boolean;
  indexAfterSave?: boolean;
  maxFileSizeMB?: number;
}

interface RepoDownloadOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  outputStyle?: 'markdown';
  removeComments?: boolean;
  showLineNumbers?: boolean;
}

/**
 * Handles background document processing operations using event loop yielding
 */
export class BackgroundProcessor {
  private jobManager: JobManager;

  constructor() {
    this.jobManager = JobManager.getInstance();
    log.info('BackgroundProcessor initialized');
  }

  /**
   * Process repository fetch in background with accurate progress
   */
  async processRepoFetch(
    jobId: string,
    repoUrl: string,
    branch?: string,
    options: RepoDownloadOptions = {}
  ): Promise<void> {
    try {
      // Step 1: Download repository (0-30%)
      this.jobManager.updateProgress(jobId, 5, 'Initializing repository download...');

      const repoName = extractRepoName(repoUrl);
      const mcpPaths = getMcpPaths();
      const outputDir = path.join(mcpPaths.repositories, repoName);

      this.jobManager.updateProgress(jobId, 10, 'Creating output directory...');
      await ensureDirectoryExists(outputDir, 'Repository output directory');

      this.jobManager.updateProgress(jobId, 15, 'Downloading repository with repomix...');
      const filePath = await this.downloadRepo(jobId, repoUrl, branch, outputDir, options);

      // Step 2: Process file (30-100%)
      await this.processFile(jobId, filePath, 30, 70);

      this.jobManager.completeJob(jobId, {
        success: true,
        repoName,
        filePath,
        outputDir
      });

    } catch (error: any) {
      log.error('Repository fetch failed', error, { jobId, repoUrl });
      this.jobManager.failJob(jobId, error.message);
    }
  }

  /**
   * Process file fetch in background with accurate progress
   */
  async processFileFetch(
    jobId: string,
    url: string,
    filename: string,
    options: FileDownloadOptions = {}
  ): Promise<void> {
    try {
      // Step 1: Download file (0-40%)
      this.jobManager.updateProgress(jobId, 5, 'Initializing file download...');

      const targetFolder = getMcpPaths().fetched;
      await ensureDirectoryExists(targetFolder, 'File download directory');

      this.jobManager.updateProgress(jobId, 10, 'Starting file download...');
      const filePath = await this.downloadFile(jobId, url, filename, targetFolder, options);

      // Step 2: Process file (40-100%) 
      if (options.indexAfterSave !== false) {
        await this.processFile(jobId, filePath, 40, 60, options.maxFileSizeMB);
      } else {
        this.jobManager.updateProgress(jobId, 100, 'File download completed (indexing skipped)');
      }

      this.jobManager.completeJob(jobId, {
        success: true,
        filePath,
        size: (await fs.stat(filePath)).size
      });

    } catch (error: any) {
      log.error('File fetch failed', error, { jobId, url, filename });
      this.jobManager.failJob(jobId, error.message);
    }
  }

  private async processFile(
    jobId: string,
    filePath: string,
    startProgress: number,
    progressRange: number,
    maxFileSizeMB?: number
  ): Promise<void> {
    const fileProcessor = new FileProcessor(maxFileSizeMB);
    const textChunker = new TextChunker();
    const embeddingService = await EmbeddingService.getInstance();
    const vectorIndex = new VectorIndex();

    try {
      this.jobManager.updateProgress(jobId, startProgress, 'Reading file content...');
      const text = await fileProcessor.extractText(filePath);

      if (text.trim().length === 0) {
        throw new FileProcessingError(`File ${filePath} is empty`);
      }

      this.jobManager.updateProgress(jobId, startProgress + (progressRange * 0.1), 'Chunking text with event loop yielding...');
      const chunks = await textChunker.chunkText(text, filePath, {
        chunkSize: 1000,
        overlap: 200,
        method: 'fixed'
      });

      if (chunks.length === 0) {
        throw new FileProcessingError(`No chunks created for file ${filePath}`);
      }

      this.jobManager.updateProgress(jobId, startProgress + (progressRange * 0.2), `Created ${chunks.length} chunks with yielding`);

      this.jobManager.updateProgress(jobId, startProgress + (progressRange * 0.2), 'Generating embeddings...');
      const embeddedChunks = await this.generateEmbeddings(jobId, chunks, startProgress + (progressRange * 0.2), progressRange * 0.6);

      this.jobManager.updateProgress(jobId, startProgress + (progressRange * 0.8), 'Storing chunks in database...');
      const storedCount = await vectorIndex.storeChunks(embeddedChunks);

      if (storedCount === 0) {
        throw new StorageError(`Failed to store chunks for ${filePath}`);
      }

      this.jobManager.updateProgress(jobId, startProgress + progressRange, `Indexed ${storedCount} chunks successfully`);
      vectorIndex.close();

    } catch (error: any) {
      throw new StorageError(`File processing failed for ${filePath}: ${error.message}`, error);
    }
  }

  private async generateEmbeddings(
    jobId: string,
    chunks: DocumentChunk[],
    startProgress: number,
    progressRange: number
  ): Promise<DocumentChunk[]> {
    log.debug('Processing embeddings with event loop yielding for MCP responsiveness', {
      jobId,
      chunkCount: chunks.length,
      strategy: 'event-loop-yielding'
    });

    // Use event loop yielding for TensorFlow compatibility
    // Process small batches with setImmediate() yielding between each batch
    // This keeps MCP server responsive during embedding generation
    const embeddingService = await EmbeddingService.getInstance();
    const batchSize = 10; // Small batches to enable frequent yielding
    const results: DocumentChunk[] = [];

    const totalBatches = Math.ceil(chunks.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, chunks.length);
      const batch = chunks.slice(start, end);

      log.debug(`Processing embedding batch ${batchIndex + 1}/${totalBatches}`, {
        batchSize: batch.length,
        totalProcessed: end,
        remaining: chunks.length - end
      });

      // Process this batch
      const embeddedBatch = await embeddingService.generateEmbeddings(batch);
      results.push(...embeddedBatch);

      // Update progress after each batch
      const progress = ((batchIndex + 1) / totalBatches) * progressRange;
      this.jobManager.updateProgress(
        jobId,
        startProgress + progress,
        `Processed ${end}/${chunks.length} chunks (${Math.round(progress * 100 / progressRange)}% of embedding phase)`
      );

      // IMPORTANT: Yield control back to event loop after each batch
      // This allows MCP server to handle other requests and prevents blocking
      await new Promise(resolve => setImmediate(resolve));

      log.debug(`Yielded control back to event loop after batch ${batchIndex + 1}/${totalBatches}`);
    }

    log.debug('Embedding generation completed with event loop yielding', {
      totalChunks: chunks.length,
      totalBatches,
      strategy: 'event-loop-yielding'
    });

    return results;
  }

  private async downloadRepo(
    jobId: string,
    repoUrl: string,
    branch: string | undefined,
    outputDir: string,
    options: RepoDownloadOptions
  ): Promise<string> {
    const includePatterns = options.includePatterns || ['**/*.md', '**/*.mdx', '**/*.txt', '**/*.json', '**/*.rst', '**/*.yml', '**/*.yaml'];
    const excludePatterns = [
      ...(options.excludePatterns || []),
      'node_modules/**',
      '.git/**',
      '__pycache__',
      '*.pyc',
      'dist/**',
      'build/**',
      '.DS_Store',
      'Thumbs.db'
    ];

    const include = includePatterns.join(',');
    const exclude = excludePatterns.join(',');

    const repoName = extractRepoName(repoUrl);
    const outputFile = path.join(outputDir, `${repoName}.md`);

    // Try repomix remote approach first
    try {
      this.jobManager.updateProgress(jobId, 20, 'Processing repository with repomix...');

      await runCli(['.'], outputDir, {
        remote: repoUrl,
        remoteBranch: branch,
        output: outputFile,
        include,
        ignore: exclude,
        style: options.outputStyle || 'markdown',
        removeComments: options.removeComments || false,
        removeEmptyLines: false,
        outputShowLineNumbers: options.showLineNumbers || true,
        topFilesLen: 0,
        compress: false,
        quiet: false,
        verbose: false
      });

      this.jobManager.updateProgress(jobId, 30, 'Repository download completed');
      return outputFile;
    } catch (error: any) {
      log.debug('Repomix remote download failed, trying fallback clone', { error: error.message, repoUrl });

      // For Azure DevOps and other private repos, fallback to manual clone if access error
      const isAccessError = error.message.includes('Authentication failed') ||
        error.message.includes('403') ||
        error.message.includes('401') ||
        error.message.includes('404') ||
        error.message.includes('Invalid remote repository URL') ||
        error.message.includes('credential') ||
        error.message.includes('password') ||
        error.message.includes('Permission denied');

      if (isAccessError) {
        log.info('Detected possible authentication/access error, falling back to manual Git clone');
        return await this.downloadRepoWithFallback(jobId, repoUrl, branch, outputDir, options, include, exclude, repoName, outputFile);
      }

      // Re-throw if not an auth-related error
      throw error;
    }
  }

  private async downloadRepoWithFallback(
    jobId: string,
    repoUrl: string,
    branch: string | undefined,
    outputDir: string,
    options: RepoDownloadOptions,
    include: string,
    exclude: string,
    repoName: string,
    outputFile: string
  ): Promise<string> {
    try {
      this.jobManager.updateProgress(jobId, 18, 'Access error, falling back to manual Git clone...');

      const mcpPaths = getMcpPaths();
      const tempCloneDir = path.join(mcpPaths.temp, `clone_${Date.now()}_${repoName}`);
      await ensureDirectoryExists(tempCloneDir, 'Temp clone directory');

      this.jobManager.updateProgress(jobId, 22, 'Cloning repository manually...');

      // Clone repository using Git (relies on user's configured authentication)
      const execAsync = promisify(exec);
      const cloneCommand = `git clone ${branch ? `-b ${branch} ` : ''}"${repoUrl}" "${tempCloneDir}"`;
      await execAsync(cloneCommand);

      this.jobManager.updateProgress(jobId, 26, 'Repository cloned, processing with repomix...');

      // Run repomix on the local cloned directory
      await runCli([tempCloneDir], outputDir, {
        output: outputFile,
        include,
        ignore: exclude,
        style: options.outputStyle || 'markdown',
        removeComments: options.removeComments || false,
        removeEmptyLines: false,
        outputShowLineNumbers: options.showLineNumbers || true,
        topFilesLen: 0,
        compress: false,
        quiet: false,
        verbose: false
      });

      this.jobManager.updateProgress(jobId, 30, 'Repository download completed');

      // Cleanup temp directory
      try {
        await fs.rm(tempCloneDir, { recursive: true, force: true });
        log.debug('Cleaned up temp clone directory', { tempCloneDir });
      } catch (cleanupError) {
        log.warn('Failed to cleanup temp clone directory', { tempCloneDir, cleanupError });
      }

      return outputFile;
    } catch (error: any) {
      log.error('Manual clone fallback failed', error, {
        repoUrl,
        branch,
        tempDir: path.join(getMcpPaths().temp, `clone_*.${repoName}`)
      });
      throw error;
    }
  }

  private async downloadFile(
    jobId: string,
    url: string,
    filename: string,
    targetFolder: string,
    options: FileDownloadOptions
  ): Promise<string> {
    const https = await import('https');
    const http = await import('http');

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? 'https' : 'http';
      const maxSize = (options.maxFileSizeMB || 1024) * 1024 * 1024;

      const request = protocol === 'https'
        ? https.get(url, { timeout: 30000 })
        : http.get(url, { timeout: 30000 });

      let data = '';
      let downloadedBytes = 0;
      let totalBytes = 0;

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });

      request.on('error', (error: any) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      request.on('response', (res: any) => {
        if (res.statusCode !== 200) {
          res.destroy();
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }

        totalBytes = parseInt(res.headers['content-length'] || '0');

        res.on('data', (chunk: any) => {
          data += chunk;
          downloadedBytes += chunk.length;

          if (totalBytes > 0) {
            const downloadProgress = (downloadedBytes / totalBytes) * 30;
            this.jobManager.updateProgress(
              jobId,
              10 + downloadProgress,
              `Downloaded ${(downloadedBytes / 1024).toFixed(1)}KB of ${(totalBytes / 1024).toFixed(1)}KB`
            );
          }

          if (data.length > maxSize) {
            res.destroy();
            reject(new Error(`File size exceeds ${options.maxFileSizeMB}MB limit`));
          }
        });

        res.on('end', async () => {
          try {
            const safeFilename = this.sanitizeFilename(filename);
            const filePath = path.join(targetFolder, safeFilename);

            const exists = await this.fileExists(filePath);
            if (exists && !options.overwrite) {
              throw new Error(`File ${filePath} already exists and overwrite=false`);
            }

            await fs.writeFile(filePath, data, 'utf-8');
            this.jobManager.updateProgress(jobId, 40, 'File download completed');
            resolve(filePath);
          } catch (error: any) {
            reject(error);
          }
        });

        res.on('error', (error: any) => {
          reject(new Error(`Download failed: ${error.message}`));
        });
      });
    });
  }



  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 255);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
