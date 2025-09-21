import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { DocumentChunk, VectorIndexStatistics, StorageError } from '../types/index.js';
import { log } from './Logger.js';
import { getMcpPaths } from './PathUtils.js';
import path from 'node:path';
import fs from 'node:fs';

// Database row interfaces for sqlite-vec
interface VecChunkRow {
  chunk_id: string;
  file_path: string;
  chunk_index: number;
  content: string;
  chunk_offset: number;
  token_count: number;
  created_at: string;
  distance?: number;
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
    log.debug('Initializing VectorIndex with sqlite-vec (async mode)');

    const mcpPaths = getMcpPaths();
    this.dbPath = mcpPaths.database;
    
    this.db = new Database(this.dbPath);
    
    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    log.info('sqlite-vec extension loaded successfully');

    this.initializeTables();
    log.info('VectorIndex initialized with native vector search via sqlite-vec (async mode)');
  }

  private initializeTables(): void {
    try {
      // Database optimizations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000');

      // Documents metadata table
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

      // sqlite-vec virtual table for vector search
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
          embedding float[512],
          chunk_id TEXT PRIMARY KEY,
          file_path TEXT,
          chunk_index INTEGER,
          content TEXT,
          chunk_offset INTEGER,
          token_count INTEGER,
          created_at TEXT
        )
      `);

      // Indexes for fast retrieval
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_file_name ON documents(file_name);
      `);

    } catch (error: any) {
      throw new StorageError(
        `Failed to initialize sqlite-vec database: ${error.message}`,
        error
      );
    }
  }

  /**
   * Store document chunks with their embeddings using sqlite-vec
   * @param chunks Array of document chunks
   * @returns Number of chunks stored
   */
  async storeChunks(chunks: DocumentChunk[]): Promise<number> {
    if (chunks.length === 0) return 0;

    const timer = log.time('store-chunks');
    log.info('Starting sqlite-vec chunk storage', {
      totalChunks: chunks.length,
      uniqueFiles: new Set(chunks.map(c => c.filePath)).size
    });

    try {
      const transaction = this.db.transaction((chunkList: DocumentChunk[]) => {
        // Group chunks by file
        const fileGroups = new Map<string, DocumentChunk[]>();
        for (const chunk of chunkList) {
          if (!fileGroups.has(chunk.filePath)) {
            fileGroups.set(chunk.filePath, []);
          }
          fileGroups.get(chunk.filePath)!.push(chunk);
        }

        // Update documents table
        const docStmt = this.db.prepare(`
          INSERT OR REPLACE INTO documents
          (file_path, file_name, last_modified, total_chunks, total_tokens, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

        for (const [filePath, fileChunks] of fileGroups) {
          const firstChunk = fileChunks[0];
          docStmt.run(
            filePath,
            path.basename(filePath),
            firstChunk.metadata.lastModified.toISOString(),
            fileChunks.length,
            fileChunks.reduce((sum, c) => sum + c.metadata.tokenCount, 0)
          );
        }

        // Store chunks in vec0 table using sqlite-vec
        // Use CAST to force SQLite INTEGER conversion from JavaScript numbers
        const vecStmt = this.db.prepare(`
          INSERT OR REPLACE INTO vec_chunks 
          (embedding, chunk_id, file_path, chunk_index, content, chunk_offset, token_count, created_at)
          VALUES (?, ?, ?, CAST(? AS INTEGER), ?, CAST(? AS INTEGER), CAST(? AS INTEGER), ?)
        `);

        for (const chunk of chunkList) {
          // sqlite-vec expects Float32Array for embeddings
          const embedding = new Float32Array(chunk.embedding);
          
          vecStmt.run(
            embedding,
            chunk.id,
            chunk.filePath,
            chunk.chunkIndex,
            chunk.content,
            chunk.metadata.chunkOffset,
            chunk.metadata.tokenCount,
            new Date().toISOString()
          );
        }
      });

      transaction(chunks);
      timer();
      
      log.info('sqlite-vec chunk storage completed', { totalStored: chunks.length });
      return chunks.length;

    } catch (error: any) {
      log.error('sqlite-vec chunk storage failed', error);
      throw new StorageError(
        `Failed to store chunks: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search for similar chunks using sqlite-vec native vector similarity search (ASYNC)
   * @param queryEmbedding Query embedding vector
   * @param limit Maximum results to return
   * @param minScore Minimum similarity score (0-1)
   * @returns Sorted array of matching chunks with scores
   */
  async searchSimilar(queryEmbedding: number[], limit: number = 10, minScore: number = 0.0): Promise<DocumentChunk[]> {
    const timer = log.time('vector-search');
    log.debug('Starting sqlite-vec native vector search (ASYNC)', {
      queryEmbeddingSize: queryEmbedding.length,
      limit,
      minScore
    });

    try {
      // Use setImmediate to avoid blocking main thread (2025 best practice)
      return await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            // Convert query embedding to Float32Array for sqlite-vec
            const queryVector = new Float32Array(queryEmbedding);
            
            // Use sqlite-vec's MATCH syntax with k parameter for KNN search
            const stmt = this.db.prepare(`
              SELECT 
                chunk_id, file_path, chunk_index, content,
                chunk_offset, token_count, created_at,
                distance
              FROM vec_chunks 
              WHERE embedding MATCH ? 
                AND k = ?
              ORDER BY distance
            `);
            
            const allRows = stmt.all(
              queryVector,
              limit
            ) as VecChunkRow[];
            
            // Filter by minimum score after retrieval
            const rows = allRows.filter(row => (row.distance || 0) >= minScore);
            
            timer();
            log.info('sqlite-vec vector search completed (ASYNC)', {
              totalResults: rows.length,
              topScore: rows[0]?.distance || 0
            });
            
            const results = rows.map(row => ({
              id: row.chunk_id,
              filePath: row.file_path,
              chunkIndex: row.chunk_index,
              content: row.content,
              embedding: [], // Don't return embeddings to save memory
              score: row.distance || 0,
              metadata: {
                fileSize: 0,
                lastModified: new Date(row.created_at),
                chunkOffset: row.chunk_offset,
                tokenCount: row.token_count
              }
            }));
            
            resolve(results);
          } catch (error: any) {
            log.error('sqlite-vec search failed (ASYNC)', error);
            reject(new StorageError(
              `Native vector search failed: ${error.message}`,
              error
            ));
          }
        });
      });

    } catch (error: any) {
      log.error('sqlite-vec search failed', error);
      throw new StorageError(
        `Native vector search failed: ${error.message}`,
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
      const stmt = this.db.prepare(`
        SELECT chunk_id, file_path, chunk_index, content, chunk_offset, token_count, created_at
        FROM vec_chunks 
        WHERE chunk_id = ?
      `);
      
      const row = stmt.get(chunkId) as VecChunkRow | undefined;
      
      if (!row) {
        return null;
      }

      return {
        id: row.chunk_id,
        filePath: row.file_path,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: [],
        score: 0,
        metadata: {
          fileSize: 0,
          lastModified: new Date(row.created_at),
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
   * Get all chunks for a specific file (ASYNC)
   * @param filePath File path
   * @returns Array of document chunks
   */
  async getFileChunks(filePath: string): Promise<DocumentChunk[]> {
    try {
      // Use setImmediate to avoid blocking main thread (2025 best practice)
      return await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            const stmt = this.db.prepare(`
              SELECT chunk_id, file_path, chunk_index, content, chunk_offset, token_count, created_at
              FROM vec_chunks 
              WHERE file_path = ? 
              ORDER BY chunk_index
            `);
            
            const rows = stmt.all(filePath) as VecChunkRow[];
            
            const results = rows.map(row => ({
              id: row.chunk_id,
              filePath: row.file_path,
              chunkIndex: row.chunk_index,
              content: row.content,
              embedding: [],
              score: 0,
              metadata: {
                fileSize: 0,
                lastModified: new Date(row.created_at),
                chunkOffset: row.chunk_offset,
                tokenCount: row.token_count
              }
            }));
            
            resolve(results);
          } catch (error: any) {
            reject(new StorageError(
              `Failed to get file chunks: ${error.message}`,
              error
            ));
          }
        });
      });
      
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
      // Delete from vec_chunks table
      const vecStmt = this.db.prepare('DELETE FROM vec_chunks WHERE file_path = ?');
      const vecResult = vecStmt.run(filePath);
      
      // Delete from documents table
      const docStmt = this.db.prepare('DELETE FROM documents WHERE file_path = ?');
      docStmt.run(filePath);
      
      return vecResult.changes;
    } catch (error: any) {
      throw new StorageError(
        `Failed to delete file: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get index statistics (ASYNC)
   * @returns Statistics about the index
   */
  async getStatistics(): Promise<VectorIndexStatistics> {
    try {
      // Use setImmediate to avoid blocking main thread (2025 best practice)
      return await new Promise((resolve, reject) => {
        setImmediate(async () => {
          try {
            const docStats = this.db.prepare(`
              SELECT COUNT(*) as documents,
                     SUM(total_chunks) as total_chunks,
                     SUM(total_tokens) as total_tokens
              FROM documents
            `).get() as DocumentStats | undefined;

            let dbSize = 0;
            try {
              const stats = await fs.promises.stat(this.dbPath);
              dbSize = stats.size;
            } catch { }

            const result = {
              totalChunks: docStats?.total_chunks || 0,
              totalFiles: docStats?.documents || 0,
              totalTokens: docStats?.total_tokens || 0,
              embeddingModel: 'universal-sentence-encoder',
              lastUpdated: new Date(),
              dbSize
            };
            
            resolve(result);
          } catch (error: any) {
            reject(new StorageError(
              `Failed to get statistics: ${error.message}`,
              error
            ));
          }
        });
      });
    } catch (error: any) {
      throw new StorageError(
        `Failed to get statistics: ${error.message}`,
        error
      );
    }
  }

  /**
   * Clear all data from index
   */
  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM vec_chunks');
      this.db.exec('DELETE FROM documents');
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
