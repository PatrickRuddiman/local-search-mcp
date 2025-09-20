import { promises as fs } from 'fs';
import path from 'path';
import { SearchService } from './SearchService.js';
import { FileWatcher } from './FileWatcher.js';

interface FileDownloadOptions {
  overwrite?: boolean;
  indexAfterSave?: boolean;
  maxFileSizeMB?: number;
}

export class FileDownloadService {
  private searchService: SearchService;
  private fileWatcher?: FileWatcher;

  constructor(searchService: SearchService, fileWatcher?: FileWatcher) {
    this.searchService = searchService;
    this.fileWatcher = fileWatcher;
  }

  /**
   * Download file from URL and optionally index it
   * @param url File URL
   * @param filename Desired filename
   * @param docFolder Target folder
   * @param options Download options
   * @returns Download result
   */
  async downloadFile(
    url: string,
    filename: string,
    docFolder: string = './docs/fetched',
    options: FileDownloadOptions = {}
  ): Promise<any> {
    try {
      // Create target directory
      await fs.mkdir(docFolder, { recursive: true });

      // Download file content
      const fileContent = await this.downloadFromUrl(url, options.maxFileSizeMB || 10);

      // Sanitize filename
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(docFolder, safeFilename);

      // Check if file exists and handle overwrite
      const exists = await this.fileExists(filePath);
      if (exists && !options.overwrite) {
        throw new Error(`File ${filePath} already exists and overwrite=false`);
      }

      // Save file
      await fs.writeFile(filePath, fileContent, 'utf-8');

      // Index file if requested
      let indexResult = null;
      if (options.indexAfterSave !== false) {
        indexResult = await this.searchService.indexFiles(filePath, {
          chunkSize: 1000,
          overlap: 200,
          maxFiles: 1
        });
      }

      return {
        success: true,
        filePath,
        size: Buffer.byteLength(fileContent, 'utf-8'),
        indexResult
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        url,
        filename
      };
    }
  }

  /**
   * Download content from URL
   * @param url File URL
   * @param maxSizeMB Maximum file size in MB
   * @returns File content as string
   */
  private async downloadFromUrl(url: string, maxSizeMB: number): Promise<string> {
    const https = await import('https');
    const http = await import('http');

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      const request = protocol.get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }

        let data = '';
        const maxSize = maxSizeMB * 1024 * 1024;

        res.on('data', (chunk) => {
          data += chunk;

          // Check size limit
          if (Buffer.byteLength(data, 'utf-8') > maxSize) {
            res.destroy();
            reject(new Error(`File size exceeds ${maxSizeMB}MB limit`));
          }
        });

        res.on('end', () => {
          resolve(data);
        });

        res.on('error', (error) => {
          reject(new Error(`Download failed: ${error.message}`));
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });

      request.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      request.end();
    });
  }

  /**
   * Check if file exists
   * @param filePath File path
   * @returns true if exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize filename for safe file system usage
   * @param filename Original filename
   * @returns Sanitized filename
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 255); // Limit length
  }
}
