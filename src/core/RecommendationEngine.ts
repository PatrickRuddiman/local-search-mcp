import { DocumentChunkOptimized, TfidfAnalysisResult, SearchRecommendation, SuggestionStrategy } from '../types/index.js';
import { log } from './Logger.js';

export interface RecommendationEngineConfig {
  maxQueryTerms?: number;
  maxAnalysisDocuments?: number;
}

/**
 * TF-IDF based contextual search recommendation engine
 * Analyzes low-confidence search results and generates intelligent query suggestions
 */
export class RecommendationEngine {
  private static readonly DEFAULT_MAX_ANALYSIS_DOCUMENTS = 5;
  private static readonly DEFAULT_MAX_QUERY_TERMS = 8; // Reduced from 50 to more practical value
  private static readonly TFIDF_FORMULA = 'score = TF × log((docCount + 1) / (DF + 1))';

  private readonly maxQueryTerms: number;
  private readonly maxAnalysisDocuments: number;

  constructor(config: RecommendationEngineConfig = {}) {
    this.maxQueryTerms = config.maxQueryTerms ?? RecommendationEngine.DEFAULT_MAX_QUERY_TERMS;
    this.maxAnalysisDocuments = config.maxAnalysisDocuments ?? RecommendationEngine.DEFAULT_MAX_ANALYSIS_DOCUMENTS;

    // Validate configuration
    if (this.maxQueryTerms < 1 || this.maxQueryTerms > 100) {
      throw new Error(`maxQueryTerms must be between 1 and 100, got ${this.maxQueryTerms}`);
    }
    if (this.maxAnalysisDocuments < 1 || this.maxAnalysisDocuments > 50) {
      throw new Error(`maxAnalysisDocuments must be between 1 and 50, got ${this.maxAnalysisDocuments}`);
    }

    log.debug('RecommendationEngine initialized', {
      maxQueryTerms: this.maxQueryTerms,
      maxAnalysisDocuments: this.maxAnalysisDocuments
    });
  }

  /**
   * Analyze low-confidence search results and generate contextual recommendations
   * @param query Original user query
   * @param results Search results (presumed low-confidence)
   * @param totalDocuments Total documents in the index
   * @param currentThreshold Current TF-IDF threshold from learning system
   * @returns Analysis results with suggested query modifications
   */
  async analyzeForRecommendations(
    query: string,
    results: DocumentChunkOptimized[],
    totalDocuments: number,
    currentThreshold: number
  ): Promise<Omit<SearchRecommendation, 'id'> | null> {
    const timer = log.time('tfidf-analysis');

    try {
      // Limit analysis to top results for performance
      const analysisResults = results.slice(0, this.maxAnalysisDocuments);

      if (analysisResults.length === 0) {
        log.debug('No results to analyze for recommendations');
        return null;
      }

      // Extract and tokenize query terms
      const queryTerms = this.tokenizeQuery(query);
      if (queryTerms.length === 0 || queryTerms.length > this.maxQueryTerms) {
        log.debug('Query has no terms or too many terms for analysis', { 
          termCount: queryTerms.length,
          maxAllowed: this.maxQueryTerms 
        });
        return null;
      }

      log.debug('Starting TF-IDF analysis', {
        query: query.substring(0, 50),
        resultCount: analysisResults.length,
        queryTerms: queryTerms.length,
        totalDocuments,
        currentThreshold
      });

      // Calculate TF-IDF scores for each term across the result documents
      const tfidfResults = this.calculateTfidfAnalysis(queryTerms, analysisResults, totalDocuments);

      // Generate recommendations based on TF-IDF analysis
      const recommendation = this.generateRecommendation(query, queryTerms, tfidfResults, currentThreshold);

      timer();

      if (recommendation) {
        log.info('Generated contextual recommendation', {
          strategy: recommendation.suggestionStrategy,
          confidence: recommendation.confidence,
          suggestedTermCount: recommendation.suggestedTerms.length
        });
      } else {
        log.debug('No recommendation generated for query');
      }

      return recommendation;

    } catch (error: any) {
      log.error('TF-IDF analysis failed', error, { query: query.substring(0, 50) });
      return null;
    }
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
   * Calculate TF-IDF analysis for query terms across result documents
   * @param queryTerms Tokenized query terms
   * @param results Top search results to analyze
   * @param totalDocuments Total documents in index
   * @returns TF-IDF analysis results for each term
   */
  private calculateTfidfAnalysis(
    queryTerms: string[],
    results: DocumentChunkOptimized[],
    totalDocuments: number
  ): TfidfAnalysisResult[] {
    const termAnalysis: TfidfAnalysisResult[] = [];

    for (const term of queryTerms) {
      // Calculate document frequency (DF): how many result documents contain this term
      let df = 0;
      let totalTf = 0;

      for (const result of results) {
        const content = result.content.toLowerCase();
        const occurrences = (content.match(new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'g')) || []).length;

        if (occurrences > 0) {
          df++;
          totalTf += occurrences;
        }
      }

      // Calculate average TF across documents that contain the term
      const avgTf = df > 0 ? totalTf / df : 0;

      // Apply TF-IDF formula: TF × log((N + 1) / (DF + 1))
      // Using +1 smoothing to avoid division by zero and reduce impact of rare terms
      const tfidf = avgTf * Math.log((totalDocuments + 1) / (df + 1));

      // Determine if term should be removed based on TF-IDF score
      const shouldRemove = tfidf < 1.0; // Conservative threshold
      const confidence = Math.max(0, Math.min(1, tfidf / 5.0)); // Normalize confidence to 0-1

      termAnalysis.push({
        term,
        tf: avgTf,
        df,
        tfidf,
        shouldRemove,
        confidence
      });
    }

    // Sort by TF-IDF score (lowest first - most likely to cause issues)
    return termAnalysis.sort((a, b) => a.tfidf - b.tfidf);
  }

