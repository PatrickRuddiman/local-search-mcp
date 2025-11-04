# File Watcher Feature

## Overview

The File Watcher feature provides automatic monitoring and indexing of files placed in a designated directory. Files are automatically processed, chunked, embedded, and indexed without manual intervention, making it easy to maintain an up-to-date searchable knowledge base.

## Key Features

- **Automatic Processing**: Files are automatically indexed when added or updated
- **Real-time Monitoring**: Changes are detected immediately with intelligent debouncing
- **Recursive Watching**: Monitors subdirectories up to 10 levels deep
- **Smart Filtering**: Only processes supported file types
- **Background Jobs**: File processing happens asynchronously without blocking
- **Status Tracking**: Monitor watcher activity and file processing status
- **Error Resilience**: Automatic error recovery and retry mechanisms

## Watched Directory Location

The file watcher monitors a specific directory based on your platform:

### Linux
```
~/.local/share/local-search-mcp/docs/watched/
```

### macOS
```
~/Library/Application Support/local-search-mcp/docs/watched/
```

### Windows
```
%LOCALAPPDATA%\local-search-mcp\docs\watched\
```

### Custom Location
You can customize the location using environment variables:
```bash
# Set custom docs folder (watched will be a subdirectory)
export MCP_DOCS_FOLDER=/path/to/your/docs
```

## Supported File Types

The watcher processes the following file types:
- **Text**: `.txt`, `.md`, `.rst`
- **Code**: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.h`
- **Markup**: `.html`, `.xml`, `.css`, `.scss`
- **Data**: `.json`, `.yaml`, `.yml`, `.csv`

Files with other extensions are ignored.

## How It Works

### 1. Automatic Start
The file watcher starts automatically when the MCP server initializes. No manual configuration is required.

### 2. File Detection
The watcher monitors for three types of events:

#### File Addition
When a new file is added:
1. File is validated (type, size)
2. Background job is created
3. File is read and chunked
4. Embeddings are generated
5. Chunks are stored in the vector database

#### File Change
When an existing file is modified:
1. Change is debounced (500ms) to handle rapid edits
2. Background job is created
3. File is re-processed completely
4. Old chunks are replaced with new ones

#### File Deletion
When a file is removed:
1. All associated chunks are identified
2. Chunks are removed from the vector database
3. Embeddings are deleted

### 3. Debouncing
To handle rapid file modifications (e.g., during editing), the watcher implements intelligent debouncing:
- **Delay**: 500ms after last file event
- **Per-file**: Each file is debounced independently
- **Event-specific**: Add and change events are debounced separately

This prevents duplicate processing when you save a file multiple times quickly.

## Usage

### Adding Files for Indexing

Simply copy or move files into the watched directory:

```bash
# Linux/macOS
cp mydoc.md ~/.local/share/local-search-mcp/docs/watched/
cp -r myproject/ ~/.local/share/local-search-mcp/docs/watched/

# Windows
copy mydoc.md %LOCALAPPDATA%\local-search-mcp\docs\watched\
```

The files will be automatically processed within seconds.

### Organizing Files

You can organize files in subdirectories:

```
watched/
├── projects/
│   ├── project1/
│   │   └── README.md
│   └── project2/
│       └── docs.md
├── notes/
│   └── meeting-notes.txt
└── references/
    └── api-docs.json
```

All files in subdirectories (up to 10 levels deep) are monitored.

### Monitoring Status

Use MCP tools to monitor the watcher:

#### Get Watcher Status
```json
{
  "tool": "get_watcher_status"
}
```

Returns:
- Active status
- Watched directory path
- Processing statistics (files added, changed, removed)
- Error count
- Last activity timestamp

#### List Watched Files
```json
{
  "tool": "list_watched_files",
  "arguments": {
    "includeIndexed": true
  }
}
```

Returns:
- List of all files in watched directory
- File metadata (size, modified date)
- Indexing status for each file

## Best Practices

### 1. File Organization
- Create subdirectories for different projects or categories
- Use meaningful filenames
- Keep related files together

### 2. File Sizes
- Default maximum file size: 1GB
- Recommended size: < 100MB for optimal performance
- Large files take longer to process

### 3. Update Strategy
- For large files, consider using staging:
  1. Prepare file outside watched directory
  2. Move (not copy) into watched directory when ready
  3. This triggers only one processing event

### 4. Monitoring
- Check watcher status periodically
- Monitor for processing errors
- Use `get_job_status` to track long-running jobs

### 5. Performance
- The watcher processes files in background
- Multiple files can be processed concurrently
- Processing doesn't block other MCP operations

## Troubleshooting

### Files Not Being Processed

**Check file type:**
```bash
# Verify file extension is supported
ls -la ~/.local/share/local-search-mcp/docs/watched/
```

**Check watcher status:**
```json
{
  "tool": "get_watcher_status"
}
```

**Check for errors:**
Look at the error count in watcher statistics. Errors are logged for debugging.

### Processing Seems Slow

**Check active jobs:**
```json
{
  "tool": "list_active_jobs"
}
```

Multiple files processing simultaneously is normal. Each file is processed sequentially through:
1. Reading (fast)
2. Chunking (fast)
3. Embedding generation (slower - depends on file size)
4. Database storage (fast)

**Large files take longer:**
- Embedding generation is the slowest step
- Larger files → more chunks → more embeddings → longer processing

### File Changes Not Detected

**Verify file is actually changing:**
```bash
# Check modified timestamp
stat ~/.local/share/local-search-mcp/docs/watched/myfile.md
```

**Check debounce timing:**
Wait at least 500ms after the last save before expecting processing to start.

### Hidden Files Ignored

The watcher intentionally ignores hidden files (starting with `.`):
- `.gitignore`
- `.DS_Store`
- `.hidden-file`

This is by design to avoid indexing system files.

## Technical Details

### Event Processing Pipeline

```
File Event
    ↓
