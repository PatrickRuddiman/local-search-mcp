# API Reference

This document provides complete API specifications for the Local Search MCP Server.

## 📋 Table of Contents

- [MCP Tools](#mcp-tools)
- [TypeScript Interfaces](#typescript-interfaces)
- [Request/Response Schemas](#requestresponse-schemas)
- [Error Handling](#error-handling)

## 🔧 MCP Tools

### `search_documents`

Execute semantic similarity search across all indexed documents using natural language queries.

**Endpoint:** `search_documents`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ | - | Natural language search query |
| `options.limit` | `number` | ❌ | `10` | Maximum number of results to return (1-1000) |
| `options.minScore` | `number` | ❌ | `0.7` | Minimum similarity score threshold (0.0-1.0) |
| `options.includeMetadata` | `boolean` | ❌ | `true` | Include document metadata in results |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found N results for \"query\" in Tms"
    },
    {
      "type": "text",
      "text": "[JSON array of results]"
    }
  ]
}
```

#### Result Object Structure

```json
{
  "query": "search string",
  "results": [
    {
      "id": "file_path:chunk_index",
      "filePath": "/docs/example.md",
      "chunkIndex": 0,
      "content": "Relevant text content...",
      "score": 0.897,
      "metadata": {
        "fileSize": 1234,
        "lastModified": "2025-01-20T10:30:00.000Z",
        "chunkOffset": 0,
        "tokenCount": 150
      }
    }
  ],
  "totalResults": 5,
  "searchTime": 45,
  "options": { "limit": 5, "minScore": 0.7 }
}
```

---

### `get_file_details`

Retrieve detailed content and chunk information for specific indexed files.

**Endpoint:** `get_file_details`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filePath` | `string` | ✅ | - | Absolute path to indexed file |
| `chunkIndex` | `number?` | ❌ | - | Specific chunk index to retrieve (0-based) |
| `contextLines` | `number?` | ❌ | `3` | Lines of context around chunk (0-20) |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found N chunks for /path/to/file.txt"
    },
    {
      "type": "text",
      "text": "Chunk N (X tokens): content..."
    },
    {
      "type": "text",
      "text": "[JSON array of chunk objects]"
    }
  ]
}
```

---

### `fetch_repo`

Clone and process a GitHub repository, converting it to searchable markdown documentation.

**Endpoint:** `fetch_repo`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repoUrl` | `string` | ✅ | - | GitHub repository URL (with optional #branch) |
| `branch` | `string?` | ❌ | `main` | Branch, tag, or commit hash |
| `options.includePatterns` | `string[]` | ❌ | `['*.md', '*.txt', '*.json', '*.rst']` | File patterns to include |
| `options.excludePatterns` | `string[]` | ❌ | Various | File patterns to exclude |
| `options.maxFiles` | `number` | ❌ | `1000` | Maximum files to process |
| `options.outputStyle` | `'markdown'` | ❌ | `'markdown'` | Output format (fixed) |
| `options.removeComments` | `boolean` | ❌ | `false` | Strip source code comments |
| `options.showLineNumbers` | `boolean` | ❌ | `true` | Include line numbers in output |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully processed repository: owner/repo\\nFiles processed: N\\nOutput directory: /path/to/output"
    },
    {
      "type": "text",
      "text": "[JSON processing statistics]"
    }
  ]
}
```

---

### `fetch_file`

Download a single file from a URL and automatically index it for search.

**Endpoint:** `fetch_file`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | ✅ | - | HTTP/HTTPS URL to download |
| `filename` | `string` | ✅ | - | Desired filename for saving |
| `docFolder` | `string?` | ❌ | `${MCP_DOCS_FOLDER}/fetched` | Target folder |
| `options.overwrite` | `boolean` | ❌ | `true` | Overwrite existing files |
| `options.maxFileSizeMB` | `number` | ❌ | `10` | Maximum file size in MB |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully downloaded file: /path/to/file.txt\\nSize: 45.2KB"
    },
    {
      "type": "text",
      "text": "[JSON download and indexing results]"
    }
  ]
}
```

## 📝 TypeScript Interfaces

### Core Data Types

```typescript
export interface DocumentChunk {
  id: string;                    // Unique chunk identifier
  filePath: string;              // Absolute file path
  chunkIndex: number;            // Zero-based chunk position
  content: string;               // Text content
  embedding: number[];           // Vector embedding array
  score?: number;                // Similarity score (search results)
  metadata: {
    fileSize: number;           // File size in bytes
    lastModified: Date;         // File modification timestamp
    chunkOffset: number;        // Character offset in file
    tokenCount: number;         // Token count for this chunk
  };
}

export interface IndexingResult {
  totalFiles: number;           // Total files discovered
  processedFiles: number;       // Successfully indexed files
  totalChunks: number;          // Total chunks created
  totalTokens: number;          // Total tokens processed
  processingTime: number;       // Processing duration in ms
  errors: string[];             // Error messages from failed files
}

export interface SearchResult {
  query: string;                // Original search query
  results: DocumentChunk[];     // Ranked search results
  totalResults: number;         // Total results found
  searchTime: number;           // Search duration in ms
  options: SearchOptions;       // Search parameters used
}

export interface VectorIndexStatistics {
  totalChunks: number;          // Total indexed chunks
  totalFiles: number;           // Total indexed files
  totalTokens: number;          // Total tokens indexed
  embeddingModel: string;       // Model name used
  lastUpdated: Date;            // Last update timestamp
  dbSize: number;               // Database file size in bytes
}
```

