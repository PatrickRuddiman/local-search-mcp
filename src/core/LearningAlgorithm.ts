import { AdaptiveLearningParams, RecommendationEffectiveness, SuggestionStrategy, SearchRecommendation } from '../types/index.js';
import { log } from './Logger.js';

/**
 * Learning algorithm for adaptive search recommendations
 * Tracks effectiveness and adjusts TF-IDF thresholds and strategy weights over time
 */
export class LearningAlgorithm {
  private static readonly MAX_EFFECTIVENESS_HISTORY = 1000;
  private static readonly MIN_LEARNING_RATE = 0.01;
  private static readonly MAX_LEARNING_RATE = 0.1;
  private static readonly TFIDF_THRESHOLD_BOUNDS = { min: 0.1, max: 0.5 };
  
  // Strategy weight adjustment bounds for stable learning
  private static readonly ADJUSTMENT_BOUNDS = { min: -0.1, max: 0.1 };
  private static readonly STRATEGY_WEIGHT_BOUNDS = { min: 0.1, max: 3.0 };
  
  // Threshold adjustment constants for adaptive learning
  private static readonly THRESHOLD_ADJUSTMENT = {
    AGGRESSIVE: -0.02,  // Lower threshold for high effectiveness
    CONSERVATIVE: 0.02  // Higher threshold for low effectiveness
  };

  private params: AdaptiveLearningParams;

  constructor(initialParams?: Partial<AdaptiveLearningParams>) {
    this.params = {
      currentTfidfThreshold: 0.25,
      effectivenessHistory: [],
      strategyWeights: {
        [SuggestionStrategy.TERM_REMOVAL]: 1.0,
        [SuggestionStrategy.TERM_REFINEMENT]: 1.0,
        [SuggestionStrategy.CONTEXTUAL_ADDITION]: 1.0
      },
      lastUpdated: new Date(),
      learningRate: 0.05,
      ...initialParams
    };

    log.info('LearningAlgorithm initialized', {
      threshold: this.params.currentTfidfThreshold,
      learningRate: this.params.learningRate,
      historyLength: this.params.effectivenessHistory.length
    });
  }

  /**
   * Update learning parameters based on recommendation effectiveness
   * @param recommendation The recommendation that was shown
   * @param effectiveness The effectiveness data from user interaction
   */
  async updateFromEffectiveness(
    recommendation: SearchRecommendation,
    effectiveness: RecommendationEffectiveness
  ): Promise<void> {
    log.debug('Processing recommendation effectiveness', {
      recommendationId: recommendation.id,
      wasUsed: effectiveness.wasUsed,
      effectivenessScore: effectiveness.effectivenessScore,
      strategy: recommendation.suggestionStrategy
    });

    // Add to effectiveness history
    this.params.effectivenessHistory.push(effectiveness.effectivenessScore);

    // Maintain history size limit
    if (this.params.effectivenessHistory.length > LearningAlgorithm.MAX_EFFECTIVENESS_HISTORY) {
      this.params.effectivenessHistory = this.params.effectivenessHistory.slice(-LearningAlgorithm.MAX_EFFECTIVENESS_HISTORY);
    }

    // Update strategy weights based on effectiveness
    this.updateStrategyWeights(recommendation.suggestionStrategy, effectiveness.effectivenessScore);

    // Adapt TF-IDF threshold based on recent performance
    this.adaptTfidfThreshold();

    // Update learning rate based on system stability
    this.adjustLearningRate();

    this.params.lastUpdated = new Date();

    log.debug('Learning parameters updated', {
      newThreshold: this.params.currentTfidfThreshold,
      newLearningRate: this.params.learningRate,
      historyLength: this.params.effectivenessHistory.length
    });
  }

  /**
   * Get current learning parameters
   * @returns Current adaptive learning parameters
   */
  getCurrentParams(): AdaptiveLearningParams {
    return { ...this.params };
  }

  /**
   * Check if a search result should trigger recommendation analysis
   * @param resultCount Number of results returned
   * @param averageScore Average similarity score
   * @param queryTerms Number of query terms
   * @returns true if recommendation analysis should be performed
   */
  shouldAnalyzeForRecommendations(
    resultCount: number,
    averageScore: number,
    queryTerms: number
  ): boolean {
    // Criteria for low-confidence searches that would benefit from recommendations

    // 1. Low result count (less than 3 results)
    if (resultCount < 3) {
      return true;
    }

    // 2. Low average similarity score (below adaptive threshold)
    if (averageScore < this.params.currentTfidfThreshold) {
      return true;
    }

    // 3. High term count that might benefit from refinement (more than 5 terms)
    if (queryTerms > 5) {
      return true;
    }

    // 4. Mixed results with inconsistent scores (high variance)
    // This would require score variance calculation in the caller

    return false;
  }

  /**
   * Calculate exponentially weighted moving average of effectiveness
   * @param windowSize Number of recent effectiveness scores to consider
   * @returns EWMA effectiveness score
   */
  getRecentEffectivenessScore(windowSize: number = 50): number {
    if (this.params.effectivenessHistory.length === 0) {
      return 0;
    }

    const recentHistory = this.params.effectivenessHistory.slice(-windowSize);
    if (recentHistory.length === 0) {
      return 0;
    }

    // Exponential weighting with alpha = 0.1 (gives more weight to recent scores)
    const alpha = 0.1;
    let ewma = recentHistory[0];

    for (let i = 1; i < recentHistory.length; i++) {
      ewma = alpha * recentHistory[i] + (1 - alpha) * ewma;
    }

    return ewma;
  }

