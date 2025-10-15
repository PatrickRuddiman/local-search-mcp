import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { promises as fs } from 'fs';
import { log } from './Logger.js';
import { getMcpPaths } from './PathUtils.js';
import { BackgroundProcessor } from './BackgroundProcessor.js';
import { JobManager } from './JobManager.js';
import { FileProcessor } from './FileProcessor.js';

interface WatcherStats {
  filesAdded: number;
  filesChanged: number;
  filesRemoved: number;
  errors: number;
  lastActivity: Date | null;
}

interface WatchedFileInfo {
  path: string;
  basename: string;
  size: number;
  modified: Date;
  isIndexed: boolean;
}

/**
 * FileWatcher monitors a directory for file changes and automatically
 * processes them through the indexing pipeline
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private watchedDir: string;
  private backgroundProcessor: BackgroundProcessor;
  private jobManager: JobManager;
  private fileProcessor: FileProcessor;
  private isActive: boolean = false;
  private stats: WatcherStats;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay: number = 500; // ms

  constructor(
    backgroundProcessor: BackgroundProcessor,
    jobManager: JobManager
  ) {
    this.backgroundProcessor = backgroundProcessor;
    this.jobManager = jobManager;
    this.fileProcessor = new FileProcessor();
    this.watchedDir = getMcpPaths().watched;
    this.stats = {
      filesAdded: 0,
      filesChanged: 0,
      filesRemoved: 0,
      errors: 0,
      lastActivity: null
    };

    log.info('FileWatcher initialized', { watchedDir: this.watchedDir });
  }

  /**
   * Start watching the directory for file changes
   */
  async start(): Promise<void> {
    if (this.isActive) {
      log.warn('FileWatcher already active, ignoring start request');
      return;
    }

    try {
      log.info('Starting FileWatcher', { watchedDir: this.watchedDir });

      // Verify watched directory exists
      try {
        await fs.access(this.watchedDir);
      } catch (error) {
        throw new Error(`Watched directory does not exist: ${this.watchedDir}`);
      }

      // Initialize chokidar watcher
      this.watcher = chokidar.watch(this.watchedDir, {
        ignored: /(^|[\/\\])\../, // Ignore dotfiles
        persistent: true,
        ignoreInitial: false, // Process existing files on startup
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        },
        depth: 10 // Watch subdirectories up to 10 levels deep
      });

      // Set up event handlers
      this.watcher
        .on('add', (filePath: string) => this.handleFileAdd(filePath))
        .on('change', (filePath: string) => this.handleFileChange(filePath))
        .on('unlink', (filePath: string) => this.handleFileRemove(filePath))
        .on('error', (error: unknown) => this.handleError(error as Error))
        .on('ready', () => {
          this.isActive = true;
          log.info('FileWatcher ready and monitoring', {
            watchedDir: this.watchedDir,
            debounceDelay: this.debounceDelay
          });
        });

    } catch (error: any) {
      log.error('Failed to start FileWatcher', error, { watchedDir: this.watchedDir });
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop watching the directory
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      log.debug('FileWatcher not active, ignoring stop request');
      return;
    }

    try {
      log.info('Stopping FileWatcher');

      // Clear any pending debounce timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      // Close the watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      this.isActive = false;
      log.info('FileWatcher stopped successfully', { stats: this.stats });

    } catch (error: any) {
      log.error('Error stopping FileWatcher', error);
      throw error;
    }
  }

  /**
   * Handle file addition event with debouncing
   */
  private handleFileAdd(filePath: string): void {
    this.debounceFileEvent(filePath, 'add', async () => {
      try {
        log.debug('File added to watched directory', { filePath });

        // Validate file is supported
        if (!this.fileProcessor.isFileSupported(filePath)) {
          log.debug('Skipping unsupported file type', { filePath, ext: path.extname(filePath) });
          return;
        }

        // Get file stats
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          log.debug('Skipping non-file', { filePath });
          return;
        }

        log.info('Processing newly added file', {
          filePath,
          basename: path.basename(filePath),
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(1)
        });

        // Create background job for processing
        const jobId = this.jobManager.createJob('watch_add', {
          filePath,
          eventType: 'add'
        });

        // Process in background
        this.backgroundProcessor.processWatchedFile(jobId, filePath, 'add')
          .then(() => {
            this.stats.filesAdded++;
            this.stats.lastActivity = new Date();
            log.info('Successfully processed added file', { filePath, jobId });
          })
          .catch((error: any) => {
            this.stats.errors++;
            log.error('Failed to process added file', error, { filePath, jobId });
          });

      } catch (error: any) {
        this.stats.errors++;
        log.error('Error handling file add event', error, { filePath });
      }
    });
  }

  /**
   * Handle file change event with debouncing
   */
  private handleFileChange(filePath: string): void {
    this.debounceFileEvent(filePath, 'change', async () => {
      try {
        log.debug('File changed in watched directory', { filePath });

        // Validate file is supported
        if (!this.fileProcessor.isFileSupported(filePath)) {
          log.debug('Skipping unsupported file type', { filePath });
          return;
        }

        // Verify file still exists (handle rapid changes)
        try {
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) {
            log.debug('Skipping non-file', { filePath });
            return;
          }
        } catch (error) {
          log.debug('File no longer exists, skipping change event', { filePath });
          return;
        }

        log.info('Processing changed file', { filePath, basename: path.basename(filePath) });

        // Create background job for re-processing
        const jobId = this.jobManager.createJob('watch_change', {
          filePath,
          eventType: 'change'
        });

        // Re-process in background
        this.backgroundProcessor.processWatchedFile(jobId, filePath, 'change')
          .then(() => {
            this.stats.filesChanged++;
            this.stats.lastActivity = new Date();
            log.info('Successfully processed changed file', { filePath, jobId });
          })
          .catch((error: any) => {
            this.stats.errors++;
            log.error('Failed to process changed file', error, { filePath, jobId });
          });

      } catch (error: any) {
        this.stats.errors++;
        log.error('Error handling file change event', error, { filePath });
      }
    });
  }

  /**
   * Handle file removal event
   */
  private handleFileRemove(filePath: string): void {
    // No debouncing for removals - act immediately
    (async () => {
      try {
        log.debug('File removed from watched directory', { filePath });

        log.info('Removing file from index', { filePath, basename: path.basename(filePath) });

        // Create background job for removal
        const jobId = this.jobManager.createJob('watch_remove', {
          filePath,
          eventType: 'unlink'
        });

        // Remove from index in background
        this.backgroundProcessor.processWatchedFile(jobId, filePath, 'unlink')
          .then(() => {
            this.stats.filesRemoved++;
            this.stats.lastActivity = new Date();
            log.info('Successfully removed file from index', { filePath, jobId });
          })
          .catch((error: any) => {
            this.stats.errors++;
            log.error('Failed to remove file from index', error, { filePath, jobId });
          });

      } catch (error: any) {
        this.stats.errors++;
        log.error('Error handling file remove event', error, { filePath });
      }
    })();
  }

  /**
   * Handle watcher errors
   */
  private handleError(error: Error): void {
    this.stats.errors++;
    log.error('FileWatcher error', error, { watchedDir: this.watchedDir });
  }

  /**
   * Debounce file events to prevent duplicate processing during rapid changes
   */
  private debounceFileEvent(
    filePath: string,
    eventType: string,
    callback: () => Promise<void>
  ): void {
    const key = `${filePath}:${eventType}`;

    // Clear existing timer for this file+event combination
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      callback().catch(error => {
        log.error('Error in debounced callback', error, { filePath, eventType });
      });
    }, this.debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Get current watcher status and statistics
   */
  getStatus(): {
    isActive: boolean;
    watchedDirectory: string;
    stats: WatcherStats;
    pendingDebounces: number;
  } {
    return {
      isActive: this.isActive,
      watchedDirectory: this.watchedDir,
      stats: { ...this.stats },
      pendingDebounces: this.debounceTimers.size
    };
  }

  /**
   * List all files in the watched directory
   */
  async listWatchedFiles(includeIndexed: boolean = true): Promise<WatchedFileInfo[]> {
    try {
      const files: WatchedFileInfo[] = [];

      // Read directory recursively
      const entries = await this.readDirectoryRecursive(this.watchedDir);

      for (const entry of entries) {
        try {
          const stats = await fs.stat(entry);
          
          if (stats.isFile() && this.fileProcessor.isFileSupported(entry)) {
            const fileInfo: WatchedFileInfo = {
              path: entry,
              basename: path.basename(entry),
              size: stats.size,
              modified: stats.mtime,
              isIndexed: false
            };

            // Check if file is indexed (if requested)
            if (includeIndexed) {
              fileInfo.isIndexed = await this.isFileIndexed(entry);
            }

            files.push(fileInfo);
          }
        } catch (error) {
          log.warn('Error getting file info', { path: entry, error });
        }
      }

      return files;

    } catch (error: any) {
      log.error('Error listing watched files', error, { watchedDir: this.watchedDir });
      throw error;
    }
  }

  /**
   * Read directory recursively
   */
  private async readDirectoryRecursive(dir: string): Promise<string[]> {
    const entries: string[] = [];

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        // Skip hidden files/directories
        if (item.name.startsWith('.')) {
          continue;
        }

        if (item.isDirectory()) {
          const subEntries = await this.readDirectoryRecursive(fullPath);
          entries.push(...subEntries);
        } else if (item.isFile()) {
          entries.push(fullPath);
        }
      }
    } catch (error) {
      log.warn('Error reading directory', { dir, error });
    }

    return entries;
  }

  /**
   * Check if a file is indexed in the database
   */
  private async isFileIndexed(filePath: string): Promise<boolean> {
    try {
      const { ServiceLocator } = await import('./ServiceLocator.js');
      const serviceLocator = ServiceLocator.getInstance();
      const vectorIndex = serviceLocator.getVectorIndex();
      
      // Query database to check if this file has any chunks
      const db = (vectorIndex as any).db; // Access private db property
      const result = db.prepare('SELECT COUNT(*) as count FROM document_chunks WHERE file_path = ?').get(filePath) as { count: number };
      return result.count > 0;
    } catch (error) {
      log.debug('Error checking if file is indexed', { filePath, error });
      return false;
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      filesAdded: 0,
      filesChanged: 0,
      filesRemoved: 0,
      errors: 0,
      lastActivity: null
    };
    log.info('FileWatcher statistics reset');
  }
}
