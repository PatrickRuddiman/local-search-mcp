import { EmbeddingService, EmbeddingConfig } from './EmbeddingService.js';
import { VectorIndex } from './VectorIndex.js';
import { RecommendationService } from './RecommendationService.js';
import { RecommendationRepository } from './RecommendationRepository.js';
import { RecommendationEngine } from './RecommendationEngine.js';
import { LearningAlgorithm } from './LearningAlgorithm.js';
import { DatabaseSchema } from './DatabaseSchema.js';
import { log } from './Logger.js';
import {
  DocumentChunkOptimized,
  SearchResult,
  SearchOptions,
  SearchRecommendation,
  RecommendationEffectiveness
} from '../types/index.js';
import * as path from 'path';

export interface SearchServiceConfig {
  embeddingConfig?: EmbeddingConfig;
}

export class SearchService {
  private embeddingService: EmbeddingService | null;
  private vectorIndex: VectorIndex;
  private recommendationService: RecommendationService;
  private recommendationEngine: RecommendationEngine;
  private learningAlgorithm: LearningAlgorithm;
  private config: Required<SearchServiceConfig>;

  constructor(config: SearchServiceConfig = {}) {
    this.config = {
      embeddingConfig: {},
      ...config
    };

    this.embeddingService = null; // Will be initialized async

    // Create shared database schema for all repositories
    const schema = new DatabaseSchema();
    const recommendationRepository = new RecommendationRepository(schema.getDatabase());
    this.recommendationService = new RecommendationService(recommendationRepository);

    this.vectorIndex = new VectorIndex(schema, recommendationRepository);

    // Initialize recommendation system components
    this.recommendationEngine = new RecommendationEngine();
    this.learningAlgorithm = new LearningAlgorithm();

    // Initialize learning parameters from database (async)
    this.initializeLearningParams();

    log.info('SearchService initialized with recommendation system');
  }

  /**
   * Initialize learning parameters from persistent storage
   */
  private async initializeLearningParams(): Promise<void> {
    try {
      const persistedParams = await this.vectorIndex.getLearningParameters();
      if (persistedParams) {
        this.learningAlgorithm = LearningAlgorithm.fromJSON(persistedParams as any);
        log.debug('Learning parameters loaded from database', {
          threshold: persistedParams.currentTfidfThreshold,
          historyLength: persistedParams.effectivenessHistory.length
        });
      }
    } catch (error) {
      log.warn('Failed to load learning parameters, using defaults', error as any);
    }
  }

  /**
   * Ensure EmbeddingService singleton is initialized
   */
  private async ensureEmbeddingService(): Promise<EmbeddingService> {
    if (!this.embeddingService) {
      this.embeddingService = await EmbeddingService.getInstance(this.config.embeddingConfig);
    }
    return this.embeddingService;
  }

