import { promises as fs } from 'fs';
import path from 'path';
import { FileProcessingError, ContentMetadata } from '../types/index.js';
import { log } from './Logger.js';
import { ContentClassifier } from './ContentClassifier.js';
import { ContentEnhancer } from './ContentEnhancer.js';
import { DomainExtractor } from './DomainExtractor.js';

export class FileProcessor {
  private supportedExtensions: Set<string>;
  private maxFileSizeMB: number;
  private contentClassifier: ContentClassifier;
  private contentEnhancer: ContentEnhancer;
  private domainExtractor: DomainExtractor;

  constructor(maxFileSizeMB: number = 1024) {
    log.debug('Initializing FileProcessor', { maxFileSizeMB });
    this.maxFileSizeMB = maxFileSizeMB;
    this.supportedExtensions = new Set([
      '.txt', '.md', '.json', '.yaml', '.yml', '.rst',
      '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h',
      '.css', '.scss', '.html', '.xml', '.csv'
    ]);
    
    // Initialize content processing components
    this.contentClassifier = new ContentClassifier();
    this.contentEnhancer = new ContentEnhancer();
    this.domainExtractor = new DomainExtractor();
    
    log.debug('FileProcessor initialized successfully', {
      supportedExtensions: Array.from(this.supportedExtensions),
      maxFileSizeMB: this.maxFileSizeMB,
      hasContentClassifier: !!this.contentClassifier,
      hasContentEnhancer: !!this.contentEnhancer,
      hasDomainExtractor: !!this.domainExtractor
    });
  }

  isFileSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
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

      const maxSizeBytes = this.maxFileSizeMB * 1024 * 1024;
      if (stats.size > maxSizeBytes) {
        log.warn('File size exceeds limit', {
          filePath,
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(1),
          maxSizeMB: this.maxFileSizeMB
        });
        throw new FileProcessingError(`File too large: ${filePath} (${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds ${this.maxFileSizeMB}MB limit)`);
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
   * Process file with enhanced content classification and domain detection
   * @param filePath Absolute path to the file
   * @returns Enhanced processing result with metadata
   */
  async processFileWithMetadata(filePath: string): Promise<{
    content: string;
    enhancedContent: string;
    metadata: ContentMetadata;
    domains: string[];
  }> {
    const timer = log.time(`enhanced-process-${path.basename(filePath)}`);

    try {
      log.debug('Starting enhanced file processing', { filePath });

      // Extract raw text content
      const rawContent = await this.extractText(filePath);
      
      // Classify content to get type and quality metrics
      const classificationResult = await this.contentClassifier.classifyContent(
        rawContent, 
        filePath, 
        path.extname(filePath)
      );
      
      // Enhance content based on its classification
      const enhancementResult = await this.contentEnhancer.enhanceContent(
        rawContent, 
        classificationResult.classification,
        filePath
      );
      
      // Extract domain information
      const domains = await this.domainExtractor.extractDomainTags(
        enhancementResult.processedContent,
        filePath,
        classificationResult.classification.language
      );
      
      // Get file stats for metadata
      const stats = await fs.stat(filePath);
      
      // Construct comprehensive metadata
      const metadata: ContentMetadata = {
        contentType: classificationResult.classification.contentType,
        language: classificationResult.classification.language,
        domainTags: domains,
        qualityScore: classificationResult.quality.score,
        sourceAuthority: classificationResult.authority.score,
        processedContent: enhancementResult.processedContent,
        rawContent: rawContent,
        fileExtension: path.extname(filePath),
        hasComments: enhancementResult.hasComments,
        hasDocumentation: enhancementResult.hasDocumentation
      };

      timer();
      log.info('Enhanced file processing completed', {
        filePath,
        contentType: classificationResult.classification.contentType,
        language: classificationResult.classification.language,
        qualityScore: classificationResult.quality.score,
        authorityScore: classificationResult.authority.score,
        domains: domains.length,
        originalLength: rawContent.length,
        enhancedLength: enhancementResult.processedContent.length,
        tokenCount: FileProcessor.countTokens(enhancementResult.processedContent)
      });

      return {
        content: rawContent,
        enhancedContent: enhancementResult.processedContent,
        metadata,
        domains
      };

    } catch (error: any) {
      log.error('Enhanced file processing failed', error, { filePath });
      throw error;
    }
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
