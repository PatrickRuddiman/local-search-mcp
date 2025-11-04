# File Watcher API Reference

## Overview

This document provides detailed API specifications for the File Watcher MCP tools and their responses.

## MCP Tools

### get_watcher_status

Get the current status and statistics of the file watcher.

#### Input Schema

```json
{
  "type": "object",
  "properties": {}
}
```

No parameters required.

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "📁 **File Watcher Status**\n\n🔄 Status: ✅ Active\n📂 Watched Directory: /path/to/watched\n📊 Statistics:\n   • Files Added: 5\n   • Files Changed: 12\n   • Files Removed: 2\n   • Errors: 0\n   • Last Activity: 2025-01-14T20:30:00.000Z\n⏳ Pending Debounces: 0\n\nThe file watcher automatically processes files placed in the watched directory."
    },
    {
      "type": "text",
      "text": "{\"isActive\":true,\"watchedDirectory\":\"/path/to/watched\",\"stats\":{\"filesAdded\":5,\"filesChanged\":12,\"filesRemoved\":2,\"errors\":0,\"lastActivity\":\"2025-01-14T20:30:00.000Z\"},\"pendingDebounces\":0}"
    }
  ]
}
```

#### Response Fields

**Status Object:**
- `isActive` (boolean): Whether the watcher is currently active
- `watchedDirectory` (string): Absolute path to the watched directory
- `stats` (object): Processing statistics
  - `filesAdded` (number): Total files added since server start
  - `filesChanged` (number): Total files modified since server start
  - `filesRemoved` (number): Total files deleted since server start
  - `errors` (number): Total errors encountered
  - `lastActivity` (string | null): ISO timestamp of last file event, or null if no activity
- `pendingDebounces` (number): Number of file events currently being debounced

#### Example Usage

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_watcher_status",
    "arguments": {}
  }
}
```

**Success Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "📁 **File Watcher Status**\n\n🔄 Status: ✅ Active\n..."
    },
    {
      "type": "text",
      "text": "{\"isActive\":true,...}"
    }
  ]
}
```

#### Status Indicators

- **✅ Active**: Watcher is running and monitoring files
- **❌ Inactive**: Watcher is stopped (should not occur during normal operation)

---

### list_watched_files

List all files in the watched directory with their metadata and indexing status.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "includeIndexed": {
      "type": "boolean",
      "default": true,
      "description": "Include indexing status for each file"
    }
  }
}
```

#### Parameters

- `includeIndexed` (boolean, optional): Whether to check and include the indexing status for each file. Default: `true`
  - When `true`: Queries the database to determine if each file is indexed (slower but more informative)
  - When `false`: Skips database queries (faster but no indexing status)

#### Response Format

**When files exist:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "📁 **Watched Files** (3 total)\n\n📊 Summary:\n   • Total Files: 3\n   • Indexed: 2\n   • Pending: 1\n   • Total Size: 1.25MB\n\nFiles (showing first 20):\n\n1. ✅ README.md (45.2KB)\n   Path: /path/to/watched/README.md\n   Modified: 2025-01-14T20:00:00.000Z\n\n2. ✅ docs.txt (120.5KB)\n   Path: /path/to/watched/docs.txt\n   Modified: 2025-01-14T19:45:00.000Z\n\n3. ⏳ data.json (89.3KB)\n   Path: /path/to/watched/data.json\n   Modified: 2025-01-14T20:30:00.000Z"
    },
    {
      "type": "text",
      "text": "[{\"path\":\"/path/to/watched/README.md\",\"basename\":\"README.md\",\"size\":46285,\"modified\":\"2025-01-14T20:00:00.000Z\",\"isIndexed\":true},...]"
    }
  ]
}
```

**When no files exist:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "No files found in watched directory.\n\nWatched Directory: /path/to/watched\n\nAdd supported files (.txt, .md, .json, etc.) to this directory for automatic indexing."
    }
  ]
}
```

#### Response Fields

**File Object:**
- `path` (string): Absolute path to the file
- `basename` (string): Filename without directory path
- `size` (number): File size in bytes
- `modified` (string): ISO timestamp of last modification
- `isIndexed` (boolean): Whether the file is currently indexed in the database

#### File Status Indicators

- **✅**: File is indexed and searchable
- **⏳**: File is pending indexing or processing

#### Limits

- Text response shows first 20 files
- JSON response includes up to 50 files
- For directories with more files, additional files are noted but not returned

#### Example Usage

**Request with index checking:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "list_watched_files",
    "arguments": {
      "includeIndexed": true
    }
  }
}
```

**Request without index checking (faster):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "list_watched_files",
    "arguments": {
      "includeIndexed": false
    }
  }
}
```

---

## Background Job Types

The file watcher creates three types of background jobs for processing:

### watch_add

Created when a new file is added to the watched directory.

**Job Metadata:**
```json
{
  "type": "watch_add",
  "metadata": {
    "filePath": "/path/to/watched/newfile.md",
    "eventType": "add"
  }
}
```

**Processing Steps:**
1. File validation (0-10%)
2. Text extraction (10-20%)
3. Chunking (20-30%)
4. Embedding generation (30-90%)
5. Database storage (90-100%)

### watch_change

Created when an existing file in the watched directory is modified.

**Job Metadata:**
```json
{
  "type": "watch_change",
  "metadata": {
    "filePath": "/path/to/watched/existingfile.md",
    "eventType": "change"
  }
}
```

