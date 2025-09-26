# Usage Guide

## Installation

### Quick Start (Recommended)

```bash
# Install globally from npm
npm install -g local-search-mcp

# Or run directly with npx (no installation needed)
npx -y local-search-mcp
```

### Development Setup

```bash
# Clone and build from source
git clone https://github.com/PatrickRuddiman/local-search-mcp.git
cd local-search-mcp
npm install
npm run build
```

## Configuration

### For NPM Package Installation

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "local-search": {
      "command": "npx",
      "args": ["-y", "local-search-mcp"],
      "env": {
        "MCP_DATA_FOLDER": "/optional/custom/data/path",
        "MCP_DOCS_FOLDER": "/optional/custom/docs/path"
      }
    }
  }
}
```

### For Source Installation

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "local-search": {
      "command": "node",
      "args": ["/absolute/path/to/local-search-mcp/build/index.js"],
      "env": {
        "MCP_DATA_FOLDER": "/optional/custom/data/path",
        "MCP_DOCS_FOLDER": "/optional/custom/docs/path"
      }
    }
  }
}
```

## Basic Usage

### 1. Index Documentation
```typescript
// Index a GitHub repository
await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs"
});

// Or download individual files
await fetch_file({
  url: "https://raw.githubusercontent.com/expressjs/express/main/README.md",
  filename: "express-docs.md"
});
```

### 2. Search Content
```typescript
await search_documents({
  query: "authentication API",
  options: {
    limit: 5,
    minScore: 0.7
  }
});
```

### 3. Get Detailed Content
```typescript
await get_file_details({
  filePath: "/docs/auth.md",
  chunkIndex: 2,
  contextSize: 3
});
```

## Advanced Usage

### Job Monitoring
```typescript
// Check background processing status
await get_job_status({ jobId: "job_abc123" });

// List all active jobs
await list_active_jobs();
```

### File Management
```typescript
// Remove indexed files
await remove_file({
  filePath: "/docs/old-file.md"
});
```

## Claude Desktop Integration

The server provides semantic search capabilities to Claude Desktop. Ask questions naturally:

```
"How does JWT authentication work in this project?"
"What are the API error response patterns?"
"Where are the database migration files?"
```

Claude will automatically search your indexed documentation and provide contextual answers.

## Best Practices

- **Chunk Size**: Default 1000 chars works well for most documentation
- **File Types**: Automatic detection supports 10+ formats (MD, TXT, JSON, etc.)
- **Concurrent Processing**: Background jobs prevent blocking MCP responses
- **Memory Usage**: Embedding models require 2GB+ RAM

See [API Reference](api/) for complete specifications and [Performance Guide](performance/) for optimization tips.
