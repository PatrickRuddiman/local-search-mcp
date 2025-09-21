# Local Search MCP Server Requirements

## Overview
Build a simple MCP server that fetches, indexes, and serves documents for AI context integration. The server enables AI agents to access documentation and files through fast semantic search, with a clean two-part architecture: instant queries on the main thread and background processing for heavy operations.

## Core Functionality
- **Repository Fetching**: Clone and convert GitHub repositories using repomix
- **File Fetching**: Download individual files from URLs  
- **Text Processing**: Chunk and embed downloaded content
- **Semantic Search**: Fast similarity search across indexed content
- **File Management**: Remove files and their associated data
- **Progress Tracking**: Real-time accurate progress for background operations

## Supported File Types
- **Repository Fetching**: Documentation formats (`.md`, `.txt`, `.json`, `.rst`, `.yaml`, `.yml`) via repomix
- **File Fetching**: All text-based formats including code files
- **Extensible**: Format support configurable per operation

## Architecture Requirements

### Two-Part Design
1. **Frontend (Main Thread)**: MCP server handling tool requests
2. **Backend (Async)**: Simple background processing pipelines

### Performance Requirements
- **Instant Tools**: <100ms response (search, file details, remove)
- **Async Tools**: <5ms response (immediate job ID return)
- **Background Processing**: Real progress tracking with accurate percentages
- **Concurrent Operations**: Multiple fetch requests processed simultaneously

### Simplicity Requirements
- **No Complex Threading**: Simple async functions only
- **No Worker Pools**: Standard JavaScript concurrency
- **Real Progress**: Based on actual pipeline steps, not arbitrary percentages
- **Clean Error Handling**: Job-level error tracking and reporting

## API Interface

### Instant Tools (Main Thread)
- `search_documents`: Query indexed content
- `get_file_details`: Retrieve specific chunks with context
- `remove_file`: Delete file and all associated data

### Async Tools (Background Jobs)
- `fetch_repo`: Download and process repository
- `fetch_file`: Download and process individual file
- `get_job_status`: Check job progress with real percentages
- `list_active_jobs`: List all running background operations

## Processing Pipeline

### Pipeline Steps (Per Request)
1. **Download** (0-30%): Repository cloning or file download with HTTP progress
2. **Content Processing** (30-50%): Text extraction and chunking with real chunk counts
3. **Embedding Generation** (50-90%): Vector creation with batch progress tracking
4. **Storage** (90-100%): Database insertion with real completion tracking

### Progress Accuracy
- Download progress from HTTP content-length headers
- Chunking progress from actual chunk count processing
- Embedding progress from completed batches vs total batches
- Storage progress from database insertion completion

## Storage Requirements

### SQLite Vector Database
- **Technology**: sqlite-vec for native vector search
- **Tables**: documents (metadata), vec_chunks (vectors + content)
- **Performance**: Optimized for fast similarity queries

### File System Organization
- **Repository files**: `~/.local/share/local-search-mcp/docs/repositories/`
- **Downloaded files**: `~/.local/share/local-search-mcp/docs/fetched/`
- **Database**: `~/.local/share/local-search-mcp/data/`

## Dependencies
- `@modelcontextprotocol/sdk` for MCP compliance
- `@tensorflow-models/universal-sentence-encoder` for embeddings
- `sqlite-vec` for vector storage and search
- `better-sqlite3` for database operations
- `repomix` for repository processing
- `chokidar` for file watching (if needed)

## Error Handling Requirements

### Graceful Failure
- Background job errors don't affect main thread
- Detailed error reporting in job status
- Partial processing results when possible
- No cascading failures between concurrent jobs

### Standard Error Types
- Network errors for downloads
- Processing errors for chunking/embedding
- Storage errors for database operations
- Validation errors for invalid inputs

## Testing Requirements
- Integration tests for MCP interface
- Background processing pipeline tests
- Concurrent operation tests
- Progress tracking accuracy tests
- Error handling and recovery tests

## Future Simplicity
- Maintain simple async design
- Avoid complex threading patterns
- Keep real progress tracking
- Preserve clean separation of concerns