  /**
   * Get strategy ranking for recommendation prioritization
   * @returns Strategies sorted by effectiveness weight (highest first)
   */
  getStrategyRanking(): SuggestionStrategy[] {
    return Object.entries(this.params.strategyWeights)
      .sort(([, a], [, b]) => b - a)
      .map(([strategy]) => strategy as SuggestionStrategy);
  }

  /**
   * Reset learning parameters to defaults (for testing or after major system changes)
   */
  resetToDefaults(): void {
    this.params = {
      currentTfidfThreshold: 0.25,
      effectivenessHistory: [],
      strategyWeights: {
        [SuggestionStrategy.TERM_REMOVAL]: 1.0,
        [SuggestionStrategy.TERM_REFINEMENT]: 1.0,
        [SuggestionStrategy.CONTEXTUAL_ADDITION]: 1.0
      },
      lastUpdated: new Date(),
      learningRate: 0.05
    };

    log.info('Learning parameters reset to defaults');
  }

  /**
   * Update strategy weights based on recommendation effectiveness
   * @param strategy The strategy used
   * @param effectivenessScore How effective the recommendation was (0-1)
   */
  private updateStrategyWeights(strategy: SuggestionStrategy, effectivenessScore: number): void {
    const adjustment = (effectivenessScore - 0.5) * this.params.learningRate;

    // Bound the adjustment to prevent extreme changes
    const boundedAdjustment = Math.max(
      LearningAlgorithm.ADJUSTMENT_BOUNDS.min, 
      Math.min(LearningAlgorithm.ADJUSTMENT_BOUNDS.max, adjustment)
    );

    this.params.strategyWeights[strategy] += boundedAdjustment;

    // Ensure weights stay in reasonable bounds
    this.params.strategyWeights[strategy] = Math.max(
      LearningAlgorithm.STRATEGY_WEIGHT_BOUNDS.min, 
      Math.min(LearningAlgorithm.STRATEGY_WEIGHT_BOUNDS.max, this.params.strategyWeights[strategy])
    );

    // Normalize weights to maintain relative relationships
    this.normalizeStrategyWeights();

    log.debug('Strategy weights updated', {
      strategy,
      newWeight: this.params.strategyWeights[strategy],
      adjustment: boundedAdjustment
    });
  }

  /**
   * Adapt TF-IDF threshold based on recent effectiveness patterns
   */
  private adaptTfidfThreshold(): void {
    const recentScore = this.getRecentEffectivenessScore(20);

    // If recent effectiveness is high (>0.7), be more aggressive (lower threshold)
    // If recent effectiveness is low (<0.3), be more conservative (higher threshold)
    let thresholdAdjustment = 0;

    if (recentScore > 0.7) {
      thresholdAdjustment = LearningAlgorithm.THRESHOLD_ADJUSTMENT.AGGRESSIVE; // Lower threshold to catch more terms
    } else if (recentScore < 0.3) {
      thresholdAdjustment = LearningAlgorithm.THRESHOLD_ADJUSTMENT.CONSERVATIVE; // Higher threshold to be more selective
    }

    // Apply bounded adjustment
    const newThreshold = this.params.currentTfidfThreshold + thresholdAdjustment;
    this.params.currentTfidfThreshold = Math.max(
      LearningAlgorithm.TFIDF_THRESHOLD_BOUNDS.min,
      Math.min(LearningAlgorithm.TFIDF_THRESHOLD_BOUNDS.max, newThreshold)
    );
  }

  /**
   * Adjust learning rate based on system stability
   */
  private adjustLearningRate(): void {
    const recentVariance = this.calculateRecentVariance(30);

    // If system is stable (low variance), increase learning rate
    // If system is unstable (high variance), decrease learning rate
    let rateAdjustment = 0;

    if (recentVariance < 0.1) {
      rateAdjustment = 0.01; // Increase learning rate for stable system
    } else if (recentVariance > 0.3) {
      rateAdjustment = -0.01; // Decrease learning rate for unstable system
    }

    this.params.learningRate += rateAdjustment;
    this.params.learningRate = Math.max(
      LearningAlgorithm.MIN_LEARNING_RATE,
      Math.min(LearningAlgorithm.MAX_LEARNING_RATE, this.params.learningRate)
    );
  }

  /**
   * Calculate variance in recent effectiveness scores
   * @param windowSize Number of recent scores to analyze
   * @returns Variance (0-1, higher = more unstable)
   */
  private calculateRecentVariance(windowSize: number): number {
    const recent = this.params.effectivenessHistory.slice(-windowSize);
    if (recent.length < 2) {
      return 0;
    }

    const mean = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const variance = recent.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recent.length;

    return Math.min(1, variance); // Cap at 1 for normalization
  }

  /**
   * Normalize strategy weights to maintain their relative relationships
   */
  private normalizeStrategyWeights(): void {
    const weights = Object.values(this.params.strategyWeights);
    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;

    // Scale weights so they center around 1.0 while maintaining relative differences
    const scaleFactor = 1.0 / avgWeight;

    for (const strategy of Object.keys(this.params.strategyWeights) as SuggestionStrategy[]) {
      this.params.strategyWeights[strategy] *= scaleFactor;
    }
  }

  /**
   * Serialize learning state for persistence
   * @returns Serialized learning parameters
   */
  toJSON(): AdaptiveLearningParams {
    return { ...this.params };
  }

  /**
   * Load learning state from serialized data
   * @param data Serialized learning parameters
   */
  static fromJSON(data: AdaptiveLearningParams): LearningAlgorithm {
    return new LearningAlgorithm(data);
  }
}
