# Usage Examples

## Setting Up the MCP Server

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Configure MCP Settings (add to claude_mcp_settings.json):
```json
{
  "mcpServers": {
    "local-search": {
      "command": "node",
      "args": ["/absolute/path/to/local-search-mcp/build/index.js"],
      "env": {}
    }
  }
}
```

## Basic Workflow

### 1. Fetch and Index a Repository
```typescript
// Fetch documentation from a GitHub repository
const result = await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs"
});
// Returns: { jobId: "job_abc123" }

// Check progress
await get_job_status({ jobId: "job_abc123" });
// Returns: { progress: 45, currentStep: "embedding", status: "running" }
```

### 2. Fetch and Index Individual Files
```typescript
// Fetch a specific documentation file
const result = await fetch_file({
  url: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/api/vscode-api.md",
  filename: "vscode-api.md"
});
// Returns: { jobId: "job_def456" }

// Fetch with custom options
await fetch_file({
  url: "https://example.com/api-docs.json",
  filename: "api-reference.json",
  docFolder: "./docs/api-files",
  options: {
    maxFileSizeMB: 5,
    overwrite: false
  }
});
```

### 3. Search Documents
```typescript
// Query the indexed content (instant response)
const results = await search_documents({
  query: "how does the authentication work?",
  options: {
    limit: 5,
    minScore: 0.7
  }
});
// Returns: { results: [...], totalResults: 12, searchTime: 47 }
```

### 4. Get File Details
```typescript
// Get detailed chunk context (instant response)
const chunks = await get_file_details({
  filePath: "/docs/auth.md",
  chunkIndex: 2,
  contextSize: 3
});
// Returns: [chunk with surrounding context]
```

### 5. Remove Files
```typescript
// Remove file from index (instant response)
const result = await remove_file({
  filePath: "/docs/old-file.md"
});
// Returns: { deletedChunks: 15, success: true }
```

## Progress Tracking

### Monitor Job Progress
```typescript
// Start a repository fetch
const { jobId } = await fetch_repo({
  repoUrl: "https://github.com/large/repository"
});

// Poll for progress (real-time accurate)
const status = await get_job_status({ jobId });
console.log(`${status.progress}% - ${status.currentStep}`);
// Output: "73% - Generating embeddings (batch 45/67)"

// List all active jobs
const jobs = await list_active_jobs();
console.log(`${jobs.length} jobs running`);
```

### Real Progress Examples
```typescript
// Typical progress flow for fetch_repo:
"5% - Downloading repository..."
"15% - Converting to markdown..."  
"30% - Reading file content..."
"35% - Chunking text..."
"40% - Created 1,250 chunks"
"50% - Generating embeddings..."
"65% - Embedding batch 15/25 completed"
"85% - Embedding batch 23/25 completed"
"95% - Storing chunks in database..."
"100% - Repository indexed successfully"
```

## Example Queries

### Technical Documentation Search
- "Explain the REST API patterns"
- "What are the authentication options?"
- "How to configure logging levels"

### Code Search
- "Find all React component examples"
- "Where are the database connection utilities?"
- "Show me the error handling patterns"

### Troubleshooting
- "What could cause high memory usage?"
- "How to enable debug mode?"
- "Find deprecated API usage"

## Multiple Concurrent Requests

```typescript
// Start multiple fetch operations simultaneously
const repo1 = await fetch_repo({ repoUrl: "https://github.com/org/repo1" });
const repo2 = await fetch_repo({ repoUrl: "https://github.com/org/repo2" });
const file1 = await fetch_file({ 
  url: "https://example.com/docs.md", 
  filename: "docs.md" 
});

// All return immediately with job IDs, process in background
console.log("All started:", repo1.jobId, repo2.jobId, file1.jobId);

// Check progress of all jobs
const activeJobs = await list_active_jobs();
activeJobs.forEach(job => {
  console.log(`${job.id}: ${job.progress}% - ${job.currentStep}`);
});
```

## Error Scenarios

### Handling Processing Failures
```typescript
const { jobId } = await fetch_repo({
  repoUrl: "https://github.com/invalid/repo"
});

// Check for errors
const status = await get_job_status({ jobId });
if (status.status === 'failed') {
  console.log("Error:", status.error);
}
```

### Network Issues
```typescript
const result = await search_documents({
  query: "complex query with network dependency"
});
// Always succeeds (searches local index only)
```

## Configuration

### Environment Variables
```env
MCP_DATA_FOLDER=/custom/data/path
MCP_DOCS_FOLDER=/custom/docs/path
NODE_ENV=production
```

### Embedding Model Configuration
- Model: Universal Sentence Encoder (512 dimensions)
- GPU acceleration: Automatic detection and usage
- Batch size: Optimized for performance (32 chunks per batch)
