[![npm version](https://img.shields.io/npm/v/local-search-mcp.svg)](https://www.npmjs.com/package/local-search-mcp)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Local Search MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to perform semantic search across indexed documents using vector embeddings. Index documents from GitHub repositories and URLs to power natural language queries with contextual results.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Tools](#tools)
- [Documentation](#documentation)
- [Development](#development)
- [Contributing](#contributing)
- [Author](#author)
- [License](#license)

## Features

- **Semantic Search**: Natural language queries over indexed documents using transformer embeddings
- **Repository Indexing**: Clone and index GitHub repositories with configurable file patterns
- **File Downloads**: Fetch and index files from URLs with automatic processing
- **Async Processing**: Non-blocking operations with job progress tracking
- **SQLite Storage**: Efficient vector storage with optimized similarity search
- **MCP Protocol**: Full compatibility with Claude Desktop and other MCP applications

## Quick Start

The fastest way to get started is using npx (no cloning or building required):

```bash
# Run directly with npx
npx -y local-search-mcp

# Or install globally
npm install -g local-search-mcp
```

### MCP Configuration (npx)

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

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn** package manager
- **Git** for cloning repositories (development only)

### Option 1: NPM Package (Recommended)

```bash
# Install globally
npm install -g local-search-mcp

# Or use directly with npx (no installation needed)
npx local-search-mcp
```

### Option 2: From Source (Development)

```bash
# Clone the repository
git clone https://github.com/PatrickRuddiman/local-search-mcp.git
cd local-search-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### MCP Configuration

**For NPM package installation:**
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

**For source installation:**
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

## Usage

Once configured, the server provides semantic search capabilities within Claude Desktop and other MCP-compatible applications.

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

## Release Process

This project uses automated semantic versioning and publishing through GitHub Actions and [semantic-release](https://semantic-release.gitbook.io/).

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types that trigger releases:**
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)  
- `perf:` - Performance improvements (patch version bump)
- `BREAKING CHANGE:` - Breaking changes (major version bump)

**Other types (no release):**
- `docs:` - Documentation changes
- `style:` - Code formatting
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Build process or auxiliary tool changes

## Contributing

1. Fork the repository
2. Create a feature branch with descriptive name
3. Make changes following conventional commit format
4. Submit a pull request targeting the `main` branch
5. Ensure all CI checks pass before requesting review

## Author

**Patrick Ruddiman**  
[GitHub](https://github.com/PatrickRuddiman)

## License

MIT - see [LICENSE](LICENSE) for details.
