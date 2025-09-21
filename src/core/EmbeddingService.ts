import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs-node';
import { DocumentChunk, EmbeddingError } from '../types/index.js';
import { log } from './Logger.js';

export interface EmbeddingConfig {
  modelName?: string;  // For future use if switching models
  batchSize?: number;  // Batch processing size
}

export class EmbeddingService {
  private static instance?: EmbeddingService;
  private static modelPromise?: Promise<use.UniversalSentenceEncoder>;
  private static model?: use.UniversalSentenceEncoder;
  private static isLoading = false;
  
  private config: Required<EmbeddingConfig>;
  private initialized = false;

  private constructor(config: EmbeddingConfig = {}) {
    log.debug('Initializing EmbeddingService singleton', { config });

    this.config = {
      modelName: 'universal-sentence-encoder', // Universal sentence encoder
      batchSize: 32, // USE can handle larger batches
      ...config
    };

    log.debug('EmbeddingService singleton initialized', {
      modelName: this.config.modelName,
      batchSize: this.config.batchSize
    });
  }

  /**
   * Get singleton instance with centralized model loading
   */
  static async getInstance(config: EmbeddingConfig = {}): Promise<EmbeddingService> {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService(config);
    }
    
    // Ensure model is loaded (singleton pattern prevents race conditions)
    await EmbeddingService.instance.ensureModelLoaded();
    
    return EmbeddingService.instance;
  }

  /**
   * Centralized model loading - prevents multiple workers competing for model download
   */
  private async ensureModelLoaded(): Promise<void> {
    if (EmbeddingService.model) {
      this.initialized = true;
      return;
    }

    if (EmbeddingService.isLoading && EmbeddingService.modelPromise) {
      // Another thread is loading, wait for it
      log.debug('Waiting for model loading to complete in another thread');
      EmbeddingService.model = await EmbeddingService.modelPromise;
      this.initialized = true;
      return;
    }

    // This thread takes responsibility for loading
    EmbeddingService.isLoading = true;
    EmbeddingService.modelPromise = this.loadModelSingleton();
    
    try {
      EmbeddingService.model = await EmbeddingService.modelPromise;
      this.initialized = true;
      log.info('Singleton model loading completed successfully');
    } catch (error) {
      EmbeddingService.isLoading = false;
      EmbeddingService.modelPromise = undefined;
      throw error;
    } finally {
      EmbeddingService.isLoading = false;
    }
  }

  /**
   * Singleton model loading implementation
   */
  private async loadModelSingleton(): Promise<use.UniversalSentenceEncoder> {
    const timer = log.time('singleton-embedding-model-init');
    log.info('Starting singleton Universal Sentence Encoder model loading', {
      modelName: this.config.modelName,
      tfBackend: tf.getBackend()
    });

    try {
      const model = await use.load();

      log.info('Singleton Universal Sentence Encoder loaded successfully', {
        dimensions: 512,
        gpuEnabled: tf.getBackend() === 'tensorflow'
      });

      timer();
      return model;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Failed to load singleton Universal Sentence Encoder model', error);

      throw new EmbeddingError(
        `Failed to initialize singleton Universal Sentence Encoder: ${message}`,
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
    const timer = log.time('generate-embeddings');
    log.info('Starting embedding generation', {
      totalChunks: chunks.length,
      batchSize: this.config.batchSize
    });

    await this.ensureModelLoaded();

    if (!EmbeddingService.model) {
      throw new EmbeddingError('Universal Sentence Encoder not initialized');
    }

    try {
      // Process in batches for efficiency
      const results: DocumentChunk[] = [];
      const batchSize = this.config.batchSize;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(chunks.length / batchSize);

        log.debug(`Processing embedding batch ${batchNum}/${totalBatches}`, {
          batchSize: batch.length,
          remainingChunks: chunks.length - i
        });

        const batchEmbeddings = await this.processBatch(batch);
        results.push(...batchEmbeddings);

        log.debug(`Completed embedding batch ${batchNum}/${totalBatches}`, {
          embedCount: batchEmbeddings.length
        });
      }

      log.info('Embedding generation completed', {
        totalEmbeddings: results.length
      });
      timer();

      return results;
    } catch (error: any) {
      log.error('Embedding generation failed', error, { chunkCount: chunks.length });
      throw new EmbeddingError(
        `Embedding generation failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Process a single batch of chunks using Universal Sentence Encoder
   */
  private async processBatch(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (!EmbeddingService.model) {
      throw new EmbeddingError('Model not initialized');
    }

    const texts = chunks.map(chunk => this.prepareText(chunk.content));

    try {
      // Generate embeddings using Universal Sentence Encoder
      const embeddings = await EmbeddingService.model.embed(texts);

      // Extract embedding vectors from TensorFlow tensor
      const embeddingArray = await embeddings.array();

      // Add embeddings to chunks
      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: Array.from(embeddingArray[index] as number[]) // Convert tensor to array
      }));

    } catch (error: any) {
      log.warn('Batch processing failed, processing individually', { batchSize: chunks.length });
      log.error('Batch processing error details', error);

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
          log.warn(`Failed to embed chunk ${chunks[i].id}`, individualError);
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
   * Generate embedding for single text using Universal Sentence Encoder
   */
  private async generateSingleEmbedding(text: string): Promise<number[]> {
    if (!EmbeddingService.model) {
      throw new EmbeddingError('Model not initialized');
    }

    const preparedText = this.prepareText(text);
    const embedding = await EmbeddingService.model.embed([preparedText]);
    const embeddingArray = await embedding.array();

    return Array.from(embeddingArray[0] as number[]);
  }

  /**
   * Prepare text for embedding (truncate, clean)
   */
  private prepareText(text: string): string {
    // Universal Sentence Encoder can handle up to ~512 tokens
    const maxLength = 2000; // Character limit (approximates token limit)
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
    await this.ensureModelLoaded();

    if (!EmbeddingService.model) {
      throw new EmbeddingError('Model not initialized');
    }

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
   * Check if GPU is available (TensorFlow.js will use it automatically if available)
   * @returns GPU availability
   */
  static async isGPUAvailable(): Promise<boolean> {
    try {
      // TensorFlow.js will automatically use GPU if available
      // For Node.js with tfjs-node, GPU support depends on CUDA installation
      return tf.getBackend() === 'tensorflow'; // GPU backend
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
      model: this.config.modelName,
      dimensions: 512, // Universal Sentence Encoder dimension
      gpuEnabled: tf.getBackend() === 'tensorflow'
    };
  }

  /**
   * Clean up TensorFlow resources
   */
  dispose(): void {
    log.debug('Disposing EmbeddingService resources');

    // Clean up TensorFlow resources (static model shared across instances)
    if (EmbeddingService.model) {
      // Universal Sentence Encoder cleanup
      EmbeddingService.model = undefined;
    }

    // Dispose of any remaining Tensors
    tf.disposeVariables();

    this.initialized = false;
    log.info('EmbeddingService disposed');
  }
}
