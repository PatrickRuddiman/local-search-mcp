import {
  DocumentChunk,
  VectorIndexStatistics,
  SearchRecommendation,
  RecommendationEffectiveness,
  AdaptiveLearningParams
} from '../types/index.js';
import { log } from './Logger.js';
import { DatabaseSchema } from './DatabaseSchema.js';
import { VectorRepository } from './VectorRepository.js';
import { RecommendationRepository } from './RecommendationRepository.js';

export class VectorIndex {
  private schema: DatabaseSchema;
  private repository: VectorRepository;
  private recommendationRepository?: RecommendationRepository;

  constructor(schema: DatabaseSchema, recommendationRepository?: RecommendationRepository) {
    log.debug('Initializing VectorIndex with repository pattern');

    this.schema = schema;
    this.repository = new VectorRepository(
      this.schema.getDatabase(),
      this.schema.getDatabasePath()
    );
    this.recommendationRepository = recommendationRepository;

    log.info('VectorIndex initialized with repository pattern');
  }

  /**
   * Store document chunks with their embeddings
   * @param chunks Array of document chunks
   * @returns Number of chunks stored
   */
  async storeChunks(chunks: DocumentChunk[]): Promise<number> {
    return await this.repository.storeChunks(chunks);
  }

  /**
   * Search for similar chunks using vector similarity search
   * @param queryEmbedding Query embedding vector
   * @param limit Maximum results to return
   * @param minScore Minimum similarity score (0-1)
   * @returns Sorted array of matching chunks with scores
   */
  async searchSimilar(queryEmbedding: number[], limit: number = 10, minScore: number = 0.0): Promise<DocumentChunk[]> {
    return await this.repository.searchSimilar(queryEmbedding, limit, minScore);
  }

  /**
   * Get chunk by ID
   * @param chunkId Chunk identifier
   * @returns DocumentChunk or null if not found
   */
  async getChunk(chunkId: string): Promise<DocumentChunk | null> {
    return await this.repository.getChunk(chunkId);
  }

  /**
   * Get all chunks for a specific file
   * @param filePath File path
   * @returns Array of document chunks
   */
  async getFileChunks(filePath: string): Promise<DocumentChunk[]> {
    return await this.repository.getFileChunks(filePath);
  }

  /**
   * Delete chunks for a specific file
   * @param filePath File path
   * @returns Number of chunks deleted
   */
  async deleteFile(filePath: string): Promise<number> {
    return await this.repository.deleteFile(filePath);
  }

  /**
   * Get index statistics
   * @returns Statistics about the index
   */
  async getStatistics(): Promise<VectorIndexStatistics> {
    return await this.repository.getStatistics();
  }

  /**
   * Clear all vector data from index
   */
  async clear(): Promise<void> {
    await this.repository.clear();
  }

  // Recommendation methods (delegate to recommendationRepository if available)
  async storeRecommendation(recommendation: Omit<SearchRecommendation, 'id'>): Promise<SearchRecommendation> {
    if (!this.recommendationRepository) {
      throw new Error('RecommendationRepository not initialized');
    }
    return await this.recommendationRepository.storeRecommendation(recommendation);
  }

  async getRecommendation(query: string): Promise<SearchRecommendation | null> {
    if (!this.recommendationRepository) {
      return null;
    }
    return await this.recommendationRepository.getRecommendation(query);
  }

  async recordEffectiveness(effectiveness: RecommendationEffectiveness): Promise<void> {
    if (!this.recommendationRepository) {
      return;
    }
    return await this.recommendationRepository.recordEffectiveness(effectiveness);
  }

  async getLearningParameters(): Promise<AdaptiveLearningParams> {
    if (!this.recommendationRepository) {
      throw new Error('RecommendationRepository not initialized');
    }
    return await this.recommendationRepository.getLearningParameters();
  }

  async updateLearningParameters(params: AdaptiveLearningParams): Promise<void> {
    if (!this.recommendationRepository) {
      return;
    }
    return await this.recommendationRepository.updateLearningParameters(params);
  }

  async cleanupExpiredRecommendations(): Promise<number> {
    if (!this.recommendationRepository) {
      return 0;
    }
    return await this.recommendationRepository.cleanupExpiredRecommendations();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.schema.close();
  }
}
