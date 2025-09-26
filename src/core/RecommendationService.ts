import {
  SearchRecommendation,
  RecommendationEffectiveness,
  AdaptiveLearningParams
} from '../types/index.js';
import { RecommendationRepository } from './RecommendationRepository.js';

export class RecommendationService {
  private repository: RecommendationRepository;

  constructor(repository: RecommendationRepository) {
    this.repository = repository;
  }

  /**
   * Store a search recommendation
   * @param recommendation The recommendation to store
   * @returns The stored recommendation with ID
   */
  async storeRecommendation(recommendation: Omit<SearchRecommendation, 'id'>): Promise<SearchRecommendation> {
    return await this.repository.storeRecommendation(recommendation);
  }

  /**
   * Get cached recommendation for a query
   * @param query The search query
   * @returns Recommendation if found and not expired, null otherwise
   */
  async getRecommendation(query: string): Promise<SearchRecommendation | null> {
    return await this.repository.getRecommendation(query);
  }

  /**
   * Record effectiveness of a recommendation
   * @param effectiveness The effectiveness data to store
   */
  async recordEffectiveness(effectiveness: RecommendationEffectiveness): Promise<void> {
    await this.repository.recordEffectiveness(effectiveness);
  }

  /**
   * Get learning parameters (creates defaults if not exist)
   * @returns Current adaptive learning parameters
   */
  async getLearningParameters(): Promise<AdaptiveLearningParams> {
    return await this.repository.getLearningParameters();
  }

  /**
   * Update learning parameters
   * @param params The updated learning parameters
   */
  async updateLearningParameters(params: AdaptiveLearningParams): Promise<void> {
    await this.repository.updateLearningParameters(params);
  }

  /**
   * Clean up expired recommendations
   * @returns Number of expired recommendations cleaned up
   */
  async cleanupExpiredRecommendations(): Promise<number> {
    return await this.repository.cleanupExpiredRecommendations();
  }

  /**
   * Clear all recommendation and learning data
   */
  async clear(): Promise<void> {
    await this.repository.clear();
  }
}
