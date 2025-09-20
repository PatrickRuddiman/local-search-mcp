import { promises as fs } from 'fs';
import path from 'path';
import { runCli } from 'repomix';
import { SearchService } from './SearchService.js';
import { FileWatcher } from './FileWatcher.js';
import { IndexOptions } from '../types/index.js';

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
    this.searchService = searchService;
    this.fileWatcher = fileWatcher;
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
    try {
      // Extract repo name from URL
      const repoName = this.extractRepoName(repoUrl);
      const tempDir = path.join('./temp', `${repoName}_${Date.now()}`);
      const outputDir = path.join('./docs', 'repositories', repoName);

      // Create directories
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(outputDir, { recursive: true });

      // Clone and convert repository using repomix
      await this.downloadRepositoryWithRepomix(repoUrl, branch, tempDir, outputDir, options);

      // Index the downloaded content
      const indexResult = await this.searchService.indexFiles(outputDir, {
        chunkSize: 1000,
        overlap: 200,
        maxFiles: options.maxFiles || 1000,
        fileTypes: ['.md', '.txt', '.json', '.rst']
      });

      // Clean up temporary directory
      try {
        await this.rmDir(tempDir);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary directory:', cleanupError);
      }

      return {
        success: true,
        repoName,
        filesProcessed: indexResult.processedFiles,
        outputDir,
        stats: indexResult
      };

    } catch (error: any) {
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
    tempDir: string,
    outputDir: string,
    options: RepoDownloadOptions
  ): Promise<void> {
    try {
      // Build repository URL with branch if specified
      const repoWithBranch = branch ? `${repoUrl}#${branch}` : repoUrl;

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

      console.log(`Processing repository: ${repoWithBranch}`);
      console.log(`Output directory: ${outputDir}`);
      console.log(`Include patterns: ${include}`);
      console.log(`Exclude patterns: ${exclude}`);

      // Use repomix library to process repository
      await runCli([repoWithBranch], outputDir, {
        output: outputDir,
        include,
        ignore: exclude,
        style: options.outputStyle || 'markdown',
        removeComments: options.removeComments || false,
        removeEmptyLines: false,
        includeLineNumbers: options.showLineNumbers || true,
        topFilesLen: 0, // Disable file length limits
        compress: false, // No compression needed for MCP
        quiet: false, // Show progress for debugging
        verbose: false // Not too verbose
      });

      // If we reach here, the operation was successful
      console.log('Repository processed successfully');

    } catch (error: any) {
      console.error('Repomix library error:', error);
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
