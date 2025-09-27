import Database from 'better-sqlite3';
import { DocumentChunk, DocumentChunkOptimized, VectorIndexStatistics, StorageError, ContentMetadata } from '../types/index.js';
import { log } from './Logger.js';
import fs from 'node:fs';
import path from 'node:path';

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

export class VectorRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(db: Database.Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
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
  searchSimilar(queryEmbedding: number[], limit: number = 10, minScore: number = 0.0): DocumentChunk[] {
    const timer = log.time('vector-search');
    log.debug('Starting sqlite-vec native vector search', {
      queryEmbeddingSize: queryEmbedding.length,
      limit,
      minScore
    });

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
      log.info('sqlite-vec vector search completed', {
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

      return results;
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
              WHERE file_path = ? ORDER BY chunk_index
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
   * Store content metadata for enhanced document classification
   * @param chunkId Chunk identifier
   * @param metadata Enhanced content metadata
   */
  async storeContentMetadata(chunkId: string, metadata: ContentMetadata): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO content_metadata
        (chunk_id, content_type, language, domain_tags, quality_score, 
         source_authority, file_extension, has_comments, has_documentation, 
         processed_content, raw_content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        chunkId,
        metadata.contentType,
        metadata.language,
        JSON.stringify(metadata.domainTags),
        metadata.qualityScore,
        metadata.sourceAuthority,
        metadata.fileExtension,
        metadata.hasComments ? 1 : 0,
        metadata.hasDocumentation ? 1 : 0,
        metadata.processedContent || null,
        metadata.rawContent || null
      );

      log.debug('Content metadata stored', {
        chunkId: chunkId.substring(0, 16) + '...',
        contentType: metadata.contentType,
        language: metadata.language,
        domainCount: metadata.domainTags.length
      });

    } catch (error: any) {
      log.error('Failed to store content metadata', error, { chunkId });
      throw new StorageError(
        `Failed to store content metadata: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get content metadata for a chunk
   * @param chunkId Chunk identifier
   * @returns Content metadata or null if not found
   */
  async getContentMetadata(chunkId: string): Promise<ContentMetadata | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT content_type, language, domain_tags, quality_score, 
               source_authority, file_extension, has_comments, 
               has_documentation, processed_content, raw_content
        FROM content_metadata
        WHERE chunk_id = ?
      `);

      const row = stmt.get(chunkId) as any;

      if (!row) {
        return null;
      }

      return {
        contentType: row.content_type,
        language: row.language,
        domainTags: JSON.parse(row.domain_tags || '[]'),
        qualityScore: row.quality_score,
        sourceAuthority: row.source_authority,
        fileExtension: row.file_extension,
        hasComments: row.has_comments === 1,
        hasDocumentation: row.has_documentation === 1,
        processedContent: row.processed_content,
        rawContent: row.raw_content
      };

    } catch (error: any) {
      log.error('Failed to get content metadata', error, { chunkId });
      return null;
    }
  }

  /**
   * Enhanced search with content metadata support
   * @param queryEmbedding Query embedding vector
   * @param limit Maximum results to return
   * @param minScore Minimum similarity score
   * @returns Document chunks with enhanced metadata
   */
  async searchSimilarWithMetadata(queryEmbedding: number[], limit: number = 10, minScore: number = 0.0): Promise<DocumentChunkOptimized[]> {
    const timer = log.time('enhanced-vector-search');
    log.debug('Starting enhanced vector search with metadata', {
      queryEmbeddingSize: queryEmbedding.length,
      limit,
      minScore
    });

    try {
      return await new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            const queryVector = new Float32Array(queryEmbedding);

            // Join with content metadata for enhanced results
            const stmt = this.db.prepare(`
              SELECT
                vc.chunk_id, vc.file_path, vc.chunk_index, vc.content,
                vc.chunk_offset, vc.token_count, vc.created_at, vc.distance,
                cm.content_type, cm.language, cm.domain_tags, cm.quality_score,
                cm.source_authority, cm.file_extension, cm.has_comments,
                cm.has_documentation, cm.processed_content, cm.raw_content
              FROM vec_chunks vc
              LEFT JOIN content_metadata cm ON vc.chunk_id = cm.chunk_id
              WHERE vc.embedding MATCH ?
                AND k = ?
              ORDER BY vc.distance
            `);

            const allRows = stmt.all(queryVector, limit) as any[];
            const rows = allRows.filter(row => (row.distance || 0) >= minScore);

            timer();
            log.info('Enhanced vector search completed', {
              totalResults: rows.length,
              topScore: rows[0]?.distance || 0,
              withMetadata: rows.filter(r => r.content_type).length
            });

            const results = rows.map(row => {
              const result: DocumentChunkOptimized = {
                id: row.chunk_id,
                filePath: row.file_path,
                chunkIndex: row.chunk_index,
                content: row.content,
                score: row.distance || 0,
                metadata: {
                  fileSize: 0,
                  lastModified: new Date(row.created_at),
                  chunkOffset: row.chunk_offset,
                  tokenCount: row.token_count
                }
              };

              // Add enhanced content metadata if available
              if (row.content_type) {
                result.contentMetadata = {
                  contentType: row.content_type,
                  language: row.language,
                  domainTags: JSON.parse(row.domain_tags || '[]'),
                  qualityScore: row.quality_score,
                  sourceAuthority: row.source_authority,
                  fileExtension: row.file_extension,
                  hasComments: row.has_comments === 1,
                  hasDocumentation: row.has_documentation === 1,
                  processedContent: row.processed_content,
                  rawContent: row.raw_content
                };
              }

              return result;
            });

            resolve(results);
          } catch (error: any) {
            log.error('Enhanced vector search failed', error);
            reject(new StorageError(
              `Enhanced vector search failed: ${error.message}`,
              error
            ));
          }
        });
      });

    } catch (error: any) {
      log.error('Enhanced vector search failed', error);
      throw new StorageError(
        `Enhanced vector search failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Clear all vector data from index
   */
  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM vec_chunks');
      this.db.exec('DELETE FROM documents');
      this.db.exec('DELETE FROM content_metadata');
    } catch (error: any) {
      throw new StorageError(
        `Failed to clear vector index: ${error.message}`,
        error
      );
    }
  }
}
