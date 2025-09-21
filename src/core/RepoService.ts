import { promises as fs } from 'fs';
import path from 'path';
import { runCli } from 'repomix';
import { SearchService } from './SearchService.js';
import { FileWatcher } from './FileWatcher.js';
import { IndexOptions } from '../types/index.js';
import { log } from './Logger.js';
import { getDocsFolder, getMcpPaths, ensureDirectoryExists } from './PathUtils.js';

interface RepoDownloadOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  outputStyle?: 'markdown';
  removeComments?: boolean;
  showLineNumbers?: boolean;
}

export class RepoService {
  private searchService: SearchService;
  private fileWatcher?: FileWatcher;

  constructor(searchService: SearchService, fileWatcher?: FileWatcher) {
    log.debug('Initializing RepoService');
    this.searchService = searchService;
    this.fileWatcher = fileWatcher;
    log.debug('RepoService initialized successfully');
  }

  /**
   * Fetch repository using repomix and index it
   * @param repoUrl GitHub repository URL
   * @param branch Optional branch/tag/commit
   * @param options Repomix options
   * @returns Processing result
   */
  async fetchRepository(
    repoUrl: string,
    branch?: string,
    options: RepoDownloadOptions = {}
  ): Promise<any> {
    const timer = log.time('repo-fetch-total');
    const repoName = this.extractRepoName(repoUrl);

    log.info('Starting repository fetch operation', {
      repoUrl,
      branch: branch || 'default',
      repoName,
      options
    });

    try {
      const mcpPaths = getMcpPaths();
      const outputDir = path.join(mcpPaths.repositories, repoName);

      log.debug('Repository paths configured', {
        outputDir,
        repoName,
        docsFolder: mcpPaths.docs,
        dataFolder: mcpPaths.data
      });

      // Create output directory
      const setupTimer = log.time('repo-directories-setup');
      await ensureDirectoryExists(outputDir, 'Repository output directory');
      setupTimer();

      log.debug('Repository directory created successfully');

      // Clone and convert repository using repomix
      const downloadTimer = log.time('repo-download-processing');
      await this.downloadRepositoryWithRepomix(repoUrl, branch, outputDir, options);
      downloadTimer();

      // Index the downloaded content
      log.debug('Starting indexing of downloaded repository content');
      const indexTimer = log.time('repo-indexing');
      const indexResult = await this.searchService.indexFiles(outputDir, {
        chunkSize: 1000,
        overlap: 200,
        maxFiles: options.maxFiles || 1000,
        fileTypes: ['.md', '.txt', '.json', '.rst']
      });
      indexTimer();

      timer();
      log.info('Repository fetch operation completed successfully', {
        repoName,
        filesProcessed: indexResult.processedFiles,
        outputDir,
        totalChunks: indexResult.totalChunks,
        totalTokens: indexResult.totalTokens
      });

      return {
        success: true,
        repoName,
        filesProcessed: indexResult.processedFiles,
        outputDir,
        stats: indexResult
      };

    } catch (error: any) {
      log.error('Repository fetch operation failed', error, {
        repoUrl,
        branch,
        repoName
      });

      return {
        success: false,
        error: error.message,
        repoUrl
      };
    }
  }

  /**
   * Download repository using repomix library API
   */
  private async downloadRepositoryWithRepomix(
    repoUrl: string,
    branch: string | undefined,
    outputDir: string,
    options: RepoDownloadOptions
  ): Promise<void> {
    try {
      // Build include and exclude patterns
      const includePatterns = options.includePatterns || ['*.md', '*.txt', '*.json', '*.rst'];
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

      // Build include string (comma-separated)
      const include = includePatterns.join(',');
      const exclude = excludePatterns.join(',');

      log.info('Starting repomix repository processing', {
        repoUrl,
        branch,
        outputDir,
        include,
        exclude,
        options
      });

      // Use repomix library to process repository with remote options
      const repomixTimer = log.time('repomix-processing');
      await runCli(['.'], outputDir, {
        remote: repoUrl,
        remoteBranch: branch,
        output: outputDir,
        include,
        ignore: exclude,
        style: options.outputStyle || 'markdown',
        removeComments: options.removeComments || false,
        removeEmptyLines: false,
        outputShowLineNumbers: options.showLineNumbers || true,
        topFilesLen: 0, // Disable file length limits
        compress: false, // No compression needed for MCP
        quiet: false, // Show progress for debugging
        verbose: false // Not too verbose
      });
      repomixTimer();

      log.info('Repository processed successfully via repomix', {
        repoUrl,
        branch,
        outputDir
      });

    } catch (error: any) {
      log.error('Repomix repository processing failed', error, {
        repoUrl,
        branch,
        outputDir
      });
      throw new Error(`Failed to download repository: ${error.message}`);
    }
  }

  /**
   * Extract repository name from URL
   * @param repoUrl GitHub repository URL
   * @returns Repository name
   */
  private extractRepoName(repoUrl: string): string {
    try {
      // Handle various GitHub URL formats
      const url = repoUrl.replace(/\.git$/, '');
      const parts = url.split('/');

      if (parts.length >= 2) {
        const owner = parts[parts.length - 2];
        const repo = parts[parts.length - 1];
        return `${owner}_${repo}`;
      }

      throw new Error('Invalid repo URL format');

    } catch (error) {
      // Fallback to timestamp-based name
      return `unknown_repo_${Date.now()}`;
    }
  }

  /**
   * Remove directory recursively
   */
  private async rmDir(dirPath: string): Promise<void> {
    const fsSync = await import('fs');
    const { rm } = fs;
    await rm(dirPath, { recursive: true, force: true });
  }
}
