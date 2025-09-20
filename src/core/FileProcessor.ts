import { promises as fs } from 'fs';
import path from 'path';
import { FileProcessingError } from '../types/index.js';
import { log } from './Logger.js';

export class FileProcessor {
  private supportedExtensions: Set<string>;

  constructor() {
    log.debug('Initializing FileProcessor');
    this.supportedExtensions = new Set([
      '.txt', '.md', '.json', '.yaml', '.yml', '.rst',
      '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h',
      '.css', '.scss', '.html', '.xml', '.csv'
    ]);
    log.debug('FileProcessor initialized successfully', {
      supportedExtensions: Array.from(this.supportedExtensions)
    });
  }

  /**
   * Check if a file extension is supported
   * @param filePath File path to check
   * @returns true if supported
   */
  isFileSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supported = this.supportedExtensions.has(ext);

    log.debug('File support check', {
      filePath,
      extension: ext,
      supported
    });

    return supported;
  }

  /**
   * Extract text content from a file
   * @param filePath Absolute path to the file
   * @returns Extracted text content
   */
  async extractText(filePath: string): Promise<string> {
    const timer = log.time(`file-extract-${path.basename(filePath)}`);

    try {
      log.debug('Starting file text extraction', {
        filePath,
        basename: path.basename(filePath)
      });

      // Check if file exists and get stats
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        log.warn('Attempted to extract text from directory', { filePath });
        throw new FileProcessingError(`Path is a directory: ${filePath}`);
      }

      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        log.warn('File size exceeds limit', {
          filePath,
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(1),
          maxSizeMB: 10
        });
        throw new FileProcessingError(`File too large: ${filePath} (${stats.size} bytes)`);
      }

      log.debug('File validation passed', {
        filePath,
        sizeBytes: stats.size,
        modified: stats.mtime.toISOString()
      });

      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      log.debug('Raw content read successfully', {
        filePath,
        contentLength: content.length,
        extension: ext
      });

      // Process content based on file type
      const processed = this.postProcessContent(content, ext);

      timer();
      log.info('File text extraction completed', {
        filePath,
        originalLength: content.length,
        processedLength: processed.length,
        extension: ext,
        changed: processed.length !== content.length
      });

      return processed;
    } catch (error: any) {
      log.error('File text extraction failed', error, {
        filePath,
        basename: path.basename(filePath)
      });

      if (error instanceof FileProcessingError) {
        throw error;
      }
      throw new FileProcessingError(
        `Failed to read file ${filePath}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Post-process content based on file type
   * @param content Raw text content
   * @param extension File extension
   * @returns Processed text content
   */
  private postProcessContent(content: string, extension: string): string {
    // Remove comments for certain file types
    switch (extension) {
      case '.js':
      case '.ts':
      case '.java':
      case '.c':
      case '.cpp':
        return this.removeCodeComments(content);
      case '.css':
      case '.scss':
        return this.removeCssComments(content);
      case '.html':
        return this.removeHtmlComments(content);
      case '.json':
        try {
          // Pretty-print JSON for better parsing
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return content;
        }
      case '.xml':
        return this.removeXmlComments(content);
      default:
        return content;
    }
  }

  /**
   * Remove code-style comments
   */
  private removeCodeComments(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
      .replace(/\/\/.*$/gm, '')         // Single-line comments
      .replace(/^#!/gm, '')             // Shebang lines
      .replace(/^\s*#.*$/gm, '');       // Python style comments
  }

  /**
   * Remove CSS comments
   */
  private removeCssComments(content: string): string {
    return content.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /**
   * Remove HTML comments
   */
  private removeHtmlComments(content: string): string {
    return content.replace(/<!--[\s\S]*?-->/g, '');
  }

  /**
   * Remove XML comments
   */
  private removeXmlComments(content: string): string {
    return content.replace(/<!--[\s\S]*?-->/g, '');
  }

  /**
   * Get file metadata
   * @param filePath Absolute file path
   * @returns File metadata
   */
  async getFileMetadata(filePath: string): Promise<{
    size: number;
    lastModified: Date;
    isText: boolean;
  }> {
    try {
      const timer = log.time(`file-metadata-${path.basename(filePath)}`);
      log.debug('Getting file metadata', { filePath });

      const stats = await fs.stat(filePath);
      const metadata = {
        size: stats.size,
        lastModified: stats.mtime,
        isText: this.isLikelyText(stats.size)
      };

      timer();
      log.debug('File metadata retrieved', {
        filePath,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(1),
        lastModified: stats.mtime.toISOString(),
        isText: metadata.isText
      });

      return metadata;
    } catch (error: any) {
      log.error('Failed to get file metadata', error, { filePath });
      throw error;
    }
  }

  /**
   * Check if file is likely text-based
   * @param fileSize Size in bytes
   * @returns true if likely text
   */
  private isLikelyText(fileSize: number): boolean {
    // Simple heuristic: assume files under 100KB are text
    // In production, you'd check the MIME type or first few bytes
    return fileSize < 100 * 1024;
  }

  /**
   * Count tokens in text (simple implementation)
   * @param text Text content
   * @returns Approximate token count
   */
  static countTokens(text: string): number {
    // Simple approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate and normalize file path
   * @param filePath Input file path
   * @returns Normalized absolute path
   */
  static normalizePath(filePath: string): string {
    return path.resolve(filePath);
  }
}
