import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { DocumentChunk, EmbeddingError } from '../types/index.js';

export interface EmbeddingConfig {
  model?: string;
  useGPU?: boolean;
  batchSize?: number;
  poolingMethod?: 'mean' | 'cls';
  normalize?: boolean;
}

export class EmbeddingService {
  private extractor?: FeatureExtractionPipeline;
  private config: Required<EmbeddingConfig>;
  private initialized = false;

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      model: 'Xenova/paraphrase-multilingual-minilm-l12-v2', // Smaller, multilingual model
      useGPU: true,
      batchSize: 16,
      poolingMethod: 'mean' as const,
      normalize: true,
      ...config
    };
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    try {
      this.extractor = await pipeline('feature-extraction', this.config.model);
      this.initialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EmbeddingError(
        `Failed to initialize embedding model: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate embeddings for text chunks
   * @param chunks Array of document chunks
   * @returns Chunks with embeddings added
   */
  async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.extractor) {
      throw new EmbeddingError('Embedding extractor not initialized');
    }

    try {
      // Process in batches for efficiency
      const results: DocumentChunk[] = [];
      const batchSize = this.config.batchSize;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchEmbeddings = await this.processBatch(batch);
        results.push(...batchEmbeddings);
      }

      return results;
    } catch (error: any) {
      throw new EmbeddingError(
        `Embedding generation failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Process a single batch of chunks
   */
  private async processBatch(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const texts = chunks.map(chunk => this.prepareText(chunk.content));

    try {
      // Generate embeddings for batch
      const outputs = await this.extractor!(texts, {
        pooling: this.config.poolingMethod,
        normalize: this.config.normalize
      });

      // Extract embedding vectors and update chunks
      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: Array.from((outputs as any)[index].data as any) // Convert Tensor to array
      }));
    } catch (error: any) {
      console.warn('Batch processing failed, processing individually:', error.message);

      // Fallback: process individually
      const results: DocumentChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await this.generateSingleEmbedding(chunks[i].content);
          results.push({
            ...chunks[i],
            embedding
          });
        } catch (individualError: any) {
          console.warn(`Failed to embed chunk ${chunks[i].id}:`, individualError.message);
          // Add chunk with empty embedding - will be handled by search service
          results.push({
            ...chunks[i],
            embedding: []
          });
        }
      }
      return results;
    }
  }

  /**
   * Generate embedding for single text
   */
  private async generateSingleEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new EmbeddingError('Extractor not initialized');
    }

    const preparedText = this.prepareText(text);
    const output = await this.extractor(preparedText, {
      pooling: this.config.poolingMethod,
      normalize: this.config.normalize
    });

    return Array.from(output.data);
  }

  /**
   * Prepare text for embedding (truncate, clean)
   */
  private prepareText(text: string): string {
    // Truncate very long texts (model has limits)
    const maxLength = 512; // Conservative limit for transformer models
    let prepared = text.trim();

    if (prepared.length > maxLength) {
      prepared = prepared.substring(0, maxLength - 3) + '...';
    }

    // Remove excessive whitespace
    prepared = prepared.replace(/\s+/g, ' ');

    return prepared;
  }

  /**
   * Create embedding for query text
   * @param query Search query
   * @returns Query embedding vector
   */
  async embedQuery(query: string): Promise<number[]> {
    return await this.generateSingleEmbedding(query);
  }

  /**
   * Cosine similarity calculation
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity score
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector lengths must match');
    }

    if (vec1.length === 0) {
      return 0; // Handle empty embeddings
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Check if GPU is available
   * @returns GPU availability
   */
  static async isGPUAvailable(): Promise<boolean> {
    try {
      // Simple heuristic - in production, you'd check more thoroughly
      return typeof (globalThis as any).navigator !== 'undefined' &&
             (globalThis as any).navigator.hardwareConcurrency > 2;
    } catch {
      return false;
    }
  }

  /**
   * Get current model info
   * @returns Model information
   */
  getModelInfo(): { model: string; dimensions: number; gpuEnabled: boolean } {
    return {
      model: this.config.model,
      dimensions: 384, // Known dimension for sentence transformers
      gpuEnabled: this.config.useGPU
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clean up model resources if needed
    if (this.extractor) {
      // Transformers usually handle cleanup automatically
      this.extractor = undefined;
    }
    this.initialized = false;
  }
}
