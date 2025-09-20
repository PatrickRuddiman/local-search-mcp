import { promises as fs } from 'fs';
import path from 'path';
import { SearchService } from './SearchService.js';
import { FileWatcher } from './FileWatcher.js';
import { log } from './Logger.js';
import { getMcpPaths, ensureDirectoryExists } from './PathUtils.js';

interface FileDownloadOptions {
  overwrite?: boolean;
  indexAfterSave?: boolean;
  maxFileSizeMB?: number;
}

export class FileDownloadService {
  private searchService: SearchService;
  private fileWatcher?: FileWatcher;

  constructor(searchService: SearchService, fileWatcher?: FileWatcher) {
    log.debug('Initializing FileDownloadService');
    this.searchService = searchService;
    this.fileWatcher = fileWatcher;
    log.debug('FileDownloadService initialized successfully');
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
    docFolder?: string,
    options: FileDownloadOptions = {}
  ): Promise<any> {
    const timer = log.time(`file-download-${filename}`);
    const operationId = `${filename}_${Date.now()}`;

    // Use provided docFolder or default to MCP fetched folder
    const targetFolder = docFolder || getMcpPaths().fetched;

    log.info('Starting file download operation', {
      operationId,
      url,
      filename,
      docFolder: targetFolder,
      options
    });

    try {
      log.debug('Creating target directory', { operationId, docFolder: targetFolder });
      // Create target directory using PathUtils
      await ensureDirectoryExists(targetFolder, 'File download target directory');

      log.debug('Downloading file content from URL', { operationId, url });
      // Download file content
      const downloadTimer = log.time(`download-content-${operationId}`);
      const fileContent = await this.downloadFromUrl(url, options.maxFileSizeMB || 10);
      downloadTimer();

      log.debug('File content downloaded successfully', {
        operationId,
        contentLength: fileContent.length,
        sizeBytes: Buffer.byteLength(fileContent, 'utf-8')
      });

      // Sanitize filename
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(targetFolder, safeFilename);

      log.debug('Filename sanitized', {
        operationId,
        originalFilename: filename,
        safeFilename,
        filePath
      });

      // Check if file exists and handle overwrite
      const exists = await this.fileExists(filePath);
      if (exists && !options.overwrite) {
        log.warn('File exists and overwrite disabled', { operationId, filePath });
        throw new Error(`File ${filePath} already exists and overwrite=false`);
      }

      log.debug('Saving file to disk', { operationId, filePath });
      const saveTimer = log.time(`save-file-${operationId}`);
      // Save file
      await fs.writeFile(filePath, fileContent, 'utf-8');
      saveTimer();

      log.debug('File saved successfully', { operationId, filePath });

      // Index file if requested
      let indexResult = null;
      if (options.indexAfterSave !== false) {
        log.debug('Starting file indexing', { operationId, filePath });
        const indexTimer = log.time(`index-file-${operationId}`);
        indexResult = await this.searchService.indexFiles(filePath, {
          chunkSize: 1000,
          overlap: 200,
          maxFiles: 1
        });
        indexTimer();

        log.debug('File indexed successfully', {
          operationId,
          indexStats: {
            processedFiles: indexResult.processedFiles,
            totalChunks: indexResult.totalChunks,
            totalTokens: indexResult.totalTokens
          }
        });
      } else {
        log.debug('File indexing skipped', { operationId, reason: 'indexAfterSave=false' });
      }

      const fileSize = Buffer.byteLength(fileContent, 'utf-8');
      timer();
      log.info('File download operation completed successfully', {
        operationId,
        url,
        filePath,
        fileSize,
        sizeKB: (fileSize / 1024).toFixed(1),
        indexed: options.indexAfterSave !== false
      });

      return {
        success: true,
        filePath,
        size: fileSize,
        indexResult
      };

    } catch (error: any) {
      log.error('File download operation failed', error, {
        operationId,
        url,
        filename,
        docFolder
      });

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
      const protocol = url.startsWith('https:') ? 'https' : 'http';
      const maxSize = maxSizeMB * 1024 * 1024;

      log.debug('Initializing HTTP request', {
        url,
        protocol,
        timeout: 30000,
        maxSizeMB
      });

      const request = protocol === 'https'
        ? https.get(url, { timeout: 30000 })
        : http.get(url, { timeout: 30000 });

      let data = '';
      let downloadedBytes = 0;
      let chunkCount = 0;

      request.on('timeout', () => {
        log.warn('Download request timed out', { url, timeout: 30000 });
        request.destroy();
        reject(new Error('Download timeout'));
      });

      request.on('error', (error) => {
        log.error('HTTP request failed', error, { url, protocol });
        reject(new Error(`Network error: ${error.message}`));
      });

      request.on('response', (res) => {
        log.debug('HTTP response received', {
          url,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: {
            contentType: res.headers['content-type'],
            contentLength: res.headers['content-length']
          }
        });

        if (res.statusCode !== 200) {
          log.warn('HTTP request returned non-200 status', {
            url,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
          });
          res.destroy();
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }

        res.on('data', (chunk) => {
          chunkCount++;
          data += chunk;
          downloadedBytes += chunk.length;

          log.debug('Chunk received', {
            url,
            chunkNumber: chunkCount,
            chunkSize: chunk.length,
            totalBytes: downloadedBytes
          });

          // Check size limit
          if (Buffer.byteLength(data, 'utf-8') > maxSize) {
            log.warn('Download size limit exceeded', {
              url,
              maxSizeMB,
              currentSize: downloadedBytes,
              chunkCount
            });
            res.destroy();
            reject(new Error(`File size exceeds ${maxSizeMB}MB limit`));
          }
        });

        res.on('end', () => {
          const finalSize = Buffer.byteLength(data, 'utf-8');
          log.info('Download completed successfully', {
            url,
            totalChunks: chunkCount,
            totalBytes: finalSize,
            sizeKB: (finalSize / 1024).toFixed(1),
            contentType: res.headers['content-type']
          });
          resolve(data);
        });

        res.on('error', (error) => {
          log.error('Response stream error', error, { url });
          reject(new Error(`Download failed: ${error.message}`));
        });
      });
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
