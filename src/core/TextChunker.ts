import path from 'path';
import { DocumentChunk } from '../types/index.js';
import { log } from './Logger.js';

export interface ChunkingConfig {
  chunkSize?: number;
  overlap?: number;
  method?: 'fixed' | 'sentence-aware' | 'paragraph-aware';
  preserveCodeBlocks?: boolean;
  preserveMarkdownHeaders?: boolean;
}

export class TextChunker {
  private defaultConfig: Required<ChunkingConfig>;

  constructor(config: ChunkingConfig = {}) {
    log.debug('Initializing TextChunker', { config });

    this.defaultConfig = {
      chunkSize: 1000,
      overlap: 200,
      method: 'fixed',
      preserveCodeBlocks: true,
      preserveMarkdownHeaders: true,
      ...config
    };

    log.debug('TextChunker initialized successfully', this.defaultConfig);
  }

  /**
   * Splits text into document chunks with optional event loop yielding for large files
   */
  async chunkText(text: string, filePath: string, config?: Partial<ChunkingConfig>): Promise<DocumentChunk[]> {
    const timer = log.time(`chunk-text-${path.basename(filePath)}`);
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      const processedText = this.preprocessText(text, mergedConfig);
      const segments = await this.splitIntoSegmentsAsync(processedText, mergedConfig);
      const chunks = await this.createChunksWithOverlapAsync(segments, filePath, mergedConfig);

      timer();
      log.info('Text chunking completed', {
        filePath,
        originalTextLength: text.length,
        chunksCreated: chunks.length,
        totalTokens: chunks.reduce((sum, c) => sum + c.metadata.tokenCount, 0)
      });

      return chunks;
    } catch (error: any) {
      log.error('Text chunking failed', error, { filePath, textLength: text.length });
      throw error;
    }
  }

  /**
   * Pre-process text before chunking
   */
  private preprocessText(text: string, config: Required<ChunkingConfig>): string {
    let processed = text;

    // Handle special content based on configuration
    if (config.preserveCodeBlocks && config.method === 'sentence-aware') {
      processed = this.preserveBlockContent(processed, '```', '```');
    }

    if (config.preserveMarkdownHeaders) {
      processed = this.preserveHeaderStructure(processed);
    }

    return processed;
  }

  /**
   * Preserve block content by replacing with placeholders
   */
  private preserveBlockContent(text: string, startMarker: string, endMarker: string): string {
    const preservedBlocks: string[] = [];
    let placeholderIndex = 0;

    return text.replace(
      new RegExp(`${this.escapeRegExp(startMarker)}([\\s\\S]*?)${this.escapeRegExp(endMarker)}`, 'g'),
      (match) => {
        preservedBlocks.push(match);
        const placeholder = `__PRESERVED_BLOCK_${placeholderIndex}__`;
        placeholderIndex++;
        return placeholder;
      }
    );
  }

  /**
   * Preserve markdown header structure
   */
  private preserveHeaderStructure(text: string): string {
    // Simple header preservation - in production could be more sophisticated
    return text;
  }

  /**
   * Split text into segments based on method with event loop yielding
   */
  private async splitIntoSegmentsAsync(text: string, config: Required<ChunkingConfig>): Promise<string[]> {
    switch (config.method) {
      case 'sentence-aware':
        return await this.splitBySentencesAsync(text);
      case 'paragraph-aware':
        return await this.splitByParagraphsAsync(text);
      default:
        return await this.splitFixedSizeAsync(text, config.chunkSize);
    }
  }

  /**
   * Split text into segments based on method (sync version for backward compatibility)
   */
  private splitIntoSegments(text: string, config: Required<ChunkingConfig>): string[] {
    switch (config.method) {
      case 'sentence-aware':
        return this.splitBySentences(text);
      case 'paragraph-aware':
        return this.splitByParagraphs(text);
      default:
        return this.splitFixedSize(text, config.chunkSize);
    }
  }

  /**
   * Split text by sentences
   */
  private splitBySentences(text: string): string[] {
    // Basic sentence splitting - in production use a proper NLP library
    const sentences = text.split(/[.!?]+\s+/);
    return sentences.filter(s => s.trim().length > 0);
  }

  /**
   * Split text by paragraphs
   */
  private splitByParagraphs(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs.filter(p => p.trim().length > 0);
  }

  /**
   * Split text into fixed-size chunks with event loop yielding for large files
   */
  private async splitFixedSizeAsync(text: string, size: number): Promise<string[]> {
    const chunks: string[] = [];
    let currentIndex = 0;
    let processedChunks = 0;

    while (currentIndex < text.length) {
      const endIndex = Math.min(currentIndex + size, text.length);
      const chunk = text.slice(currentIndex, endIndex);

      // Try to find a good breaking point (sentence or word boundary)
      const adjustedChunk = this.findGoodBreakpoint(chunk, text, currentIndex, size);

      chunks.push(adjustedChunk);
      currentIndex += adjustedChunk.length;
      processedChunks++;

      // Yield control every 1000 chunks to prevent blocking
      if (processedChunks % 1000 === 0) {
        log.debug(`Processed ${processedChunks} text segments, yielding control`);
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return chunks;
  }

  /**
   * Split text by sentences with event loop yielding
   */
  private async splitBySentencesAsync(text: string): Promise<string[]> {
    // For sentence splitting, yield periodically for very large texts
    const sentences = text.split(/[.!?]+\s+/);

    if (sentences.length > 10000) {
      log.debug(`Processing ${sentences.length} sentences with yielding`);
      await new Promise(resolve => setImmediate(resolve));
    }

    return sentences.filter(s => s.trim().length > 0);
  }

  /**
   * Split text by paragraphs with event loop yielding
   */
  private async splitByParagraphsAsync(text: string): Promise<string[]> {
    // For paragraph splitting, yield periodically for very large texts
    const paragraphs = text.split(/\n\s*\n/);

    if (paragraphs.length > 5000) {
      log.debug(`Processing ${paragraphs.length} paragraphs with yielding`);
      await new Promise(resolve => setImmediate(resolve));
    }

    return paragraphs.filter(p => p.trim().length > 0);
  }

  /**
   * Split text into fixed-size chunks (sync version)
   */
  private splitFixedSize(text: string, size: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      const endIndex = Math.min(currentIndex + size, text.length);
      const chunk = text.slice(currentIndex, endIndex);

      // Try to find a good breaking point (sentence or word boundary)
      const adjustedChunk = this.findGoodBreakpoint(chunk, text, currentIndex, size);

      chunks.push(adjustedChunk);
      currentIndex += adjustedChunk.length;
    }

    return chunks;
  }

  /**
   * Find a good breaking point in chunk
   */
  private findGoodBreakpoint(chunk: string, original: string, startIndex: number, targetSize: number): string {
    if (chunk.length <= targetSize * 0.8) {
      return chunk; // Small chunk, keep as is
    }

    // Look for sentence endings first
    const lastSentenceEnd = Math.max(
      chunk.lastIndexOf('.'),
      chunk.lastIndexOf('!'),
      chunk.lastIndexOf('?')
    );

    if (lastSentenceEnd > targetSize * 0.5) {
      return chunk.substring(0, lastSentenceEnd + 1);
    }

    // Look for word boundaries
    const lastSpace = chunk.lastIndexOf(' ');
    if (lastSpace > targetSize * 0.3) {
      return chunk.substring(0, lastSpace);
    }

    // Fall back to character boundary at target size
    return chunk.substring(0, Math.min(targetSize, chunk.length));
  }

  /**
   * Create chunks with overlap and event loop yielding for large files
   */
  private async createChunksWithOverlapAsync(segments: string[], filePath: string, config: Required<ChunkingConfig>): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const processedContent = segments.join(' ');
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < processedContent.length) {
      const endIndex = Math.min(currentIndex + config.chunkSize, processedContent.length);
      const content = processedContent.slice(currentIndex, endIndex);

      // Create chunk with guaranteed integer data types
      const chunk: DocumentChunk = {
        id: `${filePath}:${chunkIndex}`,
        filePath,
        chunkIndex: Math.floor(chunkIndex), // Ensure integer
        content,
        embedding: [], // Will be filled by embedding service
        metadata: {
          fileSize: Buffer.byteLength(processedContent, 'utf-8'),
          lastModified: new Date(),
          chunkOffset: Math.floor(currentIndex), // Ensure integer
          tokenCount: Math.ceil(content.length / 4) // Already integer from Math.ceil
        }
      };

      chunks.push(chunk);

      // Calculate next starting position with overlap (ensure integer)
      currentIndex = Math.floor(Math.max(currentIndex + config.chunkSize - config.overlap, currentIndex + 1));
      chunkIndex = Math.floor(chunkIndex + 1); // Ensure integer increment

      // Yield control every 1000 chunks to prevent blocking main thread
      if (chunkIndex % 1000 === 0) {
        log.debug(`Created ${chunkIndex} chunks, yielding control to event loop`);
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return chunks;
  }

  /**
   * Create chunks with overlap (sync version for backward compatibility)
   */
  private createChunksWithOverlap(segments: string[], filePath: string, config: Required<ChunkingConfig>): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const processedContent = segments.join(' ');
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < processedContent.length) {
      const endIndex = Math.min(currentIndex + config.chunkSize, processedContent.length);
      const content = processedContent.slice(currentIndex, endIndex);

      // Create chunk with guaranteed integer data types
      const chunk: DocumentChunk = {
        id: `${filePath}:${chunkIndex}`,
        filePath,
        chunkIndex: Math.floor(chunkIndex), // Ensure integer
        content,
        embedding: [], // Will be filled by embedding service
        metadata: {
          fileSize: Buffer.byteLength(processedContent, 'utf-8'),
          lastModified: new Date(),
          chunkOffset: Math.floor(currentIndex), // Ensure integer
          tokenCount: Math.ceil(content.length / 4) // Already integer from Math.ceil
        }
      };

      chunks.push(chunk);

      // Calculate next starting position with overlap (ensure integer)
      currentIndex = Math.floor(Math.max(currentIndex + config.chunkSize - config.overlap, currentIndex + 1));
      chunkIndex = Math.floor(chunkIndex + 1); // Ensure integer increment
    }

    return chunks;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