  /**
   * Tokenize query into individual terms, preserving quoted phrases
   * @param query The search query
   * @returns Array of query terms
   */
  private tokenizeQuery(query: string): string[] {
    const terms: string[] = [];
    const regex = /"([^"]*)"|(\S+)/g;
    let match;

    while ((match = regex.exec(query.toLowerCase())) !== null) {
      // Use quoted content if present, otherwise the unquoted term
      const term = match[1] || match[2];
      if (term && term.length > 1) { // Skip single characters
        terms.push(term);
      }
    }

    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Search for documents using semantic similarity
   * @param query Natural language query
   * @param options Search configuration
   * @returns Search results with optimized response (no embeddings)
   */
  async searchDocuments(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      log.debug('Executing semantic search query', {
        query: query.substring(0, 50),
        options
      });

      // Generate embedding for the query
      const embeddingService = await this.ensureEmbeddingService();
      const queryEmbedding = await embeddingService.embedQuery(query);

      // Search for similar chunks in the vector index
      const rawResults = await this.vectorIndex.searchSimilar(
        queryEmbedding,
        options.limit || 10,
        options.minScore || 0.0
      );

      const searchTime = Date.now() - startTime;
      const totalResults = rawResults.length;

      // Remove embedding arrays to save context window space
      const optimizedResults: DocumentChunkOptimized[] = rawResults.map(chunk => {
        const { embedding, ...chunkWithoutEmbedding } = chunk;
        return chunkWithoutEmbedding as DocumentChunkOptimized;
      });

      // Calculate average score for recommendation analysis
      const averageScore = optimizedResults.length > 0
        ? optimizedResults.reduce((sum, r) => sum + (r.score || 0), 0) / optimizedResults.length
        : 0;

      // Tokenize query for recommendation analysis
      const queryTerms = this.tokenizeQuery(query);

      // Check if search should trigger recommendation analysis
      const shouldAnalyzeRecommendations = this.learningAlgorithm.shouldAnalyzeForRecommendations(
        totalResults,
        averageScore,
        queryTerms.length
      );

      let contextualRecommendations: SearchRecommendation | undefined = undefined;
      let nextSteps: string[] = [];

      // Generate contextual recommendations if needed (currently synchronous for simplicity)
      if (shouldAnalyzeRecommendations) {
        try {
          // Quick synchronous approximation - get cached recommendation if available
          const cachedRec = await this.vectorIndex.getRecommendation(query);
          if (cachedRec) {
            contextualRecommendations = cachedRec;
        log.debug('Using cached recommendation', {
          recommendationId: cachedRec.id,
          strategy: cachedRec.suggestionStrategy,
          confidence: cachedRec.confidence
        } as any);
          }
        } catch (error) {
          log.warn('Failed to check cached recommendations', error as any);
        }
      }

      // Generate next steps guidance for LLM workflow
      if (optimizedResults.length > 0) {
        const topResult = optimizedResults[0];
        nextSteps.push(
          `For full content of top result: get_file_details({filePath: "${topResult.filePath}", chunkIndex: ${topResult.chunkIndex}})`
        );

        if (optimizedResults.length > 1) {
          const uniqueFiles = [...new Set(optimizedResults.slice(0, 3).map(r => r.filePath))];
          uniqueFiles.forEach(filePath => {
            nextSteps.push(
              `For all chunks in "${path.basename(filePath)}": get_file_details({filePath: "${filePath}"})`
            );
          });
        }

        // Add contextual recommendation next steps
        if (contextualRecommendations) {
          const rec = contextualRecommendations;
          const suggestedQuery = rec.suggestedTerms.join(' ');
          nextSteps.unshift(
            `Recommended refined search: "${suggestedQuery}" (TF-IDF refinement, confidence: ${(rec.confidence * 100).toFixed(1)}%)`
          );
        }
      }

      log.debug('Search query completed', {
        query: query.substring(0, 50),
        totalResults,
        searchTime,
        topScore: optimizedResults[0]?.score || 0,
        recommendationAnalyzed: shouldAnalyzeRecommendations
      });

      return {
        query,
        results: optimizedResults,
        totalResults,
        searchTime,
        options,
        nextSteps,
        recommendation: contextualRecommendations || undefined
      };

    } catch (error: any) {
      log.error('Search query failed', error, {
        query: query.substring(0, 50),
        options
      });

      // Return empty result set on error
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        options,
        nextSteps: []
      };
    }
  }

  /**
   * Get file details and content with context
   * @param filePath Absolute file path
   * @param chunkIndex Optional specific chunk index
   * @param contextSize Number of surrounding chunks to include (default 3)
   * @returns File chunks and content without embeddings
   */
  async getFileDetails(filePath: string, chunkIndex?: number, contextSize: number = 3): Promise<DocumentChunkOptimized[]> {
    try {
      log.debug('Retrieving file details', {
        filePath,
        chunkIndex,
        contextSize
      });

      if (chunkIndex !== undefined) {
        // Get specific chunk with surrounding context
        const allChunks = await this.vectorIndex.getFileChunks(filePath);

        if (allChunks.length === 0) {
          log.debug('No chunks found for file', { filePath });
          return [];
        }

        // Find the target chunk
        const targetChunkIndex = allChunks.findIndex(chunk => chunk.chunkIndex === chunkIndex);

        if (targetChunkIndex === -1) {
          log.debug('Target chunk not found', { filePath, chunkIndex });
          return [];
        }

        // Calculate context window
        const startIndex = Math.max(0, targetChunkIndex - contextSize);
        const endIndex = Math.min(allChunks.length - 1, targetChunkIndex + contextSize);

        // Get context chunks
        const contextChunks = allChunks.slice(startIndex, endIndex + 1);

        log.debug('Retrieved file details with context', {
          filePath,
          chunkIndex,
          totalChunks: allChunks.length,
          returnedChunks: contextChunks.length,
          contextWindow: [startIndex, endIndex]
        });

        // Remove embeddings and return optimized chunks
        return contextChunks.map(chunk => {
          const { embedding, ...chunkWithoutEmbedding } = chunk;
          return chunkWithoutEmbedding as DocumentChunkOptimized;
        });
      } else {
        // Get all chunks for the file (without embeddings)
        const chunks = await this.vectorIndex.getFileChunks(filePath);

        log.debug('Retrieved all file details', {
          filePath,
          totalChunks: chunks.length
        });

        return chunks.map(chunk => {
          const { embedding, ...chunkWithoutEmbedding } = chunk;
          return chunkWithoutEmbedding as DocumentChunkOptimized;
        });
      }
    } catch (error: any) {
      log.error('Failed to get file details', error, { filePath, chunkIndex });
      return [];
    }
  }

  /**
   * Get index statistics
   * @returns Index statistics
   */
  async getStatistics() {
    try {
      log.debug('Retrieving index statistics');
      const stats = await this.vectorIndex.getStatistics();

      log.debug('Index statistics retrieved', {
        totalChunks: stats.totalChunks,
        totalFiles: stats.totalFiles,
        totalTokens: stats.totalTokens
      });

      return stats;
    } catch (error: any) {
      log.error('Failed to get statistics', error);
      return {
        totalChunks: 0,
        totalFiles: 0,
        totalTokens: 0,
        embeddingModel: 'unknown',
        lastUpdated: new Date(),
        dbSize: 0
      };
    }
  }

  /**
   * Check if embedding service is ready
   * @returns true if embedding service is initialized
   */
  async isReady(): Promise<boolean> {
    try {
      await this.ensureEmbeddingService();
      return true;
    } catch (error: any) {
      log.error('SearchService not ready', error);
      return false;
    }
  }

  /**
   * Get search service configuration
   */
  getConfig(): SearchServiceConfig {
    return this.config;
  }

  /**
   * Close all resources
   */
  dispose(): void {
    try {
      log.debug('Disposing SearchService resources');

      this.vectorIndex.close();

      if (this.embeddingService) {
        // Note: Don't dispose the singleton EmbeddingService here
        this.embeddingService = null;
      }

      log.info('SearchService disposed');
    } catch (error: any) {
      log.error('Error disposing SearchService resources', error);
    }
  }
}
