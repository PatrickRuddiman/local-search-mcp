# Local Search MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Server-FF6B35?style=for-the-badge)](https://modelcontextprotocol.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-Compatible-412991?style=for-the-badge&logo=openai&logoColor=white)]()

A high-performance Model Context Protocol (MCP) server that provides semantic document search with automatic indexing, embedding generation using transformers, and real-time file watching capabilities. Built for AI tools like Claude and other MCP-compatible applications.

## 🚀 Key Features

- 🔍 **Semantic Search**: Vector-based similarity search using @xenova/transformers
- 📁 **Real-time Indexing**: Automatic file watching and indexing with chokidar
- 📚 **Repository Processing**: GitHub repository cloning and markdown conversion via repomix
- 📄 **File Downloads**: Direct URL file fetching with automatic indexing
- 🆚 **GitHub Copilot Integration**: Enhanced code suggestions with organizational context
- ⚡ **Parallel Processing**: p-limit concurrency control for multi-core performance (5-10x speedup)
- 💾 **Persistent Storage**: SQLite-based vector storage with optimized indexing
- 🔄 **Automatic Updates**: Background file change detection and re-indexing
- 🏗️ **Cross-Platform**: Works seamlessly on Windows, macOS, and Linux

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#%EF%B8%8F-configuration)
- [Usage](#-usage)
- [MCP Tools](#-mcp-tools)
- [Architecture](#-architecture)
- [Performance](#%EF%B8%8F-performance)
- [Advanced Configuration](#-advanced-configuration)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-repo/local-search-mcp.git
cd local-search-mcp

# Install dependencies
npm install

# Build the project
npm run build

# The server is now ready for MCP integration
```

### Claude Desktop Integration

Add to your `claude_mcp_settings.json`:

```json
{
  "mcpServers": {
    "local-search": {
      "command": "node",
      "args": [
        "/absolute/path/to/local-search-mcp/build/index.js"
      ],
      "env": {
        "MCP_DOCS_FOLDER": "/optional/custom/docs/path"
      }
    }
  }
}
```

## 📦 Installation

### Prerequisites

- Node.js 18+ with npm
- TypeScript 5.5+
- 2GB+ available RAM (embedding models)
- For better performance: Multi-core CPU with 4+ cores

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/your-repo/local-search-mcp.git
cd local-search-mcp

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Verify installation
node build/index.js --help
```

### Optional: GPU Acceleration

The server automatically detects and uses GPU acceleration when available for embedding generation. No configuration needed - it's enabled by default.

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MCP_DOCS_FOLDER` | Custom docs folder path | Platform-specific | `/home/user/docs` |
| `NODE_ENV` | Environment mode | `development` | `production` |

### Default Docs Folder Locations

- **Linux**: `~/.local/share/local-search-mcp/docs`
- **macOS**: `~/Library/Application Support/local-search-mcp/docs`
- **Windows**: `%LOCALAPPDATA%/local-search-mcp/docs`

### MCP Configuration

#### Claude Desktop (`claude_mcp_settings.json`)

```json
{
  "mcpServers": {
    "local-search": {
      "command": "node",
      "args": [
        "/absolute/path/to/local-search-mcp/build/index.js"
      ],
      "env": {
        "MCP_DOCS_FOLDER": "/custom/path/to/docs"
      }
    }
  }
}
```

#### Other MCP-Compatible Applications

Use the same configuration format with your MCP-compatible editor or IDE.

## 💻 Usage

### Basic Workflow

1. **Start the MCP Server** (handled by your editor/IDE)
2. **Fetch Content**: Use `fetch_repo` or `fetch_file` to add content
3. **Search**: Use `search_documents` for semantic queries
4. **Background Updates**: Files are automatically re-indexed when changed

### Example Queries

```typescript
// Fetch a GitHub repository
await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs"
});

// Search for content
await search_documents({
  query: "how does the API authentication work?",
  options: { limit: 5, minScore: 0.7 }
});

// Get specific file content
await get_file_details({
  filePath: "/docs/auth.md",
  chunkIndex: 2
});
```

### File Types Supported

- **Documentation**: `.md`, `.txt`, `.rst`, `.yaml`, `.yml`
- **Data**: `.json`, `.csv`
- **Code**: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.html`, `.css`
- **Configuration**: Files up to 10MB supported

## 🔧 MCP Tools

### `search_documents`

Perform semantic similarity search across indexed content.

**Parameters:**
```typescript
{
  query: string,           // Natural language search query
  options?: {
    limit?: number,        // Max results (default: 10)
    minScore?: number      // Minimum similarity score 0-1 (default: 0.7)
  }
}
```

**Returns:** Ranked list of relevant document chunks with scores and metadata.

### `get_file_details`

Retrieve detailed content and chunks for a specific file with surrounding context. **Enhanced in latest version** to remove embeddings from responses (saving ~80% context space) and return surrounding chunks for maximum context.

**Parameters:**
```typescript
{
  filePath: string,        // Absolute path to indexed file
  chunkIndex?: number,     // Specific chunk index (optional)
  contextSize?: number     // Number of chunks before/after target (default: 3)
}
```

**Returns:** File chunks with metadata and content (embeddings removed for efficiency).

**New Workflow Example:**
```typescript
// 1. Search for relevant content
const results = await search_documents({
  query: "authentication configuration"
});

// 2. Get detailed context for top result
const details = await get_file_details({
  filePath: results.results[0].filePath,
  chunkIndex: results.results[0].chunkIndex,
  contextSize: 5  // Get 5 chunks before/after for full context
});
```

### `fetch_repo`

Clone and process a GitHub repository using repomix.

**Parameters:**
```typescript
{
  repoUrl: string,         // GitHub repository URL
  branch?: string,         // Branch/tag/commit (optional)
  options?: {
    includePatterns?: string[],    // Default: ["**/*.md", "**/*.mdx", "**/*.txt", "**/*.json", "**/*.rst", "**/*.yml", "**/*.yaml"]
    excludePatterns?: string[],    // Default: ["**/node_modules/**", "**/venv/**", "**/.git/**"]
    maxFiles?: number,             // Default: 1000
    outputStyle?: 'markdown',      // Fixed to markdown
    removeComments?: boolean,      // Default: false
    showLineNumbers?: boolean      // Default: true
  }
}
```

**Note:** Uses recursive glob patterns (`**/*.ext`) for comprehensive file discovery. Supports all major documentation and configuration file types.

**Returns:** Processing statistics and output location.

### `fetch_file`

Download and index a file from a URL.

**Parameters:**
```typescript
{
  url: string,             // File URL (raw GitHub, direct links)
  filename: string,        // Desired filename
  docFolder?: string,      // Target folder (optional)
  options?: {
    overwrite?: boolean,
    maxFileSizeMB?: number
  }
}
```

**Returns:** Download status and indexing results.

### Async Job Management Tools

The server now supports asynchronous operations with job tracking to prevent timeouts during heavy processing.

#### `start_fetch_repo`

Start an async repository fetch operation and return immediately with a job ID.

**Parameters:** Same as `fetch_repo`

**Returns:** Job ID for polling completion

#### `start_fetch_file`

Start an async file download operation and return immediately with a job ID.

**Parameters:** Same as `fetch_file`

**Returns:** Job ID for polling completion

#### `get_job_status`

Poll the status of an async job by ID.

**Parameters:**
```typescript
{
  jobId: string              // Job ID from start_fetch_* operations
}
```

**Returns:** Job status with progress, duration, and results when complete

#### `list_active_jobs`

List all currently running jobs with progress information.

**Returns:** Array of active jobs with statistics

**Async Workflow Example:**
```typescript
// 1. Start async repository fetch
const repoJob = await start_fetch_repo({
  repoUrl: "https://github.com/large/repository"
});

// 2. Start async file download
const fileJob = await start_fetch_file({
  url: "https://example.com/large-file.json",
  filename: "data.json"
});

// 3. Poll for completion
const status = await get_job_status({ jobId: repoJob.jobId });

// 4. Check all active jobs
const activeJobs = await list_active_jobs();
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL SEARCH MCP SERVER                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   MCP       │  │   File      │  │   Repo      │           │
│  │ Interface   ├──┤   Download  ├──┤   Service   │           │
│  │             │  │   Service   │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│           │                     │                    │         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   File      │  │   Text      │  │   Embed-    │           │
│  │   Watcher   ├──┤   Chunker   ├──┤   ding      │           │
│  │             │  │             │  │   Service   │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                               │                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Search    │  │   Vector    │  │   SQLite    │           │
│  │   Service   ├──┤   Index     ├──┤   Storage   │           │
│  │             │  │             │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

**Search Service**: Orchestrates the entire search pipeline
**Embedding Service**: Generates vector embeddings using transformers
**File Watcher**: Monitors filesystem changes with chokidar
**Vector Index**: Manages similarity search with cosine similarity
**File Processor**: Handles text extraction from various formats

### Performance Optimizations

- **Parallel Processing**: p-limit concurrency for multi-core scaling
- **Batch Embeddings**: Vectorized embedding generation
- **Streaming File I/O**: Memory-efficient large file handling
- **Background Indexing**: Non-blocking file change processing

## ⚡ Performance

### Baseline Performance (8-core system)

| Operation | Files | Time | Throughput |
|-----------|-------|------|------------|
| File Indexing | 100 docs | ~10s | ~10 files/sec |
| Repository Processing | 1GB repo | ~30s | ~33MB/sec |
| Search Query | 10K docs | ~50ms | Real-time |

### Scaling Factors

- **CPU Cores**: Linear performance scaling (4 cores = 4x speed)
- **Memory**: 1GB additional per 10K documents indexed
- **Storage**: ~0.1MB per document (SQLite overhead)

### Configuration Optimization

```typescript
// High-performance settings
const options = {
  // Increase concurrency for better CPU utilization
  maxFileProcessingConcurrency: 16,
  maxDirectoryConcurrency: 32,
  maxEmbeddingConcurrency: 8,

  // Optimize chunk sizes
  chunkSize: 1000,
  overlap: 200,

  // GPU acceleration (when available)
  useGPU: true,
  embeddingBatchSize: 32
};
```

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Custom docs folder
MCP_DOCS_FOLDER=/path/to/custom/docs

# Performance tuning
NODE_ENV=production

# Debug logging
DEBUG=local-search:*
```

### Performance Profiles

#### High-Performance Mode
```json
{
  "concurrency": {
    "maxFileProcessingConcurrency": 16,
    "maxDirectoryConcurrency": 32,
    "maxEmbeddingConcurrency": 8
  }
}
```

#### Low-Memory Mode
```json
{
  "concurrency": {
    "maxFileProcessingConcurrency": 2,
    "maxDirectoryConcurrency": 4,
    "maxEmbeddingConcurrency": 1
  }
}
```

### Embedding Models

The server uses optimized embedding models:

- **Primary**: `Xenova/paraphrase-multilingual-minilm-l12-v2` (fast, multi-lingual)
- **Alternative**: `Xenova/paraphrase-multilingual-mpnet-base-v2` (higher quality, slower)

To change models, modify the `EmbeddingService` configuration.

## 🔍 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check Node.js version
node --version  # Should be 18+

# Verify build
npm run build

# Check permissions
ls -la build/index.js
```

#### Out of Memory
```bash
# Increase Node.js memory
node --max-old-space-size=4096 build/index.js
```

#### Permission Errors
```bash
# Fix docs folder permissions
chmod -R 755 ~/.local/share/local-search-mcp/
```

#### Individual File Indexing Issues
```bash
# Fixed in latest version - files are now properly indexed
# using the parent directory for SearchService.indexFiles()
```

#### VectorIndex Statistics Errors
```bash
# Fixed in latest version - VectorIndex.getStatistics() now works correctly
# with proper ES module imports
```

#### Slow Search/Google Colab Performance
```bash
# Disable GPU if causing issues
export MCP_EMBEDDING_GPU=false
```

### Debug Mode

```bash
# Enable detailed logging
DEBUG=local-search:* npm run dev

# Check server health
curl http://localhost:3000/health  # If applicable
```

### Reset Database

```bash
# Remove and recreate index
rm -f local-search-index.db
npm run build && npm start
```

## 🚀 Development

### Development Setup

```bash
# Install development dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests (when available)
npm test
```

### Project Structure

```
local-search-mcp/
├── src/                          # Source code
│   ├── core/                     # Core services
│   │   ├── EmbeddingService.ts   # Transformer embeddings
│   │   ├── FileProcessor.ts      # Text extraction
│   │   ├── FileWatcher.ts        # FS monitoring
│   │   ├── RepoService.ts        # GitHub processing
│   │   ├── SearchService.ts      # Search orchestration
│   │   ├── TextChunker.ts        # Document chunking
│   │   └── VectorIndex.ts        # Vector storage/search
│   ├── types/                    # TypeScript definitions
│   └── index.ts                  # MCP server entry point
├── spec/                         # Documentation & requirements
├── documentation/                # Generated API docs
├── build/                        # Compiled JavaScript
└── package.json
```

### Adding Features

1. **New File Types**: Extend `FileProcessor.isFileSupported()`
2. **New Embeddings**: Modify `EmbeddingService.config.model`
3. **New Tools**: Add to `LocalSearchServer.setupToolHandlers()`
4. **Performance Tweaks**: Adjust `ConcurrencyConfig` values

## 📚 Documentation

Additional documentation available in `/documentation/`:

- **API Reference**: Complete MCP tool specifications
- **Architecture Guide**: Detailed component interactions
- **Performance Tuning**: Optimization best practices
- **Migration Guide**: Upgrading from previous versions

## 🤝 Contributing

Contributions welcome! Please:

1. **Fork** the repository
2. **Create** a feature branch
3. **Test** thoroughly with different file types and sizes
4. **Submit** a pull request with documentation

### Development Guidelines

- **TypeScript**: Strict type checking enabled
- **Error Handling**: Comprehensive try/catch blocks
- **Performance**: Profile memory and CPU usage
- **Testing**: Unit tests for all new functionality

### Architecture Principles

- **Modularity**: Separate concerns across service classes
- **Concurrency**: Non-blocking operations with p-limit
- **Observability**: Detailed logging and error reporting
- **Extensibility**: Plugin architecture for file processors

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **@xenova/transformers**: High-performance JavaScript ML models
- **chokidar**: Robust file system watching
- **repomix**: GitHub repository processing
- **p-limit**: JavaScript concurrency control
- **MCP**: Model Context Protocol specification

---

**Built for AI-assisted development** 🔍🤖
**Fast, reliable, and semantic document search**
