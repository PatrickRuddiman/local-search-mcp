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

The Local Search MCP Server provides 7 tools for document indexing and semantic search:

### 🔍 Search Tools

#### `search_documents`
Perform AI-enhanced semantic search with content classification, domain detection, and intelligent recommendations.

**Parameters:**
- `query` (required): Natural language search query
- `options` (optional): Search configuration object
  - `limit` (number, default: 10): Maximum results to return
  - `minScore` (number, default: 0.7): Minimum similarity score (0-1)
  - `includeMetadata` (boolean, default: true): Include metadata in results
  - `domainFilter` (array): Filter by technology domains (e.g., ["javascript", "python"])
  - `contentTypeFilter` (array): Filter by content type ("code", "docs", "config", "mixed")
  - `languageFilter` (array): Filter by programming language (e.g., ["typescript", "javascript"])
  - `minQualityScore` (number): Minimum content quality score (0-1)
  - `minAuthorityScore` (number): Minimum source authority score (0-1)

**Example:**
```json
{
  "query": "async await promises javascript",
  "options": {
    "limit": 5,
    "domainFilter": ["javascript"],
    "contentTypeFilter": ["code", "docs"]
  }
}
```

#### `get_file_details`
Retrieve detailed content of a specific file with surrounding chunk context.

**Parameters:**
- `filePath` (required): Absolute path to file
- `chunkIndex` (optional): Specific chunk to retrieve with surrounding context
- `contextSize` (number, default: 3): Number of chunks to include before and after target chunk

### 📦 Content Management Tools

#### `fetch_repo`
Clone a Git repository (GitHub, Azure DevOps, etc.) using repomix, convert to markdown, and add to searchable index. Returns job ID for progress tracking.

**Parameters:**
- `repoUrl` (required): Git repository URL
- `branch` (optional): Branch/tag/commit, defaults to main/master
- `options` (optional): Repository processing options
  - `includePatterns` (array, default: ["**/*.md", "**/*.mdx", "**/*.txt", "**/*.json", "**/*.rst", "**/*.yml", "**/*.yaml"]): File patterns to include
  - `excludePatterns` (array, default: ["**/node_modules/**"]): File patterns to exclude
  - `outputStyle` (string, default: "markdown"): Output format (fixed to markdown)
  - `removeComments` (boolean, default: false): Remove comments from code files
  - `showLineNumbers` (boolean, default: true): Show line numbers in output

**Example:**
```json
{
  "repoUrl": "https://github.com/microsoft/TypeScript",
  "branch": "main",
  "options": {
    "includePatterns": ["**/*.md", "**/*.ts"],
    "excludePatterns": ["**/node_modules/**", "**/tests/**"]
  }
}
```

#### `fetch_file`
Download a single file from a URL and add it to the searchable index. Returns job ID for progress tracking.

**Parameters:**
- `url` (required): URL of file to download
- `filename` (required): Desired filename for saving
- `options` (optional): Download options
  - `overwrite` (boolean, default: true): Whether to overwrite existing files
  - `indexAfterSave` (boolean, default: true): Automatically index after download
  - `maxFileSizeMB` (number, default: 1024): Maximum file size in MB

#### `remove_file`
Delete a file and all its associated chunks and embeddings from the index.

**Parameters:**
- `filePath` (required): Absolute path to file to remove

#### `flush_all`
Flush the entire database and all downloaded files. **WARNING**: This action is irreversible and will delete all indexed content, documents, and cached files.

**Parameters:** None

**What gets deleted:**
- All vector embeddings and document chunks from the database
- All recommendation and learning data
- All downloaded files from the `fetched` directory
- All cloned repositories from the `repositories` directory  
- All temporary files from the `temp` directory
- All active background jobs are cancelled

**Example:**
```json
{
  "name": "flush_all",
  "arguments": {}
}
```

### ⚙️ Job Management Tools

#### `get_job_status`
Get status and progress of an async job by ID with real-time accurate progress.

**Parameters:**
- `jobId` (required): Job ID returned from fetch_* operations

