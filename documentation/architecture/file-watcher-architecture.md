# File Watcher Architecture

## Overview

This document describes the technical architecture and design decisions for the File Watcher feature in the Local Search MCP server.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (index.ts)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │SearchService │  │BackgroundProc│  │  JobManager  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                           ▲                  ▲               │
│                           │                  │               │
│                    ┌──────┴──────────────────┴─────┐        │
│                    │      FileWatcher Service      │        │
│                    └──────┬──────────────────┬─────┘        │
└───────────────────────────┼──────────────────┼──────────────┘
                            │                  │
                    ┌───────▼────────┐  ┌─────▼──────┐
                    │   Chokidar     │  │JobManager  │
                    │   (fs watch)   │  │(async jobs)│
                    └───────┬────────┘  └─────┬──────┘
                            │                  │
                    ┌───────▼──────────────────▼──────┐
                    │     Filesystem Events           │
                    │  (add, change, unlink)          │
                    └─────────────────────────────────┘
```

## Component Design

### 1. FileWatcher Service

**Location**: `src/core/FileWatcher.ts`

**Responsibilities**:
- Monitor filesystem events using chokidar
- Debounce rapid file changes
- Validate file types and sizes
- Create background jobs for file processing
- Track statistics (files added, changed, removed, errors)
- Provide status information

**Key Methods**:
```typescript
class FileWatcher {
  async start(): Promise<void>
  async stop(): Promise<void>
  getStatus(): WatcherStatus
  async listWatchedFiles(includeIndexed: boolean): Promise<WatchedFileInfo[]>
  
  private handleFileAdd(filePath: string): void
  private handleFileChange(filePath: string): void
  private handleFileRemove(filePath: string): void
  private debounceFileEvent(filePath, eventType, callback): void
}
```

**State Management**:
- `isActive`: Boolean flag for watcher status
- `stats`: Cumulative statistics object
- `debounceTimers`: Map of active debounce timers per file
- `watcher`: Chokidar FSWatcher instance

### 2. Background Processor Integration

**Location**: `src/core/BackgroundProcessor.ts`

**New Method**:
```typescript
async processWatchedFile(
  jobId: string,
  filePath: string,
  eventType: 'add' | 'change' | 'unlink'
): Promise<void>
```

**Event Handling**:
- **add/change**: Full file processing pipeline
  - Text extraction
  - Chunking
  - Embedding generation
  - Database storage
- **unlink**: File removal
  - Lookup file chunks
  - Delete from vector database

**Reuse**: Leverages existing `processFile()` method for add/change operations

### 3. Job Manager Extension

**Location**: `src/core/JobManager.ts`

**New Job Types**:
```typescript
type JobType = 
  | 'fetch_repo' 
  | 'fetch_file' 
  | 'index_directory'
  | 'watch_add'      // NEW
  | 'watch_change'   // NEW
  | 'watch_remove';  // NEW
```

**Integration**: File watcher jobs appear in standard job listings and can be tracked with existing job status tools.

### 4. Path Utilities Update

**Location**: `src/core/PathUtils.ts`

**Addition**:
```typescript
// In getMcpPaths()
{
  // ...existing paths
  watched: path.join(docsFolder, 'watched'),  // NEW
}

// In initializeMcpDirectories()
await ensureDirectoryExists(watchedFolder, 'Watched files folder');
```

## Data Flow

### File Addition Flow

```
User adds file
      ↓
Chokidar detects 'add' event
      ↓
FileWatcher.handleFileAdd()
      ↓
Debounce (500ms)
      ↓
Validate file type
      ↓
Create 'watch_add' job
      ↓
BackgroundProcessor.processWatchedFile()
      ↓
Extract text → Chunk → Embed → Store
      ↓
Update job progress (0-100%)
      ↓
Complete job
      ↓
Update statistics
```

### File Change Flow

```
User modifies file
      ↓
Chokidar detects 'change' event
      ↓
FileWatcher.handleFileChange()
      ↓
Debounce (500ms) - coalesces rapid changes
      ↓
Validate file still exists
      ↓
Create 'watch_change' job
      ↓
BackgroundProcessor.processWatchedFile()
      ↓
Re-process file completely
      ↓
Replace old chunks with new ones
      ↓
Complete job
      ↓
Update statistics
```

### File Deletion Flow

```
User deletes file
      ↓
Chokidar detects 'unlink' event
      ↓
FileWatcher.handleFileRemove()
      ↓
NO debouncing (immediate)
      ↓
Create 'watch_remove' job
      ↓
