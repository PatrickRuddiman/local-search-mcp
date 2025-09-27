export interface DocumentChunk {
  id: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  score?: number;
  metadata: {
    fileSize: number;
    lastModified: Date;
    chunkOffset: number;
    tokenCount: number;
  };
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  includeMetadata?: boolean;
  maxResults?: number;
  similarityThreshold?: number;
}

export interface FileDetailsOptions {
  filePath: string;
  chunkIndex?: number;
  contextLines?: number;
}

export interface FileDownloadOptions {
  url: string;
  filename: string;
  overwrite?: boolean;
  indexAfterSave?: boolean;
  maxFileSizeMB?: number;
}


export interface DocumentChunkOptimized {
  id: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  score?: number;
  metadata: {
    fileSize: number;
    lastModified: Date;
    chunkOffset: number;
    tokenCount: number;
  };
  // Enhanced metadata for content classification
  contentMetadata?: ContentMetadata;
}

// Content classification and domain metadata
export interface ContentMetadata {
  contentType: 'code' | 'docs' | 'config' | 'mixed';
  language: string; // programming language or 'natural'
  domainTags: string[]; // technology keywords
  qualityScore: number; // 0-1 content quality score
  sourceAuthority: number; // 0-1 authority score
  processedContent?: string; // cleaned content for search
  rawContent?: string; // original content for display
  fileExtension: string;
  hasComments: boolean;
  hasDocumentation: boolean;
}

// Domain vocabulary for technology detection
export interface DomainVocabulary {
  id?: number;
  domain: string;
  keywords: KeywordWeight[];
  authorityPatterns: string[];
  boostFactor: number;
}

export interface KeywordWeight {
  keyword: string;
  weight: number;
}

// Query intent classification
export interface QueryIntent {
  queryHash: string;
  detectedDomains: DomainMatch[];
  confidence: number;
  expiresAt: Date;
}

export interface DomainMatch {
  domain: string;
  confidence: number;
  matchedKeywords: string[];
  boostFactor: number;
}

// Content classification results
export interface ContentClassification {
  contentType: 'code' | 'docs' | 'config' | 'mixed';
  language: string;
  confidence: number;
  indicators: string[]; // what led to this classification
}

// Content quality assessment
export interface QualityAssessment {
  score: number; // 0-1
  factors: {
    semanticDensity: number; // ratio of meaningful content to noise
    syntaxNoise: number; // amount of syntax/formatting noise
    documentationPresence: number; // presence of comments/docs
    structuralClarity: number; // clear organization/structure
  };
}

// Source authority detection
export interface AuthorityAssessment {
  score: number; // 0-1
  indicators: {
    isOfficialDocs: boolean;
    isExample: boolean;
    isGenerated: boolean;
    hasAuthorityMarkers: string[]; // URLs, paths indicating authority
  };
}

// Enhanced search options with domain filtering
export interface EnhancedSearchOptions extends SearchOptions {
  domainFilter?: string[];         // Filter by technology domains
  contentTypeFilter?: string[];    // Filter by content type (code/docs/config/mixed)
  languageFilter?: string[];       // Filter by programming language
  minQualityScore?: number;        // Minimum quality score threshold (0-1)
  minAuthorityScore?: number;      // Minimum source authority threshold (0-1)
}

export interface SearchResult {
  query: string;
  results: DocumentChunkOptimized[];
  totalResults: number;
  searchTime: number;
  options: SearchOptions;
  nextSteps?: string[];
  recommendation?: SearchRecommendation;
}

export interface VectorIndexStatistics {
  totalChunks: number;
  totalFiles: number;
  totalTokens: number;
  embeddingModel: string;
  lastUpdated: Date;
  dbSize: number;
}

// Search recommendation system types
export enum SuggestionStrategy {
  TERM_REMOVAL = 'term_removal',
  TERM_REFINEMENT = 'term_refinement',
  CONTEXTUAL_ADDITION = 'contextual_addition'
}

export interface SearchRecommendation {
  id: string;
  query: string;
  suggestedTerms: string[];
  suggestionStrategy: SuggestionStrategy;
  tfidfThreshold: number;
  confidence: number;
  generatedAt: Date;
  expiresAt: Date;
  totalDocuments: number;
  analyzedDocuments: number;
}

export interface RecommendationEffectiveness {
  recommendationId: string;
  wasUsed: boolean;
  improvedResults?: boolean;
  usageTime?: Date;
  effectivenessScore: number; // 0-1 scale
  originalResultCount: number;
  improvedResultCount?: number;
}

export interface AdaptiveLearningParams {
  currentTfidfThreshold: number; // 0.1-0.5 range
  effectivenessHistory: number[]; // Recent effectiveness scores
  strategyWeights: Record<SuggestionStrategy, number>; // Strategy success rates
  lastUpdated: Date;
  learningRate: number; // 0.01-0.1 for parameter adaptation
}

export interface TfidfAnalysisResult {
  term: string;
  tf: number; // Term frequency
  df: number; // Document frequency
  tfidf: number; // TF-IDF score
  shouldRemove: boolean;
  confidence: number;
}

// Error types
export class LocalSearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LocalSearchError';
  }
}

export class FileProcessingError extends LocalSearchError {
  constructor(message: string, originalError?: Error) {
    super(message, 'FILE_PROCESSING_ERROR', originalError);
  }
}

export class EmbeddingError extends LocalSearchError {
  constructor(message: string, originalError?: Error) {
    super(message, 'EMBEDDING_ERROR', originalError);
  }
}

export class StorageError extends LocalSearchError {
  constructor(message: string, originalError?: Error) {
    super(message, 'STORAGE_ERROR', originalError);
  }
}
