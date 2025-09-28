import Database from 'better-sqlite3';
import {
  SearchRecommendation,
  RecommendationEffectiveness,
  AdaptiveLearningParams,
  SuggestionStrategy,
  StorageError
} from '../types/index.js';
import { randomUUID } from 'node:crypto';

export class RecommendationRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Store a search recommendation
   * @param recommendation The recommendation to store
   * @returns The stored recommendation with ID
   */
  async storeRecommendation(recommendation: Omit<SearchRecommendation, 'id'>): Promise<SearchRecommendation> {
    try {
      const id = `rec_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 9)}`;
      const now = new Date();

      const stmt = this.db.prepare(`
        INSERT INTO search_recommendations
        (id, query, suggested_terms, suggestion_strategy, tfidf_threshold, confidence,
         generated_at, expires_at, total_documents, analyzed_documents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        recommendation.query,
        JSON.stringify(recommendation.suggestedTerms),
        recommendation.suggestionStrategy,
        recommendation.tfidfThreshold,
        recommendation.confidence,
        recommendation.generatedAt.toISOString(),
        recommendation.expiresAt.toISOString(),
        recommendation.totalDocuments,
        recommendation.analyzedDocuments
      );

      return { ...recommendation, id };
    } catch (error: any) {
      throw new StorageError(
        `Failed to store recommendation: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get cached recommendation for a query
   * @param query The search query
   * @returns Recommendation if found and not expired, null otherwise
   */
  async getRecommendation(query: string): Promise<SearchRecommendation | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, query, suggested_terms, suggestion_strategy, tfidf_threshold,
               confidence, generated_at, expires_at, total_documents, analyzed_documents
        FROM search_recommendations
        WHERE query = ? AND expires_at > datetime('now')
        ORDER BY generated_at DESC
        LIMIT 1
      `);

      const row = stmt.get(query) as any;
      if (!row) return null;

      return {
        id: row.id,
        query: row.query,
        suggestedTerms: JSON.parse(row.suggested_terms),
        suggestionStrategy: row.suggestion_strategy as SuggestionStrategy,
        tfidfThreshold: row.tfidf_threshold,
        confidence: row.confidence,
        generatedAt: new Date(row.generated_at),
        expiresAt: new Date(row.expires_at),
        totalDocuments: row.total_documents,
        analyzedDocuments: row.analyzed_documents
      };
    } catch (error: any) {
      throw new StorageError(
        `Failed to get recommendation: ${error.message}`,
        error
      );
    }
  }

  /**
   * Record effectiveness of a recommendation
   * @param effectiveness The effectiveness data to store
   */
  async recordEffectiveness(effectiveness: RecommendationEffectiveness): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO recommendation_effectiveness
        (recommendation_id, was_used, improved_results, usage_time, effectiveness_score,
         original_result_count, improved_result_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        effectiveness.recommendationId,
        effectiveness.wasUsed ? 1 : 0,
        effectiveness.improvedResults === undefined ? null : (effectiveness.improvedResults ? 1 : 0),
        effectiveness.usageTime?.toISOString() || null,
        effectiveness.effectivenessScore,
        effectiveness.originalResultCount,
        effectiveness.improvedResultCount || null
      );
    } catch (error: any) {
      throw new StorageError(
        `Failed to record effectiveness: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get learning parameters (creates defaults if not exist)
   * @returns Current adaptive learning parameters
   */
  async getLearningParameters(): Promise<AdaptiveLearningParams> {
    try {
      // Try to get existing parameters
      const stmt = this.db.prepare(`
        SELECT current_tfidf_threshold, effectiveness_history, strategy_weights,
               last_updated, learning_rate
        FROM learning_parameters
        WHERE id = 1
      `);

      const row = stmt.get() as any;
      if (row) {
        return {
          currentTfidfThreshold: row.current_tfidf_threshold,
          effectivenessHistory: JSON.parse(row.effectiveness_history),
          strategyWeights: JSON.parse(row.strategy_weights),
          lastUpdated: new Date(row.last_updated),
          learningRate: row.learning_rate
        };
      }

      // Create default parameters
      const defaults = {
        currentTfidfThreshold: 0.25,
        effectivenessHistory: [] as number[],
        strategyWeights: {
          [SuggestionStrategy.TERM_REMOVAL]: 1.0,
          [SuggestionStrategy.TERM_REFINEMENT]: 1.0,
          [SuggestionStrategy.CONTEXTUAL_ADDITION]: 1.0
        } as Record<SuggestionStrategy, number>,
        lastUpdated: new Date(),
        learningRate: 0.05
      };

      const insertStmt = this.db.prepare(`
        INSERT INTO learning_parameters
        (id, current_tfidf_threshold, effectiveness_history, strategy_weights, learning_rate)
        VALUES (1, ?, ?, ?, ?)
      `);

      insertStmt.run(
        defaults.currentTfidfThreshold,
        JSON.stringify(defaults.effectivenessHistory),
        JSON.stringify(defaults.strategyWeights),
        defaults.learningRate
      );

      return defaults;
    } catch (error: any) {
      throw new StorageError(
        `Failed to get learning parameters: ${error.message}`,
        error
      );
    }
  }

  /**
   * Update learning parameters
   * @param params The updated learning parameters
   */
  async updateLearningParameters(params: AdaptiveLearningParams): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE learning_parameters
        SET current_tfidf_threshold = ?, effectiveness_history = ?,
            strategy_weights = ?, last_updated = ?, learning_rate = ?
        WHERE id = 1
      `);

      stmt.run(
        params.currentTfidfThreshold,
        JSON.stringify(params.effectivenessHistory),
        JSON.stringify(params.strategyWeights),
        params.lastUpdated.toISOString(),
        params.learningRate
      );
    } catch (error: any) {
      throw new StorageError(
        `Failed to update learning parameters: ${error.message}`,
        error
      );
    }
  }

  /**
   * Clean up expired recommendations
   * @returns Number of expired recommendations cleaned up
   */
  async cleanupExpiredRecommendations(): Promise<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM search_recommendations WHERE expires_at <= datetime(\'now\')');
      const result = stmt.run();
      return result.changes;
    } catch (error: any) {
      throw new StorageError(
        `Failed to cleanup expired recommendations: ${error.message}`,
        error
      );
    }
  }

  /**
   * Clear all recommendation and learning data
   */
  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM search_recommendations');
      this.db.exec('DELETE FROM recommendation_effectiveness');
      // Keep learning parameters for continuity: DELETE FROM learning_parameters
    } catch (error: any) {
      throw new StorageError(
        `Failed to clear recommendation data: ${error.message}`,
        error
      );
    }
  }
}
