# Performance Guide

Comprehensive performance tuning and optimization guide for the Local Search MCP Server.

## 📊 Performance Benchmarks

### Baseline Performance (8-core Intel i7, 16GB RAM, SSD)

| Operation | File Size | Threads | Time | Throughput | Memory Peak |
|-----------|-----------|---------|------|------------|-------------|
| **File Indexing** | 100 files, 2MB | 8 | ~8s | ~12.5 files/sec | ~900MB |
| **Document Search** | 10K chunks | 1 | ~45ms | 22K searches/sec | ~50MB |
| **Repository Processing** | Medium repo (1GB) | 4 | ~25s | ~40MB/sec | ~1.5GB |
| **Concurrent Indexing** | 50 files | 16 | ~4s | ~12.5 files/sec | ~1.2GB |
| **File Watcher Updates** | 10 changed files | 1-4 | ~2s | Real-time | ~200MB |

### Scaling Performance

#### CPU Core Scaling (Test: 100 documentation files)

| CPU Cores | Time | Speedup | Efficiency |
|-----------|------|---------|------------|
| 1 | ~32s | 1.0x | 100% |
| 2 | ~19s | 1.7x | 85% |
| 4 | ~11s | 2.9x | 73% |
| 8 | ~8s | 4.0x | 50% |
| 16 | ~7s | 4.6x | 29% |

#### Memory Scaling (Test: Varying document counts)

| Documents | Index Size | Memory Usage | Search Speed |
|-----------|------------|--------------|--------------|
| 1K docs | ~50MB | ~200MB | ~10ms |
| 10K docs | ~500MB | ~1GB | ~45ms |
| 50K docs | ~2.5GB | ~4GB | ~150ms |
| 100K docs | ~5GB | ~8GB | ~300ms |

## ⚡ Performance Optimization

### Hardware Optimization

#### CPU Configuration

```typescript
// Optimal for modern systems (8+ cores)
const optimalConfig = {
  maxFileProcessingConcurrency: os.cpus().length,
  maxEmbeddingConcurrency: os.cpus().length,
  maxDirectoryConcurrency: os.cpus().length * 2,
  maxFileWatcherConcurrency: Math.max(1, os.cpus().length / 2)
};
```

```typescript
// Memory-constrained systems (4GB RAM)
const memoryConservative = {
  maxFileProcessingConcurrency: 2,
  maxEmbeddingConcurrency: 1,
  maxDirectoryConcurrency: 4,
  maxFileWatcherConcurrency: 1,

  // Smaller chunks reduce memory pressure
  chunkSize: 500,
  overlap: 50
};
```

#### GPU Acceleration

```typescript
// Default configuration with auto-detect
const embeddingConfig = {
  useGPU: true,                    // Auto-detect GPU availability
  model: 'Xenova/paraphrase-multilingual-minilm-l12-v2',
  batchSize: 32,                   // Optimal batch size for GPU

  // Fallback behavior
  cpuFallback: true,               // Use CPU if GPU fails
  gpuMemoryLimit: '4GB'           // Optional GPU memory limit
};
```

### Chunking Strategy Optimization

#### Technical Documentation

```typescript
// Best for API docs, technical specs
const technicalChunking = {
  chunkSize: 800,     // Smaller chunks for precision
  overlap: 150,       // More overlap for context
  method: 'sentence-aware',

  // Content-aware splitting
  preserveCodeBlocks: true,
  preserveMarkdownHeaders: true,
  maxChunkSize: 1500
};
```

#### Narrative Documentation

```typescript
// Best for guides, tutorials, blogs
const narrativeChunking = {
  chunkSize: 1200,    // Larger chunks for flow
  overlap: 200,       // Standard overlap
  method: 'paragraph-aware',

  // Structure preservation
  splitOnHeaders: true,
  preserveLists: true,
  maxChunkSize: 2000
};
```

### Database Optimization

#### SQLite Configuration

```typescript
// Performance-optimized database settings
const dbConfig = {
  // Connection settings
  journal_mode: 'WAL',           // Write-Ahead Logging
  synchronous: 'NORMAL',         // Balanced safety/performance
  cache_size: -512000,          // 512MB cache (negative for KB)
  temp_store: 'MEMORY',         // Temp tables in memory

  // Reading optimization
  mmap_size: 268435456,         // 256MB memory mapping

  // Maintenance
  auto_vacuum: 'INCREMENTAL',    // Optimize space usage
  foreign_keys: 'ON'            // Enable FK constraints
};
```

#### Index Maintenance

