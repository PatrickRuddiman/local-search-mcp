# MCP Server API Specification

## Available Tools

### index_files
**Purpose**: Process a folder path and build an in-memory index of all supported files.

**Parameters**:
```json
{
  "folderPath": "string (absolute path to folder)",
  "options": {
    "chunkSize": 1000,
    "overlap": 200,
    "maxFiles": 10000,
    "fileTypes": [".md", ".txt", ".json", ".js", ".ts"]
  }
}
```

**Response**: Success message with index statistics.

**Description**: Recursively scans the folder, extracts text from supported files, chunks the content, generates embeddings, and stores in memory for fast searching.

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

**Response**: Array of matching chunks with scores and metadata.

**Description**: Computes embeddings for the query, calculates cosine similarity with stored chunks, and returns the most relevant results.

### get_file_details
**Purpose**: Retrieve detailed content of a specific file with chunk context.

**Parameters**:
```json
{
  "filePath": "string (absolute path)",
  "chunkIndex": "number (optional, specific chunk to retrieve)",
  "contextLines": "number (lines of context around chunk)"
}
```

**Response**: Full file content or chunk with surrounding context.

**Description**: Provides detailed view of indexed files, useful for AI agent context retrieval.

### fetch_repo
**Purpose**: Clone a GitHub repository using repomix, convert to markdown, and add to searchable index.

**Parameters**:
```json
{
  "repoUrl": "string (GitHub repo URL, e.g., 'https://github.com/owner/repo' or 'owner/repo')",
  "branch": "string (optional branch/tag/commit, defaults to main/master)",
  "options": {
    "includePatterns": "[\"*.txt\", \"*.md\", \"*.json\", \"*.rst\", \"*.yaml\", \"*.yml\"] (documentation file types only)",
    "excludePatterns": "[\"**/node_modules/**\", \"**/package-lock.json\", \"**/*.log\", \"**/.git/**\"]",
    "maxFiles": 1000,
    "outputStyle": "markdown (fixed)",
    "removeComments": false,
    "showLineNumbers": true
  }
}
```

**Response**: Success message with processing statistics (files processed, tokens generated, index size).

**Description**: Uses repomix to clone and convert the repository, limiting to documentation-focused file types. The generated markdown is chunked and embedded for semantic search. Note: If repomix output quality is insufficient due to complex file structures or binary dependencies, consider manual cloning and using the `index_files` tool for more control over indexing.

### fetch_file
**Purpose**: Download a single file from a URL and add it to the searchable index after saving to the docs folder.

**Parameters**:
```json
{
  "url": "string (URL of file to download, e.g., raw.githubusercontent.com URLs)",
  "filename": "string (desired filename for saving the file)",
  "docFolder": "string (optional, folder to save file, defaults to './docs/fetched')",
  "options": {
    "overwrite": "boolean (default: true, whether to overwrite existing files)",
    "indexAfterSave": "boolean (default: true, automatically index after download)",
    "maxFileSizeMB": "number (default: 10, maximum file size in MB)"
  }
}
```

**Response**: Success message with file save location and optional indexing statistics.

**Description**: Downloads a single file from supported text-based URLs (raw GitHub, direct file URLs, etc.), saves it to the specified docs folder, and automatically indexes it if option is enabled. Supports the same text formats as other tools (.txt, .md, .json, .yaml, .yml, .rst). Files are saved to './docs/fetched' by default for organization.

### update_index
**Purpose**: Update the existing index with new or modified files.

**Parameters**:
```json
{
  "folderPath": "string",
  "changes": ["array of changed file paths"]
}
```

**Response**: Update statistics and new index size.

**Description**: Incremental indexing for efficient updates without rebuilding the entire index.

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
  };
}
```

### Embedding Configuration
- Model: `Xenova/paraphrase-albert-small-v2` (default)
- Toggle: GPU acceleration (if available)
- Dimensions: 768

## Error Handling

### Standard Error Responses
- `INVALID_PATH`: Invalid or inaccessible folder path
- `UNSUPPORTED_FORMAT`: File type not supported
- `INDEX_NOT_FOUND`: Search attempted before indexing
- `GPU_NOT_AVAILABLE`: GPU features not accessible
- `INVALID_REPO_URL`: Invalid or inaccessible GitHub repository URL
- `REPOMIX_FAILED`: Repository processing with repomix failed
- `REPO_TOO_LARGE`: Repository exceeds size limits for processing
- `INVALID_URL`: Invalid or inaccessible file URL for fetch_file
- `DOWNLOAD_FAILED`: File download failed for fetch_file
- `FILE_TOO_LARGE`: Downloaded file exceeds size limits
- `FETCH_TIMEOUT`: File download or repository processing timed out

### Error Recovery
- Graceful fallback to CPU for embeddings
- Warning logs for unindexed files
- Partial results for failed document processing
