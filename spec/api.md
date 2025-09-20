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

### Error Recovery
- Graceful fallback to CPU for embeddings
- Warning logs for unindexed files
- Partial results for failed document processing