  /**
   * Generate a contextual recommendation based on TF-IDF analysis
   * @param originalQuery The original query
   * @param queryTerms Tokenized terms
   * @param tfidfResults TF-IDF analysis results
   * @param currentThreshold Current learning threshold
   * @returns Recommendation or null if no good suggestions
   */
  private generateRecommendation(
    originalQuery: string,
    queryTerms: string[],
    tfidfResults: TfidfAnalysisResult[],
    currentThreshold: number
  ): Omit<SearchRecommendation, 'id'> | null {

    // Safety check: never remove all terms
    const removableTerms = tfidfResults.filter(r =>
      r.shouldRemove &&
      r.tfidf < currentThreshold &&
      !this.isEssentialTerm(r.term, originalQuery)
    );

    if (removableTerms.length === 0) {
      return null;
    }

    // Find the most problematic term (lowest TF-IDF score)
    const mostProblematicTerm = removableTerms[0];

    // Strategy 1: Term removal - safest approach
    if (this.canSafelyRemoveTerm(mostProblematicTerm.term, queryTerms)) {
      const suggestedTerms = queryTerms.filter(t => t !== mostProblematicTerm.term);

      return {
        query: originalQuery,
        suggestedTerms,
        suggestionStrategy: SuggestionStrategy.TERM_REMOVAL,
        tfidfThreshold: currentThreshold,
        confidence: mostProblematicTerm.confidence,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        totalDocuments: 0, // Will be set by caller
        analyzedDocuments: tfidfResults.length
      };
    }

    // Strategy 2: Term refinement - replace with more specific term
    const refinedSuggestion = this.generateRefinedTerm(mostProblematicTerm.term, tfidfResults);
    if (refinedSuggestion) {
      return {
        query: originalQuery,
        suggestedTerms: [refinedSuggestion],
        suggestionStrategy: SuggestionStrategy.TERM_REFINEMENT,
        tfidfThreshold: currentThreshold,
        confidence: 0.7, // Moderate confidence for refinements
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalDocuments: 0,
        analyzedDocuments: tfidfResults.length
      };
    }

    // Strategy 3: Contextual addition - add clarifying terms
    const contextualTerms = this.suggestContextualTerms(mostProblematicTerm.term, tfidfResults);
    if (contextualTerms.length > 0) {
      const combinedTerms = [...queryTerms, ...contextualTerms];

      return {
        query: originalQuery,
        suggestedTerms: combinedTerms,
        suggestionStrategy: SuggestionStrategy.CONTEXTUAL_ADDITION,
        tfidfThreshold: currentThreshold,
        confidence: 0.6, // Lower confidence for additions
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalDocuments: 0,
        analyzedDocuments: tfidfResults.length
      };
    }

    return null;
  }

