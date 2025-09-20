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
      "args": ["D:/repos/local-search-mcp/build/index.js"],
      "env": {}
    }
  }
}
```

## Basic Workflow

### 1. Index a Folder (Local Files)
```typescript
// Using the MCP tool
await index_files({
  folderPath: "C:/Users/user/Documents/my-docs",
  options: {
    chunkSize: 1000,
    overlap: 200,
    fileTypes: [".md", ".txt"]
  }
});
```

### 1b. Fetch and Index a Repository
```typescript
// Fetch documentation from a GitHub repository
await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs",
  options: {
    maxFiles: 1000,
    includePatterns: ["*.md", "*.txt", "*.rst"]
  }
});
```

### 1c. Fetch and Index Individual Files
```typescript
// Fetch a specific documentation file from raw GitHub URL
await fetch_file({
  url: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/api/vscode-api.md",
  filename: "vscode-api.md"
});

// Fetch to custom folder with size limit
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

### 2. Search Documents
```typescript
// Query the indexed content
await search_documents({
  query: "how does the authentication work?",
  options: {
    limit: 5,
    minScore: 0.8
  }
});
```

### 3. Retrieve Specific Details
```typescript
// Get detailed chunk context
await get_file_details({
  filePath: "/docs/auth.md",
  chunkIndex: 2,
  contextLines: 3
});
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

## Advanced Usage

### Custom Chunking Strategy
```typescript
const chunker = new TextChunker({
  strategy: "sentence-aware",
  maxSize: 800,
  overlap: 50
});
```

### Batch Processing
```typescript
// Index multiple folders
await Promise.all([
  index_files({ folderPath: "/docs/api" }),
  index_files({ folderPath: "/docs/guides" })
]);
```

### Incremental Updates
```typescript
// Update index with new files
await update_index({
  folderPath: "/docs",
  changes: ["/docs/new-feature.md", "/docs/updated-api.md"]
});
```

## Command Line Testing

```bash
# Interactive testing
npm run dev

# Direct tool invocation
node build/index.js --help
```

## Integration with AI Agents

### Context Window Optimization
- Search for relevant code snippets
- Retrieve API documentation chunks
- Find configuration examples

### Workflow Automation
- Index repository documentation
- Query for implementation details
- Extract code patterns and examples

## Performance Tuning

### For Large Document Sets
```typescript
const options = {
  maxFiles: 50000,
  chunkSize: 500,  // Smaller chunks for precision
  useGPU: true
};
```

### Memory Constraints
```typescript
const options = {
  maxMemory: "2GB",
  streamingMode: true
};
```

### GPS Acceleration
```typescript
const embeddingService = new EmbeddingService({
  useGPU: true,
  model: "Xenova/paraphrase-multilingual-mpnet-base-v2",
  batchSize: 32
});
```

## Error Scenarios

### Handling Missing Files
```typescript
try {
  await index_files({ folderPath: "/nonexistent/path" });
} catch (error) {
  console.log("Path not found:", error.message);
  // Fallback to user input
}
```

### Network Timeout
```typescript
const result = await search_documents({
  query: "complex query",
  timeout: 30000,  // 30 seconds
  fallback: "keyword search"
});
```

## Configuration Files

### .env Configuration
```env
MCP_DEFAULT_FOLDER=C:/docs
MCP_CHUNK_SIZE=1000
MCP_EMBEDDING_MODEL=Xenova/paraphrase-albert-small-v2
MCP_ENABLE_GPU=true
```

### Runtime Configuration
```json
{
  "server": {
    "logLevel": "info",
    "experimental": {
      "enableStreaming": true,
      "useExternalStorage": false
    }
  }
}
