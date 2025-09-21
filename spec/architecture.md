# Architecture Overview

## Simple Two-Part Architecture

### Frontend: MCP Server (Main Thread)
- **Responsibility**: Handle MCP tool requests only
- **Instant Tools**: search_documents, get_file_details, remove_file
- **Async Tools**: fetch_repo, fetch_file (return job IDs immediately)
- **Job Management**: get_job_status, list_active_jobs

### Backend: Async Processor
- **Responsibility**: Background processing pipelines
- **Concurrency**: Multiple fetch requests can run simultaneously
- **Progress Tracking**: Real-time accurate progress reporting
- **Simple Design**: No complex threading, just async functions

## System Components

### 1. SearchService (Main Thread)
- **Responsibility**: Fast query operations only
- **Features**: 
  - Semantic similarity search
  - File chunk retrieval
  - Database lookups
- **Performance**: Instant response times

### 2. BackgroundProcessor
- **Responsibility**: Async file processing pipelines
- **Operations**: 
  - Repository download and processing
  - File download and processing
  - File deletion from index
- **Progress**: Real-time progress callbacks

### 3. JobManager
- **Responsibility**: Track background job progress
- **Features**:
  - Accurate progress calculation
  - Job status tracking
  - Concurrent job management

### 4. Core Services (Shared)
- **FileProcessor**: Text extraction from various formats
- **TextChunker**: Document segmentation with overlap
- **EmbeddingService**: Vector generation using transformers
- **VectorIndex**: SQLite-vec storage and similarity search

## Processing Pipeline

### Repository Fetch Pipeline
```
fetch_repo request → return jobId immediately
                  ↓
Background: download(0-30%) → chunk(30-50%) → embed(50-90%) → store(90-100%)
```

### File Fetch Pipeline  
```
fetch_file request → return jobId immediately
                  ↓
Background: download(0-40%) → chunk(40-60%) → embed(60-95%) → store(95-100%)
```

### Search Pipeline
```
search_documents → query embedding → similarity search → return results
(instant response, ~50ms)
```

## Data Flow

```
MCP Request → Frontend (instant response) → Background Processor (async)
                                        ↓
JobManager (progress tracking) ← Pipeline Steps (real progress)
```

## Concurrency Model

**Main Thread:**
- MCP server handling requests
- SearchService for instant operations
- JobManager for progress queries

**Background Tasks:**
- Multiple async processing pipelines running concurrently
- Each pipeline: download → chunk → embed → store
- Real progress tracking throughout each step

## Storage

### SQLite Vector Database
- **Tables**: documents (metadata), vec_chunks (vectors + content)
- **Technology**: sqlite-vec for native vector similarity search
- **Performance**: Optimized for fast queries and batch inserts

### File System
- **Repository files**: `~/.local/share/local-search-mcp/docs/repositories/`
- **Downloaded files**: `~/.local/share/local-search-mcp/docs/fetched/`
- **Database**: `~/.local/share/local-search-mcp/data/`

## Performance Characteristics

### Response Times
- **Instant tools**: <100ms (search, file details, remove)
- **Async tools**: <5ms (immediate job ID return)
- **Background processing**: Real progress tracking

### Memory Usage
- **Main thread**: Minimal (no large data structures)
- **Background tasks**: Per-pipeline memory usage
- **Embeddings**: Singleton service with model caching

### Scalability
- **Concurrent requests**: Multiple background pipelines
- **Large files**: Streaming processing with progress callbacks
- **Database**: SQLite-vec optimized for vector operations

## Simplicity Features

### No Complex Threading
- No worker pools or thread managers
- Simple async functions with callbacks
- Standard JavaScript concurrency model

### Real Progress Tracking
- Download progress from HTTP content-length
- Chunking progress from actual chunk counts
- Embedding progress from batch completion
- Storage progress from database operations

### Error Handling
- Graceful failure with detailed error messages
- Job-level error tracking and reporting
- No cascading failures between pipelines