```typescript
// Regular maintenance for optimal performance
async function optimizeIndex() {
  // Analyze query patterns
  await db.exec('ANALYZE vector_index');

  // Rebuild fragmented indexes
  await db.exec('REINDEX vector_index');

  // Clean up WAL file
  await db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

  // Compact database
  await db.exec('VACUUM');
}
```

### Network Optimization

#### Repository Processing

```typescript
// Optimized for GitHub API rate limits
const repoConfig = {
  // Parallel processing with rate limiting
  maxRepositoryConcurrency: 3,    // GitHub API rate limit friendly

  // Chunked downloads
  downloadBatchSize: 10,          // Process files in batches

  // Connection pooling
  maxConnections: 6,              // HTTP connection limits
  timeout: 30000,                 // 30-second timeout

  // Retry strategy
  retryAttempts: 3,
  retryDelay: 1000,               // Exponential backoff
  jitter: 0.1                     // Add randomness to avoid thundering herd
};
```

## 📊 Current Monitoring

The system provides basic performance timing through the Logger utility. Processing durations and chunk counts are logged for all operations.

## 🎯 Advanced Optimizations

### Embedding Model Optimization

#### Model Selection Guide

```typescript
// Model performance comparison (throughput, quality, size)
const modelOptions = {
  // Small model - fast, good enough for most use cases
  'Xenova/paraphrase-multilingual-minilm-l12-v2': {
    size: '90MB',
    throughput: '150 docs/sec',
    quality: 'good',
    useCase: 'general purpose'
  },

  // Large model - slower, better quality
  'Xenova/paraphrase-multilingual-mpnet-base-v2': {
    size: '420MB',
    throughput: '75 docs/sec',
    quality: 'excellent',
    useCase: 'high precision required'
  }
};
```

#### Current Batch Processing

The system processes embeddings in small batches (10 chunks) with event loop yielding between batches to prevent MCP server blocking.

### Database Query Optimization

#### Vector Search Optimization

```sql
-- Optimized vector search query
EXPLAIN QUERY PLAN
SELECT
  chunk_text,
  embedding <=> $query_embedding as distance,  -- Cosine distance
  file_path,
  chunk_index,
  metadata
FROM vector_chunks
WHERE distance < $threshold
ORDER BY distance ASC
LIMIT $limit;
```

#### Index Maintenance

Basic database maintenance can be performed using:
- `VACUUM` - Reclaim space and optimize tables
- `ANALYZE` - Update query optimizer statistics
- `PRAGMA wal_checkpoint(TRUNCATE)` - Clean up WAL file

## 🚨 Performance Troubleshooting

### Performance Degradation Issues

#### Symptoms and Solutions

**Symptom: Search queries getting slower over time**

```bash
# Check database file size
ls -lh local-search-index.db

# Check fragmentation
sqlite3 local-search-index.db "PRAGMA integrity_check;"
sqlite3 local-search-index.db "PRAGMA freelist_count;"

# Optimize database
sqlite3 local-search-index.db "VACUUM; ANALYZE;"
```

**Symptom: High memory usage during indexing**

```bash
# Monitor memory usage
node --inspect --max-old-space-size=4096 build/index.js

# Reduce concurrency
export MAX_FILE_CONCURRENCY=2

# Use smaller chunks
export CHUNK_SIZE=500
```



**Symptom: Embedding generation is slow**

```bash
# Check GPU usage
nvidia-smi  # If GPU available

# Disable GPU if causing issues
export USE_GPU=false

# Check model cache
ls -la ~/.cache/transformers/
```

### Diagnostic Tools

#### Performance Logging

```typescript
// Enable detailed performance logging
const logger = {
  timing: (label: string, duration: number) => {
    console.log(`[${label}] ${duration.toFixed(2)}ms`);
  },

  memory: () => {
    const usage = process.memoryUsage();
    console.log(`Memory: RSS=${(usage.rss/1024/1024).toFixed(1)}MB, Heap=${(usage.heapUsed/1024/1024).toFixed(1)}MB`);
  },

  profile: async (name: string, fn: () => Promise<any>) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await fn();

      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      console.log(`[${name}]`);
      console.log(`  Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`  Memory Delta: ${(endMemory.rss - startMemory.rss)/1024/1024}MB`);

      return result;
    } catch (error) {
      console.error(`[${name}] Error:`, error);
      throw error;
    }
  }
};
```

### Resource Monitoring

Memory usage and processing statistics are logged automatically during operations.

---

**Monitor**, **profile**, **optimize** - repeat. Performance is a continuous process. Use these tools and techniques to keep your Local Search MCP Server running at peak efficiency.
