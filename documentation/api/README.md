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
| `contextSize` | `number` | ❌ | `3` | Number of surrounding chunks to include (0-10) |

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

Start an async repository fetch operation. Returns immediately with a job ID for polling completion.

**Endpoint:** `fetch_repo`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repoUrl` | `string` | ✅ | - | GitHub repository URL (with optional #branch) |
| `branch` | `string?` | ❌ | `main` | Branch, tag, or commit hash |
| `options.includePatterns` | `string[]` | ❌ | `['*.md', '*.txt', '*.json', '*.rst']` | File patterns to include |
| `options.excludePatterns` | `string[]` | ❌ | Various | File patterns to exclude |
| `options.outputStyle` | `'markdown'` | ❌ | `'markdown'` | Output format (fixed) |
| `options.removeComments` | `boolean` | ❌ | `false` | Strip source code comments |
| `options.showLineNumbers` | `boolean` | ❌ | `true` | Include line numbers in output |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Started async repository fetch: owner/repo\\nJob ID: abc123\\nUse get_job_status to poll for completion."
    },
    {
      "type": "text",
      "text": "{\"jobId\": \"abc123\", \"repoName\": \"owner/repo\"}"
    }
  ]
}
```

---

### `fetch_file`

Start an async file download operation. Returns immediately with a job ID for polling completion.

**Endpoint:** `fetch_file`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | ✅ | - | HTTP/HTTPS URL to download |
| `filename` | `string` | ✅ | - | Desired filename for saving |
| `options.overwrite` | `boolean` | ❌ | `true` | Overwrite existing files |
| `options.maxFileSizeMB` | `number` | ❌ | `10` | Maximum file size in MB |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Started async file download: filename.txt\\nJob ID: def456\\nUse get_job_status to poll for completion."
    },
    {
      "type": "text",
      "text": "{\"jobId\": \"def456\", \"filename\": \"filename.txt\"}"
    }
  ]
}
```

---

### `get_job_status`

Poll the status of an async job by ID to check progress and retrieve results when complete.

**Endpoint:** `get_job_status`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | `string` | ✅ | - | Job ID returned from start_fetch_* operations |

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Job Status: abc123\\nType: fetch_repo\\nStatus: completed\\nProgress: 100%\\nDuration: 45.2s\\nJob completed successfully!"
    },
    {
      "type": "text",
      "text": "[JSON job object with full status and results]"
    }
  ]
}
```

---

### `list_active_jobs`

List all currently active (running) jobs with their status and progress information.

**Endpoint:** `list_active_jobs`

#### Parameters

No parameters required.

#### Response Schema

```json
{
  "content": [
    {
      "type": "text",
      "text": "Active Jobs (2):\\nabc123: fetch_repo (75%, 30.1s)\\ndef456: fetch_file (50%, 15.3s)\\n\\nStatistics:\\nTotal: 25\\nRunning: 2\\nCompleted: 20\\nFailed: 3\\nAvg Duration: 22.5s"
    },
    {
      "type": "text",
      "text": "[JSON array of active jobs]"
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
  nextSteps: string[];          // Suggested follow-up queries
}

export interface VectorIndexStatistics {
  totalChunks: number;          // Total indexed chunks
  totalFiles: number;           // Total indexed files
  totalTokens: number;          // Total tokens indexed
  embeddingModel: string;       // Model name used
  lastUpdated: Date;            // Last update timestamp
  dbSize: number;               // Database file size in bytes
}

export interface Job {
  id: string;                   // Unique job identifier
  type: 'fetch_repo' | 'fetch_file';  // Job type
  status: 'running' | 'completed' | 'failed';  // Current status
  progress: number;             // Progress percentage (0-100)
  startTime: Date;              // Job start timestamp
  endTime?: Date;               // Job completion timestamp
  error?: string;               // Error message if failed
  result?: any;                 // Job result when completed
}

export interface JobStatistics {
  total: number;                // Total jobs created
  running: number;              // Currently running jobs
  completed: number;            // Successfully completed jobs
  failed: number;               // Failed jobs
  averageDuration: number;      // Average completion time in ms
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
  includePatterns?: string[];   // File inclusion patterns
  excludePatterns?: string[];   // File exclusion patterns
  outputStyle?: 'markdown';     // Output format
  removeComments?: boolean;     // Strip code comments
  showLineNumbers?: boolean;     // Include line numbers
}

export interface FileDownloadOptions {
  url: string;                  // Download URL
  filename: string;             // Desired filename
  overwrite?: boolean;          // Overwrite existing files
  indexAfterSave?: boolean;     // Auto-index after download
  maxFileSizeMB?: number;       // File size limit
}
```

## ⚠️ Error Handling

All API errors are returned via MCP protocol error responses with details about the operation that failed. Common scenarios include:

- **File access errors**: Permission issues, file not found, unsupported formats
- **Network failures**: Download timeouts, invalid URLs, rate limiting
- **Processing errors**: Large files, corrupted data, model loading issues
- **Storage problems**: Database corruption, out of disk space

Error responses include descriptive messages and can be handled by your MCP client for appropriate user feedback.

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
    includePatterns: ["*.md", "*.txt"],
    excludePatterns: ["**/node_modules/**"]
  }
});
```

### File Download with Configuration Options

```typescript
await fetch_file({
  url: "https://raw.githubusercontent.com/user/repo/main/docs/api.md",
  filename: "api-reference.md",
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
  contextSize: 5  // More context chunks
});
```

### Async Job Management Workflow

```typescript
// 1. Start async repository fetch
const repoJob = await fetch_repo({
  repoUrl: "https://github.com/large/repository",
  options: {
    includePatterns: ["*.md", "*.txt", "*.json"]
  }
});

// 2. Start async file download
const fileJob = await fetch_file({
  url: "https://example.com/large-file.json",
  filename: "data.json",
  options: { maxFileSizeMB: 50 }
});

// 3. Poll for completion
let repoStatus = await get_job_status({ jobId: repoJob.jobId });
while (repoStatus.status === 'running') {
  console.log(`Repository fetch: ${repoStatus.progress}%`);
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
  repoStatus = await get_job_status({ jobId: repoJob.jobId });
}

// 4. Check all active jobs
const activeJobs = await list_active_jobs();
console.log(`Active jobs: ${activeJobs.length}`);

// 5. Handle completion
if (repoStatus.status === 'completed') {
  console.log(`Repository processed: ${repoStatus.result.filesProcessed} files`);
} else {
  console.error(`Repository fetch failed: ${repoStatus.error}`);
}
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
