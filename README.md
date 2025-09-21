# Local Search MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to perform semantic search across indexed documents using vector embeddings. Index documents from GitHub repositories and URLs to power natural language queries with contextual results.

## Quick Start

### Install
```bash
git clone https://github.com/PatrickRuddiman/local-search-mcp.git
cd local-search-mcp
npm install
npm run build
```

### MCP Configuration

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

## Features

- **Semantic Search**: Natural language queries over indexed documents using transformer embeddings
- **Repository Indexing**: Clone and index GitHub repositories with configurable file patterns
- **File Downloads**: Fetch and index files from URLs with automatic processing
- **Async Processing**: Non-blocking operations with job progress tracking
- **SQLite Storage**: Efficient vector storage with optimized similarity search
- **MCP Protocol**: Full compatibility with Claude Desktop and other MCP applications

## Tools

### Core Tools
- `search_documents` - Perform semantic similarity search
- `get_file_details` - Retrieve file content with context
- `fetch_repo` - Index GitHub repositories
- `fetch_file` - Download and index files from URLs

### Management Tools
- `get_job_status` - Check async job progress
- `list_active_jobs` - View all running jobs

## Documentation

For detailed technical documentation:

- **[Architecture](./documentation/architecture/)** - System design and processing pipeline
- **[API Reference](./documentation/api/)** - Complete tool specifications and types
- **[Performance](./documentation/performance/)** - Optimization guides and benchmarks
- **[Usage Examples](./documentation/usage/)** - Sample integrations and workflows

## Development

```bash
npm install
npm run build
npm run dev  # Development with hot reload
```

## Configuration

### Environment Variables

Set optional environment variables for custom paths:
- `MCP_DATA_FOLDER` - Custom database and logs directory (defaults to platform-specific user data folder)
- `MCP_DOCS_FOLDER` - Custom document storage directory (defaults to platform-specific user documents folder)

### Supported File Types

The server processes these file types:
- Documentation: `.md`, `.txt`, `.rst`, `.yaml`, `.yml`
- Data: `.json`, `.csv`
- Code: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.html`, `.css`
- Files up to 1GB are supported

## Acknowledgments

- **[@xenova/transformers](https://github.com/xenova/transformers.js)** - JavaScript ML models for embeddings
- **[sqlite-vec](https://github.com/asg017/sqlite-vec)** - Native vector search in SQLite
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Fast SQLite3 bindings
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - Standard for AI tool integration
- **[repomix](https://github.com/yamadashy/repomix)** - Repository processing utility

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT - see [LICENSE](LICENSE) for details.

---
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
