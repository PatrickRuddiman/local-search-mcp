import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { SearchService } from './SearchService.js';
import { FileProcessor } from './FileProcessor.js';
import { log } from './Logger.js';

export class FileWatcher {
  private watcher?: any; // chokidar.FSWatcher
  private searchService: SearchService;
  private docsFolder: string;
  private isWatching = false;
  private processingLock = false;

  constructor(searchService: SearchService) {
    log.debug('Initializing FileWatcher');
    this.searchService = searchService;
    this.docsFolder = this.getDocsFolderPath();
    log.debug('FileWatcher initialized', { docsFolder: this.docsFolder });
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
    const timer = log.time('ensure-docs-folder');
    try {
      log.debug('Ensuring docs folder exists', { docsFolder: this.docsFolder });
      await fs.mkdir(this.docsFolder, { recursive: true });
      log.info('Docs folder ensured', { docsFolder: this.docsFolder });
      timer();
    } catch (error: any) {
      log.error('Failed to create docs folder', error, { docsFolder: this.docsFolder });
      throw new Error(`Failed to create docs folder: ${error.message}`);
    }
  }

  /**
   * Start watching the docs folder
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      log.warn('File watcher is already running, ignoring start request');
      return;
    }

    const timer = log.time('file-watcher-start');
    log.info('Starting file watcher initialization', {
      docsFolder: this.docsFolder,
      ignoreInitial: false // Process existing files on startup
    });

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
      log.debug('Initializing Chokidar watcher', {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
      });

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

      // File added event
      this.watcher.on('add', async (filePath: string) => {
        log.debug('File watcher detected new file', { filePath });
        if (this.shouldIndexFile(filePath)) {
          log.info('Indexing newly added file', {
            filePath,
            relativePath: path.relative(this.docsFolder, filePath)
          });
          await this.processFile(filePath, 'add');
        } else {
          log.debug('Skipping newly added file (not eligible)', { filePath });
        }
      });

      // File changed event
      this.watcher.on('change', async (filePath: string) => {
        log.debug('File watcher detected file change', { filePath });
        if (this.shouldIndexFile(filePath)) {
          log.info('Re-indexing changed file', {
            filePath,
            relativePath: path.relative(this.docsFolder, filePath)
          });
          await this.processFile(filePath, 'change');
        }
      });

      // File removed event
      this.watcher.on('unlink', async (filePath: string) => {
        log.debug('File watcher detected file deletion', { filePath });
        if (this.shouldIndexFile(filePath)) {
          log.info('Removing deleted file from index', {
            filePath,
            relativePath: path.relative(this.docsFolder, filePath)
          });
          await this.deleteFileFromIndex(filePath);
        }
      });

      // Handle watcher errors
      this.watcher.on('error', (error: any) => {
        log.error('File watcher error', error);
      });

      this.isWatching = true;
      log.info('File watcher started successfully', {
        docsFolder: this.docsFolder,
        ignoreInitial: false
      });
      timer();

    } catch (error: any) {
      log.error('Failed to start file watcher', error, { docsFolder: this.docsFolder });
      throw new Error(`Failed to start file watcher: ${error.message}`);
    }
  }

  /**
   * Stop watching the docs folder
   */
  async stopWatching(): Promise<void> {
    log.debug('Stopping file watcher');

    if (this.watcher) {
      const timer = log.time('file-watcher-close');
      await this.watcher.close();
      timer();
      this.watcher = undefined;
    }

    this.isWatching = false;
    log.info('File watcher stopped');
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
    const timer = log.time(`file-${operation}`);
    const relativePath = path.relative(this.docsFolder, filePath);

    log.info(`Processing file via watcher: ${operation}`, {
      filePath,
      relativePath,
      operation,
      docsFolder: this.docsFolder
    });

    try {
      // Use TextChunker to chunk the file content
      const chunkConfig = {
        chunkSize: 1000,
        overlap: 200,
        method: 'fixed' as const,
        preserveCodeBlocks: true,
        preserveMarkdownHeaders: true
      };

      const concurrencyConfig = {
        maxFileProcessingConcurrency: 1, // Single file from watcher
        maxDirectoryConcurrency: os.cpus().length, // But allow directory scanning concurrency
        maxEmbeddingConcurrency: 1, // Single file embedding
        maxRepositoryConcurrency: 1, // Not applicable for file watching
        maxFileWatcherConcurrency: os.cpus().length / 2 // Allow some concurrent file processing
      };

      log.debug('Starting file indexing via SearchService', {
        chunkConfig,
        concurrencyConfig,
        filePath
      });

      // Process single file by chunks
      await this.searchService.indexFiles(filePath, {
        chunkSize: chunkConfig.chunkSize,
        overlap: chunkConfig.overlap,
        maxFiles: 1, // Only process this single file
        fileTypes: ['.md', '.txt', '.json', '.js', '.ts', '.rst'] // Supported types
      }, concurrencyConfig);

      log.info(`File ${operation} completed successfully`, {
        filePath,
        relativePath,
        operation
      });
      timer();

    } catch (error: any) {
      log.error(`Failed to ${operation} file via watcher`, error, {
        filePath,
        relativePath,
        operation
      });
    }
  }

  /**
   * Remove file from index
   */
  private async deleteFileFromIndex(filePath: string): Promise<void> {
    const timer = log.time('file-delete-from-index');
    const relativePath = path.relative(this.docsFolder, filePath);

    log.info('Removing file from index', {
      filePath,
      relativePath
    });

    try {
      await this.searchService.deleteFile(filePath);
      log.info('File successfully removed from index', {
        filePath,
        relativePath
      });
      timer();
    } catch (error: any) {
      log.error('Failed to remove file from index', error, {
        filePath,
        relativePath
      });
    }
  }

  /**
   * Manually trigger indexing of a specific file
   */
  async indexFile(filePath: string): Promise<void> {
    const relativePath = path.relative(this.docsFolder, filePath);

    if (this.shouldIndexFile(filePath)) {
      log.info('Manually indexing file', {
        filePath,
        relativePath
      });
      await this.processFile(filePath, 'add');
    } else {
      log.warn('Manual indexing skipped - file not eligible', {
        filePath,
        relativePath,
        docsFolder: this.docsFolder
      });
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