Debounce (500ms)
    ↓
Validate File Type
    ↓
Create Background Job
    ↓
Extract Text Content
    ↓
Chunk Text (1000 tokens, 200 overlap)
    ↓
Generate Embeddings (batched)
    ↓
Store in Vector Database
    ↓
Update Job Status
    ↓
Complete
```

### Resource Usage

- **CPU**: Moderate during embedding generation
- **Memory**: Peaks during embedding generation (~100-500MB per file)
- **Disk I/O**: Minimal, only during database writes
- **Network**: None (local processing only)

### Concurrency

- Multiple files can be processed simultaneously
- Each file gets its own background job
- Job manager handles queueing and progress tracking
- Event loop yielding prevents blocking

### Error Handling

- File read errors → Job fails, logged
- Chunking errors → Job fails, logged
- Embedding errors → Batch retry, then fail
- Database errors → Transaction rollback, job fails

All errors are logged with full context for debugging.

## Integration with Other Features

### Search
Once files are indexed, they're immediately searchable:
```json
{
  "tool": "search_documents",
  "arguments": {
    "query": "your search query"
  }
}
```

### File Details
View indexed chunks for watched files:
```json
{
  "tool": "get_file_details",
  "arguments": {
    "filePath": "/path/to/watched/file.md"
  }
}
```

### Removal
Manually remove files from index:
```json
{
  "tool": "remove_file",
  "arguments": {
    "filePath": "/path/to/watched/file.md"
  }
}
```

## Security Considerations

1. **Local Only**: File watcher only monitors local filesystem
2. **No Network Access**: No external connections made
3. **Permissions**: Uses standard filesystem permissions
4. **No Execution**: Files are only read, never executed
5. **Isolation**: Each file processed in isolated context

## Limitations

1. **Directory Depth**: Maximum 10 levels of subdirectories
2. **File Size**: Default maximum 1GB (configurable in code)
3. **File Types**: Only supported extensions are processed
4. **Platform-Specific**: Uses platform-specific default paths
5. **No Symlinks**: Symbolic links are not followed

## Future Enhancements

Potential future improvements:
- Configurable file patterns via MCP tool
- Watch multiple directories
- Custom chunk sizes per file type
- Incremental updates for large files
- File content hashing to skip unchanged files
- Configurable debounce delays
- Exclude patterns (like `.gitignore`)

## Examples

### Example 1: Adding Documentation

```bash
# Copy documentation files
cp -r ./docs/*.md ~/.local/share/local-search-mcp/docs/watched/docs/

# Check status after a few seconds
# Use get_watcher_status MCP tool

# Search the newly indexed content
# Use search_documents MCP tool with relevant query
```

### Example 2: Updating Project Files

```bash
# Edit a file in the watched directory
vim ~/.local/share/local-search-mcp/docs/watched/project/README.md

# Save changes
# File is automatically re-indexed within seconds

# Verify re-indexing
# Use get_job_status or list_active_jobs
```

### Example 3: Monitoring a Development Project

```bash
# Create project structure
mkdir -p ~/.local/share/local-search-mcp/docs/watched/myproject
cd ~/myproject

# Copy source files
cp src/*.ts ~/.local/share/local-search-mcp/docs/watched/myproject/

# Files are automatically indexed
# As you edit files in your IDE and save, they're re-indexed automatically
```

## Related Documentation

- [API Reference](../api/file-watcher-api.md) - Detailed API specifications
- [Architecture](../architecture/file-watcher-architecture.md) - Technical design
- [Usage Guide](../usage/README.md) - General usage patterns