### Configuration Types

```typescript
export interface ConcurrencyConfig {
  maxFileProcessingConcurrency?: number;    // File processing parallelism
  maxDirectoryConcurrency?: number;         // Directory traversal
  maxEmbeddingConcurrency?: number;         // Embedding generation
  maxRepositoryConcurrency?: number;        // Repository operations
  maxFileWatcherConcurrency?: number;       // File watcher operations
}

export interface IndexOptions {
  chunkSize?: number;            // Characters per chunk (100-2000)
  overlap?: number;              // Overlap between chunks (0-500)
  maxFiles?: number;             // Maximum files to index
  fileTypes?: string[];          // Allowed file extensions
  includePatterns?: string[];    // Glob patterns to include
  excludePatterns?: string[];    // Glob patterns to exclude
  useGPU?: boolean;              // Enable GPU acceleration
}

export interface SearchOptions {
  limit?: number;                // Max results to return
  minScore?: number;             // Minimum similarity threshold
  includeMetadata?: boolean;     // Include file metadata
  maxResults?: number;           // Pagination limit
  similarityThreshold?: number;  // Alternative to minScore
}
```

### Service Options

```typescript
export interface RepoOptions {
  repoUrl: string;              // GitHub repository URL
  branch?: string;              // Branch/tag/commit
  maxFiles?: number;            // Maximum files to process
  includePatterns?: string[];   // File inclusion patterns
  excludePatterns?: string[];   // File exclusion patterns
  outputStyle?: 'markdown';     // Output format
  removeComments?: boolean;     // Strip code comments
  showLineNumbers?: boolean;     // Include line numbers
}

export interface FileDownloadOptions {
  url: string;                  // Download URL
  filename: string;             // Desired filename
  docFolder?: string;           // Target directory
  overwrite?: boolean;          // Overwrite existing files
  indexAfterSave?: boolean;     // Auto-index after download
  maxFileSizeMB?: number;       // File size limit
}
```

## ⚠️ Error Handling

### Error Categories

| Error Code | Category | Description | Recovery |
|------------|----------|-------------|----------|
| `FILE_PROCESSING_ERROR` | File I/O | File reading/parsing failures | Check file permissions, format |
| `EMBEDDING_ERROR` | ML/Model | Embedding generation failures | Check GPU memory, model loading |
| `STORAGE_ERROR` | Database | SQLite operation failures | Check disk space, permissions |
| `NETWORK_ERROR` | HTTP | Download/upload failures | Check connectivity, retry later |

### Error Response Format

```typescript
interface MCPError {
  type: 'error';
  error: {
    code: string;
    message: string;
    data?: any;
  };
}
```

### Common Error Scenarios

#### File Processing Errors
- **Invalid file format** - Unsupported file type or corruption
- **Permission denied** - Directory/file access restrictions
- **File too large** - Exceeds configured size limits
- **Empty file** - No readable content

#### Embedding Errors
- **Model loading failure** - Missing model files or network issues
- **GPU memory exhaustion** - Insufficient VRAM for large batches
- **Token limit exceeded** - Text too long for model constraints

#### Storage Errors
- **Database corruption** - File system issues or concurrent access
- **Disk space exhausted** - Insufficient storage for index
- **Schema mismatches** - Database version incompatibility

#### Network Errors
- **Timeout** - Request took too long
- **Rate limiting** - Too many requests to external services
- **Authentication failed** - Invalid credentials or API keys

## 🔍 Usage Examples

### Basic Search Query

```typescript
await search_documents({
  query: "how does the API authentication work?",
  options: {
    limit: 5,
    minScore: 0.8
  }
});
```

### Repository Processing

```typescript
await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs",
  options: {
    maxFiles: 1000,
    includePatterns: ["*.md", "*.txt"],
    excludePatterns: ["**/node_modules/**"]
  }
});
```

### File Download with Custom Location

```typescript
await fetch_file({
  url: "https://raw.githubusercontent.com/user/repo/main/docs/api.md",
  filename: "api-reference.md",
  docFolder: "/custom/docs/path",
  options: {
    overwrite: true,
    maxFileSizeMB: 5
  }
});
```

### Detailed File Inspection

```typescript
await get_file_details({
  filePath: "/docs/api.md",
  chunkIndex: 2,  // Specific chunk
  contextLines: 5  // More context
});
```

---

## 🔗 Related Documentation

- **[Main README](../../README.md)** - Quick start and basic setup
- **[Usage Guide](../usage/)** - Complete integration examples and workflows
- **[Architecture Guide](../architecture/)** - System design and component interactions
- **[Performance Guide](../performance/)** - Optimization strategies and benchmarks

## 📖 Navigation Tips

- **New to the project?** Start with the [Quick Start](../../README.md#-quick-start) guide
- **Need examples?** Check the [Usage Guide](../usage/) for practical implementations
- **Performance issues?** See the [Performance Guide](../performance/) for tuning tips
- **Understanding the system?** Review the [Architecture Guide](../architecture/) for design details