**Processing Steps:**
Same as `watch_add` - the file is completely re-processed and old chunks are replaced.

### watch_remove

Created when a file is deleted from the watched directory.

**Job Metadata:**
```json
{
  "type": "watch_remove",
  "metadata": {
    "filePath": "/path/to/watched/deletedfile.md",
    "eventType": "unlink"
  }
}
```

**Processing Steps:**
1. Locate file chunks in database (0-10%)
2. Delete chunks and embeddings (10-100%)

## Job Progress Tracking

File watcher jobs can be tracked using standard job management tools:

### get_job_status

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_job_status",
    "arguments": {
      "jobId": "job_abc123_xyz789"
    }
  }
}
```

**Response includes:**
- Job ID
- Job type (`watch_add`, `watch_change`, or `watch_remove`)
- Status (running, completed, failed)
- Progress percentage (0-100)
- Duration
- Error message (if failed)

### list_active_jobs

Shows all currently running jobs, including file watcher jobs:

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_active_jobs",
    "arguments": {}
  }
}
```

## Event Types

The file watcher handles three types of file system events:

### add

**Trigger**: New file created or copied into watched directory

**Behavior**:
- Validates file type and size
- Creates `watch_add` job
- Processes file completely
- Stores chunks in database

**Debounced**: Yes (500ms)

### change

**Trigger**: Existing file modified

**Behavior**:
- Validates file still exists and is supported type
- Creates `watch_change` job
- Re-processes file completely
- Replaces old chunks with new ones

**Debounced**: Yes (500ms)

**Note**: Multiple rapid changes within 500ms are coalesced into a single processing event.

### unlink

**Trigger**: File deleted from watched directory

**Behavior**:
- Creates `watch_remove` job immediately
- Removes all associated chunks from database
- Deletes embeddings

**Debounced**: No (immediate processing)

## Error Responses

### Watcher Status Error

```json
{
  "error": {
    "code": "InternalError",
    "message": "Failed to get watcher status: [error details]"
  }
}
```

### List Files Error

```json
{
  "error": {
    "code": "InternalError",
    "message": "Failed to list watched files: [error details]"
  }
}
```

## Error Codes

File watcher operations can fail with the following error codes:

- **InternalError**: General internal error (e.g., filesystem access issues)
- **InvalidPath**: Watched directory doesn't exist or is inaccessible
- **ProcessingError**: File processing failed (logged for debugging)

## Integration with Existing Tools

### search_documents

After files are processed by the watcher, they're immediately searchable:

```json
{
  "method": "tools/call",
  "params": {
    "name": "search_documents",
    "arguments": {
      "query": "content from watched file"
    }
  }
}
```

### get_file_details

View chunks from a watched file:

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_file_details",
    "arguments": {
      "filePath": "/path/to/watched/file.md"
    }
  }
}
```

### remove_file

Manually remove a watched file from the index (file itself is not deleted):

```json
{
  "method": "tools/call",
  "params": {
    "name": "remove_file",
    "arguments": {
      "filePath": "/path/to/watched/file.md"
    }
  }
}
```

## Rate Limits

No artificial rate limits are imposed. The file watcher processes files as quickly as the system allows:

- **CPU-bound**: Embedding generation is the limiting factor
- **Concurrent**: Multiple files can be processed simultaneously
- **Debounced**: Rapid file changes are coalesced

## Performance Characteristics

### Operation Timing

| Operation | Typical Duration | Notes |
|-----------|------------------|-------|
| File detection | < 100ms | Chokidar event latency |
| Debounce wait | 500ms | For add/change events |
| File read | 10-100ms | Depends on file size |
| Chunking | 10-50ms | Depends on content length |
| Embedding (per batch) | 100-500ms | Most time-consuming step |
| Database write | 10-50ms | Per batch of chunks |
| **Total (small file)** | **1-2s** | < 100KB |
| **Total (large file)** | **10-60s** | 1-10MB |

### Resource Usage

- **Memory**: ~100-500MB peak per file during embedding
- **CPU**: Moderate-high during embedding generation
- **Disk I/O**: Minimal (sequential database writes)
- **Network**: None (fully local)

## Best Practices for API Usage

### 1. Polling Status
```javascript
// Don't poll too frequently
setInterval(() => {
  getWatcherStatus();
}, 5000); // 5 seconds is reasonable
```

### 2. Monitoring Jobs
```javascript
// Track job IDs from active jobs
const activeJobs = await listActiveJobs();
for (const job of activeJobs.filter(j => j.type.startsWith('watch_'))) {
  const status = await getJobStatus(job.id);
  console.log(`${job.type}: ${status.progress}%`);
}
```

### 3. Error Handling
```javascript
try {
  const files = await listWatchedFiles();
  // Process files
} catch (error) {
  if (error.code === 'InternalError') {
    // Handle gracefully - may be temporary
    console.error('Temporary error listing files:', error.message);
  }
}
```

## Changelog

### Version 2.2.0
- Initial release of file watcher feature
- Added `get_watcher_status` tool
- Added `list_watched_files` tool
- Added three new job types: `watch_add`, `watch_change`, `watch_remove`
- Automatic start on server initialization
- Graceful shutdown integration

## Related Documentation

- [User Guide](../features/file-watcher.md) - End-user documentation
- [Architecture](../architecture/file-watcher-architecture.md) - Technical design
- [API Reference](README.md) - General API documentation
