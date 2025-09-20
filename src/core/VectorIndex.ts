import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DocumentChunk, VectorIndexStatistics, StorageError } from '../types/index.js';
import { log } from './Logger.js';
import { getDataFolder, getMcpPaths } from './PathUtils.js';

// Database row interfaces
interface DocumentRow {
  file_path: string;
  file_name: string;
  last_modified: string;
  total_chunks: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

interface ChunkRow {
  id: string;
  file_path: string;
  chunk_index: number;
  content: string;
  embedding_json: string;
  score: number;
  chunk_offset: number;
  token_count: number;
  created_at: string;
}

interface DocumentStats {
  documents: number;
  total_chunks: number;
  total_tokens: number;
}

export class VectorIndex {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    log.debug('Initializing VectorIndex');

    const mcpPaths = getMcpPaths();
    this.dbPath = mcpPaths.database;
    log.debug('VectorIndex database location', { 
      dbPath: this.dbPath,
      dataFolder: mcpPaths.data 
    });

    this.db = new Database(this.dbPath);

    log.debug('VectorIndex database connection established');
    this.initializeTables();

    log.info('VectorIndex initialized successfully', { dbPath: this.dbPath });
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    try {
      // Enable WAL mode for better performance and concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache

      // Create documents table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          file_path TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          last_modified DATETIME NOT NULL,
          total_chunks INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create chunks table with vector embeddings
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding_json TEXT NOT NULL, -- JSON string of number array
          score REAL DEFAULT 0.0,
          chunk_offset INTEGER NOT NULL,
          token_count INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_path) REFERENCES documents (file_path) ON DELETE CASCADE,
          UNIQUE(file_path, chunk_index)
        )
      `);

      // Create indexes for performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON chunks (file_path);
        CREATE INDEX IF NOT EXISTS idx_chunks_content ON chunks (content);
        CREATE INDEX IF NOT EXISTS idx_documents_file_name ON documents (file_name);
      `);

      // Create metadata table for index statistics
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

    } catch (error: any) {
      throw new StorageError(
        `Failed to initialize database: ${error.message}`,
        error
      );
    }
  }

  /**
   * Store document chunks with their embeddings
   * @param chunks Array of document chunks
   * @returns Number of chunks stored
   */
  async storeChunks(chunks: DocumentChunk[]): Promise<number> {
    if (chunks.length === 0) {
      log.debug('No chunks to store, returning 0');
      return 0;
    }

    const timer = log.time('store-chunks');
    log.info('Starting chunk storage operation', {
      totalChunks: chunks.length,
      uniqueFiles: new Set(chunks.map(c => c.filePath)).size
    });

    try {
      const transaction = this.db.transaction((chunkList: DocumentChunk[]) => {
        // Group chunks by file path
        const fileGroups = new Map<string, DocumentChunk[]>();

        for (const chunk of chunkList) {
          if (!fileGroups.has(chunk.filePath)) {
            fileGroups.set(chunk.filePath, []);
          }
          fileGroups.get(chunk.filePath)!.push(chunk);
        }

        // Process each file group
        for (const [filePath, fileChunks] of fileGroups) {
          // Upsert document record
          const firstChunk = fileChunks[0];
          const docStmt = this.db.prepare(`
            INSERT OR REPLACE INTO documents
            (file_path, file_name, last_modified, total_chunks, total_tokens, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
          `);

          docStmt.run(
            filePath,
            path.basename(filePath),
            firstChunk.metadata.lastModified.toISOString(),
            fileChunks.length,
            fileChunks.reduce((sum, c) => sum + c.metadata.tokenCount, 0)
          );

          // Insert/update chunks
          const chunkStmt = this.db.prepare(`
            INSERT OR REPLACE INTO chunks
            (id, file_path, chunk_index, content, embedding_json,
             score, chunk_offset, token_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `);

          for (const chunk of fileChunks) {
            chunkStmt.run(
              chunk.id,
              chunk.filePath,
              chunk.chunkIndex,
              chunk.content,
              JSON.stringify(chunk.embedding),
              chunk.score || 0.0,
              chunk.metadata.chunkOffset,
              chunk.metadata.tokenCount
            );
          }
        }
      });

      transaction(chunks);

      // Update statistics
      await this.updateMetadata();

      timer();
      log.info('Chunk storage operation completed successfully', {
        totalStored: chunks.length
      });

      return chunks.length;
    } catch (error: any) {
      log.error('Chunk storage operation failed', error, {
        chunkCount: chunks.length
      });
      throw new StorageError(
        `Failed to store chunks: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search for similar chunks using cosine similarity
   * @param queryEmbedding Query embedding vector
   * @param limit Maximum results to return
   * @param minScore Minimum similarity score (0-1)
   * @returns Sorted array of matching chunks with scores
   */
  async searchSimilar(queryEmbedding: number[], limit: number = 10, minScore: number = 0.0): Promise<DocumentChunk[]> {
    const timer = log.time('vector-search');
    log.debug('Starting vector similarity search', {
      queryEmbeddingSize: queryEmbedding.length,
      limit,
      minScore
    });

    try {
      // Get all chunks from database (in production, you'd use more sophisticated indexing)
      const stmt = this.db.prepare('SELECT * FROM chunks ORDER BY file_path, chunk_index');
      const rows = stmt.all() as ChunkRow[];

      log.debug('Retrieved chunks from database', { totalChunks: rows.length });

      const results: Array<{ chunk: DocumentChunk; similarity: number }> = [];

      for (const row of rows) {
        const embedding = JSON.parse(row.embedding_json);

        if (embedding.length === 0) {
          continue; // Skip chunks with empty embeddings
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embedding);

        if (similarity >= minScore) {
          const chunk: DocumentChunk = {
            id: row.id,
            filePath: row.file_path,
            chunkIndex: row.chunk_index,
            content: row.content,
            embedding,
            score: similarity,
            metadata: {
              fileSize: 0, // Not stored, could be recalculated if needed
              lastModified: new Date(),
              chunkOffset: row.chunk_offset,
              tokenCount: row.token_count
            }
          };

          results.push({ chunk, similarity });
        }
      }

      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);

      // Return top results
      const finalResults = results.slice(0, limit).map(r => r.chunk);

      timer();
      log.info('Vector search completed', {
        totalCandidates: rows.length,
        matchingResults: finalResults.length,
        topScore: finalResults[0]?.score || 0
      });

      return finalResults;

    } catch (error: any) {
      log.error('Vector search failed', error);
      throw new StorageError(
        `Search failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get chunk by ID
   * @param chunkId Chunk identifier
   * @returns DocumentChunk or null if not found
   */
  async getChunk(chunkId: string): Promise<DocumentChunk | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM chunks WHERE id = ?');
      const row = stmt.get(chunkId) as ChunkRow | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        filePath: row.file_path,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: JSON.parse(row.embedding_json),
        score: row.score,
        metadata: {
          fileSize: 0,
          lastModified: new Date(),
          chunkOffset: row.chunk_offset,
          tokenCount: row.token_count
        }
      };
    } catch (error: any) {
      throw new StorageError(
        `Failed to get chunk: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all chunks for a specific file
   * @param filePath File path
   * @returns Array of document chunks
   */
  async getFileChunks(filePath: string): Promise<DocumentChunk[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM chunks WHERE file_path = ? ORDER BY chunk_index');
      const rows = stmt.all(filePath) as ChunkRow[];

      return rows.map(row => ({
        id: row.id,
        filePath: row.file_path,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: JSON.parse(row.embedding_json),
        score: row.score,
        metadata: {
          fileSize: 0,
          lastModified: new Date(),
          chunkOffset: row.chunk_offset,
          tokenCount: row.token_count
        }
      }));
    } catch (error: any) {
      throw new StorageError(
        `Failed to get file chunks: ${error.message}`,
        error
      );
    }
  }

  /**
   * Delete chunks for a specific file
   * @param filePath File path
   * @returns Number of chunks deleted
   */
  async deleteFile(filePath: string): Promise<number> {
    try {
      // Cascading deletes will handle chunk removal due to FOREIGN KEY constraint
      const docStmt = this.db.prepare('DELETE FROM documents WHERE file_path = ?');
      const result = docStmt.run(filePath);

      // Update statistics
      await this.updateMetadata();

      return result.changes;
    } catch (error: any) {
      throw new StorageError(
        `Failed to delete file: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get index statistics
   * @returns Statistics about the index
   */
  async getStatistics(): Promise<VectorIndexStatistics> {
    try {
      // Get overall counts
      const docStmt = this.db.prepare(`
        SELECT COUNT(*) as documents,
               SUM(total_chunks) as total_chunks,
               SUM(total_tokens) as total_tokens
        FROM documents
      `);
      const docStats = docStmt.get() as DocumentStats | undefined;

      // Get embeddings info
      const embedStmt = this.db.prepare('SELECT embedding_json FROM chunks LIMIT 1');
      const firstEmbed = embedStmt.get();

      let embeddingModel = 'unknown';
      let dimensions = 0;

      if (firstEmbed) {
        try {
          const embedding = JSON.parse((firstEmbed as ChunkRow).embedding_json);
          dimensions = embedding.length;
        } catch { } // Ignore parse errors
      }

      // Get file size (approximate)
      const fs = require('fs').promises;
      let dbSize = 0;

      try {
        const stats = await fs.stat(this.dbPath);
        dbSize = stats.size;
      } catch { } // Ignore file size errors

      return {
        totalChunks: docStats?.total_chunks || 0,
        totalFiles: docStats?.documents || 0,
        totalTokens: docStats?.total_tokens || 0,
        embeddingModel,
        lastUpdated: new Date(),
        dbSize
      };
    } catch (error: any) {
      throw new StorageError(
        `Failed to get statistics: ${error.message}`,
        error
      );
    }
  }

  /**
   * Cosine similarity calculation
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    if (vec1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Update metadata statistics
   */
  private async updateMetadata(): Promise<void> {
    try {
      const stats = await this.getStatistics();

      const updateStmt = this.db.prepare(`
        INSERT OR REPLACE INTO metadata (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
      `);

      updateStmt.run('total_chunks', stats.totalChunks.toString());
      updateStmt.run('total_files', stats.totalFiles.toString());
      updateStmt.run('total_tokens', stats.totalTokens.toString());
      updateStmt.run('last_updated', stats.lastUpdated.toISOString());
    } catch (error: any) {
      console.warn('Failed to update metadata:', error.message);
      // Don't throw - metadata update is not critical
    }
  }

  /**
   * Clear all data from index
   */
  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM chunks');
      this.db.exec('DELETE FROM documents');
      this.db.exec('DELETE FROM metadata');
      await this.updateMetadata();
    } catch (error: any) {
      throw new StorageError(
        `Failed to clear index: ${error.message}`,
        error
      );
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
    } catch (error: any) {
      console.warn('Error closing database:', error.message);
    }
  }
}