  /**
   * Check if a term is essential and shouldn't be removed
   * @param term The term to check
   * @param originalQuery The original query string
   * @returns true if term is essential
   */
  private isEssentialTerm(term: string, originalQuery: string): boolean {
    // Keep terms that are in quotes (phrase searches)
    if (originalQuery.includes(`"${term}"`)) {
      return true;
    }

    // Keep very common programming terms
    const essentialTerms = ['function', 'class', 'method', 'variable', 'import', 'export', 'async', 'await', 'return', 'const', 'let', 'var'];
    return essentialTerms.includes(term.toLowerCase());
  }

  /**
   * Check if a term can be safely removed without making the query meaningless
   * @param termToRemove The term being considered for removal
   * @param allTerms All query terms
   * @returns true if safe to remove
   */
  private canSafelyRemoveTerm(termToRemove: string, allTerms: string[]): boolean {
    // Keep at least 2 terms to maintain query specificity
    return allTerms.length > 2;
  }

  /**
   * Generate a refined version of a problematic term
   * @param problematicTerm The term causing issues
   * @param tfidfResults All TF-IDF results for context
   * @returns Refined term suggestion or null
   */
  private generateRefinedTerm(problematicTerm: string, tfidfResults: TfidfAnalysisResult[]): string | null {
    // Look for better-performing related terms in the results
    const betterTerms = tfidfResults
      .filter(r => !r.shouldRemove && r.tfidf > 2.0) // Good TF-IDF scores
      .filter(r => this.areTermsRelated(r.term, problematicTerm))
      .sort((a, b) => b.tfidf - a.tfidf);

    return betterTerms.length > 0 ? betterTerms[0].term : null;
  }

  /**
   * Suggest contextual terms to add for clarification
   * @param problematicTerm The term causing ambiguity
   * @param tfidfResults All TF-IDF results
   * @returns Array of contextual terms to add
   */
  private suggestContextualTerms(problematicTerm: string, tfidfResults: TfidfAnalysisResult[]): string[] {
    // Find terms that appear in multiple highly-ranked results
    const highScoringTerms = tfidfResults
      .filter(r => r.tfidf > 3.0 && r.df >= 2) // Good TF-IDF and appears in multiple docs
      .filter(r => r.term !== problematicTerm)
      .slice(0, 2); // Limit to 2 contextual terms

    return highScoringTerms.map(r => r.term);
  }

  /**
   * Check if two terms are semantically related
   * @param term1 First term
   * @param term2 Second term
   * @returns true if terms are related
   */
  private areTermsRelated(term1: string, term2: string): boolean {
    // Simple heuristic: check for common prefixes/suffixes or substring relationships
    const lower1 = term1.toLowerCase();
    const lower2 = term2.toLowerCase();

    // Direct substring relationship
    if (lower1.includes(lower2) || lower2.includes(lower1)) {
      return lower1 !== lower2; // Not identical
    }

    // Common programming term variations
    const commonMappings: Record<string, string[]> = {
      'function': ['method', 'func'],
      'class': ['object', 'instance'],
      'variable': ['var', 'const', 'let'],
      'import': ['require', 'module'],
      'async': ['await', 'promise'],
    };

    for (const [key, variants] of Object.entries(commonMappings)) {
      if ((lower1 === key && variants.includes(lower2)) ||
          (lower2 === key && variants.includes(lower1))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Escape special regex characters
   * @param string String to escape
   * @returns Escaped string
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
