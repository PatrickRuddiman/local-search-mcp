import { DocumentChunk } from '../types/index.js';

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
    this.defaultConfig = {
      chunkSize: 1000,
      overlap: 200,
      method: 'fixed',
      preserveCodeBlocks: true,
      preserveMarkdownHeaders: true,
      ...config
    };
  }

  /**
   * Chunk text into smaller segments
   * @param text Input text to chunk
   * @param filePath Original file path
   * @param config Optional chunking configuration
   * @returns Array of document chunks
   */
  chunkText(text: string, filePath: string, config?: Partial<ChunkingConfig>): DocumentChunk[] {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Pre-process text based on configuration
    const processedText = this.preprocessText(text, mergedConfig);

    // Split text based on method
    const segments = this.splitIntoSegments(processedText, mergedConfig);

    // Create chunks with overlap
    return this.createChunksWithOverlap(segments, filePath, mergedConfig);
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
   * Split text into segments based on method
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
   * Split text into fixed-size chunks
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
   * Create chunks with overlap
   */
  private createChunksWithOverlap(segments: string[], filePath: string, config: Required<ChunkingConfig>): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const processedContent = segments.join(' ');
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < processedContent.length) {
      const endIndex = Math.min(currentIndex + config.chunkSize, processedContent.length);
      const content = processedContent.slice(currentIndex, endIndex);

      // Creat manually to allow for empty embeddings until embedding service processes them
      const chunk: DocumentChunk = {
        id: `${filePath}:${chunkIndex}`,
        filePath,
        chunkIndex,
        content,
        embedding: [], // Will be filled by embedding service
        metadata: {
          fileSize: Buffer.byteLength(processedContent, 'utf-8'),
          lastModified: new Date(),
          chunkOffset: currentIndex,
          tokenCount: Math.ceil(content.length / 4)
        }
      };

      chunks.push(chunk);

      // Calculate next starting position with overlap
      currentIndex = Math.max(currentIndex + config.chunkSize - config.overlap, currentIndex + 1);
      chunkIndex++;
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