BackgroundProcessor.processWatchedFile()
      ↓
VectorIndex.deleteFile(filePath)
      ↓
Remove all chunks from database
      ↓
Complete job
      ↓
Update statistics
```

## Key Design Decisions

### 1. Chokidar Library

**Choice**: Use chokidar for filesystem watching

**Rationale**:
- Already installed as dependency
- Cross-platform compatibility (Windows, macOS, Linux)
- Robust and battle-tested
- Handles edge cases (rapid changes, renames, etc.)
- Built-in support for ignore patterns

**Configuration**:
```typescript
chokidar.watch(watchedDir, {
  ignored: /(^|[\/\\])\../,  // Ignore dotfiles
  persistent: true,
  ignoreInitial: false,       // Process existing files on startup
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  },
  depth: 10
})
```

### 2. Debouncing Strategy

**Problem**: Rapid file saves generate multiple events

**Solution**: Per-file, per-event debouncing with 500ms delay

**Implementation**:
```typescript
private debounceTimers: Map<string, NodeJS.Timeout>
private readonly debounceDelay: number = 500

debounceFileEvent(filePath, eventType, callback) {
  const key = `${filePath}:${eventType}`;
  clearTimeout(this.debounceTimers.get(key));
  
  const timer = setTimeout(() => {
    this.debounceTimers.delete(key);
    callback();
  }, this.debounceDelay);
  
  this.debounceTimers.set(key, timer);
}
```

**Benefits**:
- Prevents duplicate processing
- Per-file independence
- Event-type specific (add vs change)

### 3. Automatic Startup

**Choice**: Start watcher automatically on server initialization

**Rationale**:
- Zero configuration required
- Immediate functionality
- Consistent with "it just works" philosophy
- Users expect filesystem watching to be active

**Implementation**:
```typescript
// In LocalSearchServer constructor
this.fileWatcher = new FileWatcher(
  this.backgroundProcessor,
  this.jobManager
);
this.fileWatcher.start();
```

### 4. Background Job Integration

**Choice**: Use existing job management system

**Rationale**:
- Consistent with other async operations (fetch_repo, fetch_file)
- Progress tracking out of the box
- Observable via existing tools
- Error handling infrastructure
- No new APIs needed

**Job Types**:
- `watch_add`: New file indexing
- `watch_change`: File re-indexing
- `watch_remove`: File removal

### 5. No Start/Stop Tools

**Choice**: Omit start_file_watcher and stop_file_watcher tools

**Rationale**:
- Watcher runs continuously by design
- Stopping would break expected behavior
- Simplifies user experience
- Reduces API surface
- Still observable via status tools

### 6. Separate Directory

**Choice**: Use dedicated `watched/` directory vs reusing `fetched/`

**Rationale**:
- Clear separation of concerns
- Different use cases (manual vs automatic)
- Easier to explain to users
- Future flexibility (different configs per directory)

## Error Handling

### File Processing Errors

**Strategy**: Fail gracefully, log, continue watching

```typescript
try {
  await this.backgroundProcessor.processWatchedFile(jobId, filePath, 'add');
  this.stats.filesAdded++;
} catch (error) {
  this.stats.errors++;
  this.jobManager.failJob(jobId, error.message);
  log.error('Failed to process added file', error, { filePath });
  // Watcher continues running
}
```

### Watcher Errors

**Strategy**: Log and continue

```typescript
.on('error', (error) => {
  this.stats.errors++;
  log.error('FileWatcher error', error);
  // Watcher remains active
})
```

### Recovery

- Individual file failures don't stop the watcher
- Users can retry by re-saving the file
- Status tool shows error count
- Detailed logs available for debugging

## Performance Considerations

### Memory Management

**Per-File Processing**:
- Peak memory: ~100-500MB during embedding
- Released after processing
- Multiple files processed concurrently

**Optimization**:
- Event loop yielding during embedding
- Batch processing (10 chunks at a time)
- Database writes in batches

### CPU Usage

**Embedding Generation**:
- Most CPU-intensive operation
- TensorFlow.js utilizes available cores
- Background processing doesn't block MCP server

**File I/O**:
- Minimal - sequential file reads
- Chokidar uses efficient native watchers

### Scalability

**File Count**:
- No hard limit on number of files
- Efficient file listing (recursive scan)
- Status queries are fast (in-memory stats)

**Concurrent Processing**:
- Multiple files can process simultaneously
- JobManager handles queueing
- Event loop yielding prevents blocking

## Security Considerations

### 1. File System Access

- Read-only access to watched directory
- No file execution
- Standard OS permissions apply
- No network access

### 2. Path Validation

- File paths sanitized
- No symlink following
- Hidden files ignored
- Directory traversal prevented

### 3. Resource Limits

- Default max file size: 1GB
- Directory depth limit: 10 levels
- Supported file types only

## Testing Considerations

### Unit Tests

**FileWatcher**:
- Event handling (add, change, unlink)
- Debouncing behavior
- Statistics tracking
- Status reporting

**Background Processing**:
- Watched file processing
- Error handling
- Job completion

### Integration Tests

**End-to-End**:
- Add file → Index → Search
- Modify file → Re-index → Search
- Delete file → Remove from index
- Multiple concurrent files

### Manual Testing

**Scenarios**:
1. Add single file
2. Add multiple files
3. Rapid file edits (debouncing)
4. Large files
5. Invalid file types
6. Subdirectories
7. Server restart (existing files)

## Future Enhancements

### Potential Improvements

1. **Configurable Patterns**
   ```typescript
   configureWatcher({
     include: ['**/*.md', '**/*.txt'],
     exclude: ['**/node_modules/**']
   })
   ```

2. **Multiple Watch Directories**
   ```typescript
   addWatchDirectory('/path/to/other/dir')
   ```

3. **Incremental Updates**
   - Hash-based change detection
   - Only re-process changed chunks
   - Faster for large files

4. **Priority Queue**
   - Process important files first
   - User-defined priorities

5. **Batch Operations**
   - Group related file changes
   - Single re-index operation

6. **Watch Pause/Resume**
   - Temporary disable watching
   - Bulk file operations

## Monitoring and Observability

### Metrics Available

**Via get_watcher_status**:
- Active status
- Files processed (added/changed/removed)
- Error count
- Last activity timestamp
- Pending debounces

**Via list_active_jobs**:
- Currently processing files
- Progress per file
- Processing duration

**Via Logs**:
- Detailed event information
- Error stack traces
- Performance timing
- Job lifecycle

### Log Levels

- **DEBUG**: Event details, debouncing
- **INFO**: File processing start/complete
- **WARN**: Invalid files, configuration issues
- **ERROR**: Processing failures, watcher errors

## Integration Points

### 1. SearchService

Files indexed by watcher are immediately searchable via `search_documents` tool.

### 2. VectorIndex

Watcher uses shared VectorIndex instance (via ServiceLocator) for:
- Storing embeddings
- Removing files
- Checking index status

### 3. JobManager

All file operations tracked as jobs:
- Visible in active jobs list
- Trackable with job status tool
- Statistics included in job stats

### 4. Logger

Comprehensive logging:
- All file events logged
- Processing pipeline steps
- Errors with full context

## Platform-Specific Behavior

### Linux

- Uses inotify for native filesystem watching
- Efficient for large number of files
- Instant event detection

### macOS

- Uses FSEvents API
- May batch events (< 100ms)
- Handles case-insensitive filesystem

### Windows

- Uses ReadDirectoryChangesW
- May have file locking issues during edit
- awaitWriteFinish handles this

## Code Organization

```
src/
├── core/
│   ├── FileWatcher.ts          # Main watcher service
│   ├── BackgroundProcessor.ts  # processWatchedFile method
│   ├── JobManager.ts           # Extended job types
│   ├── PathUtils.ts            # watched path support
│   └── ...
├── index.ts                    # Watcher initialization
└── types/
    └── index.ts                # Type definitions

documentation/
├── features/
│   └── file-watcher.md         # User guide
├── api/
│   └── file-watcher-api.md     # API reference
└── architecture/
    └── file-watcher-architecture.md  # This document
```

## Dependencies

### Direct

- **chokidar**: ^4.0.1 - Filesystem watching
- Already installed, no new dependencies

### Indirect

- **FileProcessor**: Text extraction and chunking
- **EmbeddingService**: Generate embeddings
- **VectorIndex**: Store and query vectors
- **JobManager**: Job tracking
- **Logger**: Event logging

## References

- [Chokidar Documentation](https://github.com/paulmillr/chokidar)
- [Node.js fs.watch](https://nodejs.org/api/fs.html#fswatchfilename-options-listener)
- [File System Events (macOS)](https://developer.apple.com/documentation/coreservices/file_system_events)
- [inotify (Linux)](https://man7.org/linux/man-pages/man7/inotify.7.html)

## Related Documentation

- [User Guide](../features/file-watcher.md)
- [API Reference](../api/file-watcher-api.md)
- [General Architecture](README.md)
