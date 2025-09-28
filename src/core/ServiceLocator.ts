import { DatabaseSchema } from './DatabaseSchema.js';
import { VectorIndex } from './VectorIndex.js';
import { RecommendationRepository } from './RecommendationRepository.js';
import { log } from './Logger.js';

/**
 * Service locator pattern to manage shared instances and avoid inefficient recreation
 * Addresses code review comment about creating new instances for each operation
 */
export class ServiceLocator {
  private static instance: ServiceLocator;
  private databaseSchema: DatabaseSchema | null = null;
  private vectorIndex: VectorIndex | null = null;
  private recommendationRepository: RecommendationRepository | null = null;

  private constructor() {
    log.debug('ServiceLocator initialized');
  }

  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  /**
   * Get shared DatabaseSchema instance
   * Creates once and reuses for efficiency
   */
  getDatabaseSchema(): DatabaseSchema {
    if (!this.databaseSchema) {
      this.databaseSchema = new DatabaseSchema();
      log.debug('DatabaseSchema instance created and cached');
    }
    return this.databaseSchema;
  }

  /**
   * Get shared VectorIndex instance
   * Creates once and reuses for efficiency
   */
  getVectorIndex(): VectorIndex {
    if (!this.vectorIndex) {
      const schema = this.getDatabaseSchema();
      const recommendationRepo = this.getRecommendationRepository();
      this.vectorIndex = new VectorIndex(schema, recommendationRepo);
      log.debug('VectorIndex instance created and cached');
    }
    return this.vectorIndex;
  }

  /**
   * Get shared RecommendationRepository instance
   * Creates once and reuses for efficiency
   */
  getRecommendationRepository(): RecommendationRepository {
    if (!this.recommendationRepository) {
      const schema = this.getDatabaseSchema();
      this.recommendationRepository = new RecommendationRepository(schema.getDatabase());
      log.debug('RecommendationRepository instance created and cached');
    }
    return this.recommendationRepository;
  }

  /**
   * Clean up all instances
   * Call this when shutting down the application
   */
  dispose(): void {
    try {
      if (this.vectorIndex) {
        this.vectorIndex.close();
        this.vectorIndex = null;
      }

      if (this.databaseSchema) {
        this.databaseSchema.close();
        this.databaseSchema = null;
      }

      this.recommendationRepository = null;

      log.info('ServiceLocator disposed all instances');
    } catch (error: any) {
      log.error('Error disposing ServiceLocator instances', error);
    }
  }

  /**
   * Reset all instances (useful for testing or configuration changes)
   */
  reset(): void {
    this.dispose();
    log.info('ServiceLocator reset - instances will be recreated on next access');
  }

  /**
   * Get statistics about cached instances
   */
  getInstanceStats(): {
    databaseSchemaCreated: boolean;
    vectorIndexCreated: boolean;
    recommendationRepositoryCreated: boolean;
  } {
    return {
      databaseSchemaCreated: this.databaseSchema !== null,
      vectorIndexCreated: this.vectorIndex !== null,
      recommendationRepositoryCreated: this.recommendationRepository !== null
    };
  }
}
