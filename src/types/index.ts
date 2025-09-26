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

export interface ConcurrencyConfig {
  maxFileProcessingConcurrency?: number; // Default: os.cpus().length
  maxDirectoryConcurrency?: number; // Default: os.cpus().length * 2
  maxEmbeddingConcurrency?: number; // Default: os.cpus().length
  maxRepositoryConcurrency?: number; // Default: os.cpus().length / 2
  maxFileWatcherConcurrency?: number; // Default: os.cpus().length
}

export interface IndexOptions {
  chunkSize?: number;
  overlap?: number;
  maxFiles?: number;
  fileTypes?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  useGPU?: boolean;
  outputStyle?: 'markdown' | 'plain';
  removeComments?: boolean;
  showLineNumbers?: boolean;
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

export interface RepoOptions {
  repoUrl: string;
  branch?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  outputStyle?: 'markdown' | 'plain';
  removeComments?: boolean;
  showLineNumbers?: boolean;
}

export interface FileDownloadOptions {
  url: string;
  filename: string;
  overwrite?: boolean;
  indexAfterSave?: boolean;
  maxFileSizeMB?: number;
}

export interface IndexingResult {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  totalTokens: number;
  processingTime: number;
  errors: string[];
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
}

export interface SearchResult {
  query: string;
  results: DocumentChunkOptimized[];
  totalResults: number;
  searchTime: number;
  options: SearchOptions;
  nextSteps?: string[];
}

export interface VectorIndexStatistics {
  totalChunks: number;
  totalFiles: number;
  totalTokens: number;
  embeddingModel: string;
  lastUpdated: Date;
  dbSize: number;
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
