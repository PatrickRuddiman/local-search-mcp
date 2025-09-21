# MCP Server API Specification

## Available Tools

### search_documents
**Purpose**: Perform semantic search across the indexed documents.

**Parameters**:
```json
{
  "query": "string (natural language search query)",
  "options": {
    "limit": 10,
    "minScore": 0.7,
    "includeMetadata": true
  }
}
```

**Response**: Array of matching chunks with scores and metadata (instant response).

**Description**: Computes embeddings for the query, calculates cosine similarity with stored chunks, and returns the most relevant results. Fast database lookup operation.

### get_file_details
**Purpose**: Retrieve detailed content of a specific file with chunk context.

**Parameters**:
```json
{
  "filePath": "string (absolute path)",
  "chunkIndex": "number (optional, specific chunk to retrieve)",
  "contextSize": "number (default: 3, number of chunks before/after target)"
}
```

**Response**: Full file content or chunk with surrounding context (instant response).

**Description**: Provides detailed view of indexed files with surrounding chunk context, useful for AI agent context retrieval.

### remove_file
**Purpose**: Delete a file and all its associated chunks and embeddings from the index.

**Parameters**:
```json
{
  "filePath": "string (absolute path to file)"
}
```

**Response**: Success message with number of chunks deleted (instant response).

**Description**: Removes all traces of a file from the searchable index, including chunks, embeddings, and metadata.

### fetch_repo
**Purpose**: Clone a GitHub repository using repomix, convert to markdown, and add to searchable index.

**Parameters**:
```json
{
  "repoUrl": "string (GitHub repo URL, e.g., 'https://github.com/owner/repo')",
  "branch": "string (optional branch/tag/commit, defaults to main/master)",
  "options": {
    "includePatterns": "[\"*.txt\", \"*.md\", \"*.json\", \"*.rst\", \"*.yaml\", \"*.yml\"]",
    "excludePatterns": "[\"**/node_modules/**\", \"**/.git/**\"]",
    "maxFiles": 1000,
    "outputStyle": "markdown (fixed)",
    "removeComments": false,
    "showLineNumbers": true
  }
}
```

**Response**: Job ID for tracking progress.

**Description**: Asynchronously downloads and processes repository into a single markdown file, then chunks and indexes it. Returns immediately with job ID for progress tracking.

### fetch_file
**Purpose**: Download a single file from a URL and add it to the searchable index.

**Parameters**:
```json
{
  "url": "string (URL of file to download)",
  "filename": "string (desired filename for saving)",
  "docFolder": "string (optional, folder to save file, defaults to './docs/fetched')",
  "options": {
    "overwrite": "boolean (default: true)",
    "indexAfterSave": "boolean (default: true)",
    "maxFileSizeMB": "number (default: 10)"
  }
}
```

**Response**: Job ID for tracking progress.

**Description**: Asynchronously downloads file, saves it, then chunks and indexes it. Returns immediately with job ID for progress tracking.

### get_job_status
**Purpose**: Get status and progress of an async job by ID.

**Parameters**:
```json
{
  "jobId": "string (job ID from fetch operations)"
}
```

**Response**: Job status with real-time progress percentage and current step.

**Description**: Returns accurate progress based on actual pipeline progress: download, chunking, embedding generation, and storage.

### list_active_jobs
**Purpose**: List all currently active jobs with their status and progress.

**Parameters**: None

**Response**: Array of active jobs with real-time progress.

**Description**: Shows all running background processing jobs.

## Data Structures

### Chunk Object
```typescript
interface DocumentChunk {
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
```

### Job Progress
```typescript
interface Job {
  id: string;
  type: 'fetch_repo' | 'fetch_file';
  status: 'running' | 'completed' | 'failed';
  progress: number; // 0-100 (real-time accurate)
  currentStep: string; // "downloading", "chunking", "embedding", "storing"
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}
```

### Embedding Configuration
- Model: `universal-sentence-encoder` (512 dimensions)
- GPU acceleration: Automatic detection
- Batch processing: Optimized for performance

## Error Handling

### Standard Error Responses
- `INVALID_PATH`: Invalid or inaccessible file path
- `UNSUPPORTED_FORMAT`: File type not supported
- `INDEX_NOT_FOUND`: Search attempted on non-indexed content
- `INVALID_REPO_URL`: Invalid GitHub repository URL
- `REPOMIX_FAILED`: Repository processing failed
- `REPO_TOO_LARGE`: Repository exceeds size limits
- `INVALID_URL`: Invalid file URL
- `DOWNLOAD_FAILED`: File download failed
- `FILE_TOO_LARGE`: File exceeds size limits
- `PROCESSING_FAILED`: Chunking or embedding generation failed

### Error Recovery
- Graceful fallback for processing errors
- Warning logs for partial failures
- Detailed error reporting in job status
