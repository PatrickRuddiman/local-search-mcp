import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { SearchService } from './SearchService.js';
import { FileProcessor } from './FileProcessor.js';

export class FileWatcher {
  private watcher?: any; // chokidar.FSWatcher
  private searchService: SearchService;
  private docsFolder: string;
  private isWatching = false;
  private processingLock = false;

  constructor(searchService: SearchService) {
    this.searchService = searchService;
    this.docsFolder = this.getDocsFolderPath();
  }

  /**
   * Get cross-platform docs folder path
   */
  private getDocsFolderPath(): string {
    // Check environment variable first
    if (process.env.MCP_DOCS_FOLDER) {
      return process.env.MCP_DOCS_FOLDER;
    }

    const appName = 'local-search-mcp';

    switch (process.platform) {
      case 'win32':
        // Windows: %LOCALAPPDATA%/local-search-mcp/docs
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        return path.join(localAppData, appName, 'docs');

      case 'darwin':
        // macOS: ~/Library/Application Support/local-search-mcp/docs
        return path.join(os.homedir(), 'Library', 'Application Support', appName, 'docs');

      case 'linux':
      default:
        // Linux: ~/.local/share/local-search-mcp/docs
        return path.join(os.homedir(), '.local', 'share', appName, 'docs');
    }
  }

  /**
   * Ensure docs folder exists
   */
  private async ensureDocsFolder(): Promise<void> {
    try {
      await fs.mkdir(this.docsFolder, { recursive: true });
      console.log(`Ensured docs folder exists: ${this.docsFolder}`);
    } catch (error) {
      throw new Error(`Failed to create docs folder: ${error}`);
    }
  }

  /**
   * Start watching the docs folder
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      console.warn('File watcher is already running');
      return;
    }

    try {
      await this.ensureDocsFolder();

      // Create ignored function for filtering files
      const ignoredPaths = [
        /\.git/,
        /node_modules/,
        /\.DS_Store$/,
        /Thumbs\.db$/,
        /(\.log|\.tmp|\.cache|~)$/,
      ];

      const ignoredFunction = (filePath: string): boolean => {
        const relativePath = path.relative(this.docsFolder, filePath);

        // Ignore dot directories and files
        if (relativePath.includes('/.') || relativePath.startsWith('.')) {
          return true;
        }

        // Check against common ignore patterns
        return ignoredPaths.some(pattern => pattern.test(relativePath));
      };

      // Watch for file changes in docs folder and subdirectories
      this.watcher = chokidar.watch(this.docsFolder, {
        persistent: true,
        ignoreInitial: false, // Also process existing files on startup
        awaitWriteFinish: {
          stabilityThreshold: 1000,  // Wait 1s after writes finish
          pollInterval: 100         // Poll every 100ms during awaitWriteFinish
        },
        ignored: ignoredFunction,
        followSymlinks: false
      });

      // File added or changed
      this.watcher.on('add', async (filePath: string) => {
        if (this.shouldIndexFile(filePath)) {
          await this.processFile(filePath, 'add');
        }
      });

      this.watcher.on('change', async (filePath: string) => {
        if (this.shouldIndexFile(filePath)) {
          await this.processFile(filePath, 'change');
        }
      });

      // File removed
      this.watcher.on('unlink', async (filePath: string) => {
        if (this.shouldIndexFile(filePath)) {
          await this.deleteFileFromIndex(filePath);
        }
      });

      this.isWatching = true;
      console.log(`Started watching docs folder: ${this.docsFolder}`);

    } catch (error) {
      throw new Error(`Failed to start file watcher: ${error}`);
    }
  }

  /**
   * Stop watching the docs folder
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    this.isWatching = false;
    console.log('Stopped watching docs folder');
  }

  /**
   * Get the current docs folder path
   */
  getDocsFolder(): string {
    return this.docsFolder;
  }

  /**
   * Check if file should be indexed
   */
  private shouldIndexFile(filePath: string): boolean {
    const processor = new FileProcessor();

    // Check if file extension is supported
    if (!processor.isFileSupported(filePath)) {
      return false;
    }

    // Check if file is in docs folder or subdirectories
    const relativePath = path.relative(this.docsFolder, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return false; // File is outside docs folder
    }

    return true;
  }

  /**
   * Process a single file (add/update) with concurrency control
   */
  private async processFile(filePath: string, operation: 'add' | 'change'): Promise<void> {
    console.log(`${operation === 'add' ? 'Processing' : 'Re-processing'} file: ${filePath}`);

    try {
      // Use TextChunker to chunk the file content
      const chunkConfig = {
        chunkSize: 1000,
        overlap: 200,
        method: 'fixed' as const,
        preserveCodeBlocks: true,
        preserveMarkdownHeaders: true
      };

      // Process single file by chunks
      await this.searchService.indexFiles(filePath, {
        chunkSize: chunkConfig.chunkSize,
        overlap: chunkConfig.overlap,
        maxFiles: 1, // Only process this single file
        fileTypes: ['.md', '.txt', '.json', '.js', '.ts', '.rst'] // Supported types
      }, {
        maxFileProcessingConcurrency: 1, // Single file from watcher
        maxDirectoryConcurrency: os.cpus().length, // But allow directory scanning concurrency
        maxEmbeddingConcurrency: 1, // Single file embedding
        maxRepositoryConcurrency: 1, // Not applicable for file watching
        maxFileWatcherConcurrency: os.cpus().length / 2 // Allow some concurrent file processing
      });

    } catch (error) {
      console.error(`Failed to process file ${filePath}:`, error);
    }
  }

  /**
   * Remove file from index
   */
  private async deleteFileFromIndex(filePath: string): Promise<void> {
    try {
      console.log(`Removing file from index: ${filePath}`);
      await this.searchService.deleteFile(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${filePath} from index:`, error);
    }
  }

  /**
   * Manually trigger indexing of a specific file
   */
  async indexFile(filePath: string): Promise<void> {
    if (this.shouldIndexFile(filePath)) {
      await this.processFile(filePath, 'add');
    } else {
      console.warn(`File ${filePath} not eligible for indexing`);
    }
  }

  /**
   * Get watcher status
   */
  getStatus(): {
    isWatching: boolean;
    docsFolder: string;
    processing: boolean;
  } {
    return {
      isWatching: this.isWatching,
      docsFolder: this.docsFolder,
      processing: this.processingLock
    };
  }

  /**
   * Wait for processing to complete (used in tests)
   */
  waitForProcessing(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.processingLock) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}