**Returns:**
- Job status: "running", "completed", or "failed"
- Progress percentage (0-100)
- Duration and timestamps
- Error message if failed
- Result data if completed

#### `list_active_jobs`
List all currently active (running) jobs with their status and progress.

**Parameters:** None

**Returns:**
- List of active jobs with progress
- Job statistics (total, completed, failed, average duration)
- Real-time progress updates

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

### Embedding Backends

The server supports multiple embedding generation backends with automatic selection based on available resources:

#### Backend Priority (Auto Mode)
1. **Local GPU** - Fastest, uses TensorFlow.js with GPU acceleration (when available)
2. **OpenAI API** - Fast, requires API key, ~$0.02 per 1M tokens
3. **Cohere API** - Fast, requires API key, ~$0.10 per 1M tokens  
4. **Local CPU** - Slowest, always available fallback

**Note**: MCP Sampling is **not** included in auto-detection due to client compatibility issues. To use it, explicitly set `EMBEDDING_BACKEND=mcp-sampling`.

#### Environment Variables

**Embedding Configuration:**
- `EMBEDDING_BACKEND` - Control embedding backend selection:
  - `auto` (default) - Automatically select best available backend
  - `local-gpu` - Force GPU (fails if unavailable)
  - `local-cpu` - Force CPU (slow but always works)
  - `openai` - Use OpenAI embeddings API (requires `OPENAI_API_KEY`)
  - `cohere` - Use Cohere embeddings API (requires `COHERE_API_KEY`)
  - `mcp-sampling` - Experimental MCP-based embeddings

**API Keys (optional):**
- `OPENAI_API_KEY` - OpenAI API key for fast embedding generation
- `COHERE_API_KEY` - Cohere API key as alternative to OpenAI

**Path Configuration:**
- `MCP_DATA_FOLDER` - Custom database and logs directory (defaults to platform-specific user data folder)
- `MCP_DOCS_FOLDER` - Custom document storage directory (defaults to platform-specific user documents folder)

#### Configuration Examples

**Using OpenAI for embeddings (recommended for CPU-only systems):**
```json
{
  "mcpServers": {
    "local-search": {
      "command": "npx",
      "args": ["-y", "local-search-mcp"],
      "env": {
        "EMBEDDING_BACKEND": "auto",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

**Using Cohere for embeddings:**
```json
{
  "mcpServers": {
    "local-search": {
      "command": "npx",
      "args": ["-y", "local-search-mcp"],
      "env": {
        "EMBEDDING_BACKEND": "auto",
        "COHERE_API_KEY": "..."
      }
    }
  }
}
```

**Force CPU-only mode (no API calls):**
```json
{
  "mcpServers": {
    "local-search": {
      "command": "npx",
      "args": ["-y", "local-search-mcp"],
      "env": {
        "EMBEDDING_BACKEND": "local-cpu"
      }
    }
  }
}
```

#### Performance Comparison

| Backend | Speed | Cost | Quality | Best For |
|---------|-------|------|---------|----------|
| Local GPU | ⚡⚡⚡ | Free | ⭐⭐⭐⭐ | Privacy, local processing |
| OpenAI API | ⚡⚡⚡ | $ | ⭐⭐⭐⭐⭐ | CPU-only systems, production |
| Cohere API | ⚡⚡⚡ | $$ | ⭐⭐⭐⭐ | Alternative to OpenAI |
| Local CPU | 🐌 | Free | ⭐⭐⭐⭐ | Small repos only (very slow) |
| MCP Sampling* | ⚡ | Free | ⭐⭐ | Experimental (explicit only) |

*MCP Sampling requires explicit configuration (`EMBEDDING_BACKEND=mcp-sampling`) and client support. Not recommended for production use.

**Recommendations:**
- **GPU available**: Use default `auto` mode (will use GPU)
- **CPU only, fast needed**: Set `OPENAI_API_KEY` and use `auto` mode
- **CPU only, privacy first**: Use `local-cpu` (expect slow indexing)
- **Large repositories**: Always use GPU or API backends

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
