import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';
import fs from 'fs';
import { log } from './Logger.js';
import { getMcpPaths } from './PathUtils.js';
import { StorageError } from '../types/index.js';

export class DatabaseSchema {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    log.debug('Initializing DatabaseSchema with sqlite-vec');

    const mcpPaths = getMcpPaths();
    this.dbPath = mcpPaths.database;

    // Ensure the database directory exists 
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        log.debug('Created database directory', { path: dbDir });
      } catch (error: any) {
        throw new StorageError(
          `Failed to create database directory ${dbDir}: ${error.message}`,
          error
        );
      }
    }

    this.db = new Database(this.dbPath);

    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    log.info('sqlite-vec extension loaded successfully');

    this.initializeTables();
    log.info('DatabaseSchema initialized with native vector search');
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

      // Search recommendations table with 30-day TTL
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_recommendations (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          suggested_terms TEXT NOT NULL, -- JSON array
          suggestion_strategy TEXT NOT NULL,
          tfidf_threshold REAL NOT NULL,
          confidence REAL NOT NULL,
          generated_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL,
          total_documents INTEGER NOT NULL,
          analyzed_documents INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Effectiveness tracking table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS recommendation_effectiveness (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recommendation_id TEXT NOT NULL,
          was_used BOOLEAN NOT NULL,
          improved_results BOOLEAN,
          usage_time DATETIME,
          effectiveness_score REAL NOT NULL,
          original_result_count INTEGER NOT NULL,
          improved_result_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (recommendation_id) REFERENCES search_recommendations(id) ON DELETE CASCADE
        )
      `);

      // Learning parameters table (single row)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_parameters (
          id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row
          current_tfidf_threshold REAL NOT NULL DEFAULT 0.25,
          effectiveness_history TEXT NOT NULL DEFAULT '[]', -- JSON array
          strategy_weights TEXT NOT NULL, -- JSON object with strategy weights
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          learning_rate REAL NOT NULL DEFAULT 0.05
        )
      `);

      // Content metadata table for classification and domain tagging
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS content_metadata (
          chunk_id TEXT PRIMARY KEY,
          content_type TEXT, -- 'code', 'docs', 'config', 'mixed'
          language TEXT, -- programming language or 'natural'
          domain_tags TEXT, -- JSON array of technology keywords
          quality_score REAL, -- 0-1 content quality score
          source_authority REAL, -- 0-1 authority score (official docs = higher)
          processed_content TEXT, -- cleaned/enhanced content for search
          raw_content TEXT, -- original content for display
          file_extension TEXT, -- .js, .md, etc.
          has_comments BOOLEAN DEFAULT FALSE,
          has_documentation BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chunk_id) REFERENCES vec_chunks(chunk_id) ON DELETE CASCADE
        )
      `);

      // Query intent classification cache
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_intent_cache (
          query_hash TEXT PRIMARY KEY,
          detected_domains TEXT, -- JSON array of detected domains
          confidence REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME -- 24 hour TTL
        )
      `);

      // Indexes for recommendation system performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_recommendations_query ON search_recommendations(query);
        CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON search_recommendations(expires_at);
        CREATE INDEX IF NOT EXISTS idx_effectiveness_recommendation ON recommendation_effectiveness(recommendation_id);
      `);

      // Indexes for content classification and domain search
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_content_metadata_type ON content_metadata(content_type);
        CREATE INDEX IF NOT EXISTS idx_content_metadata_language ON content_metadata(language);
        CREATE INDEX IF NOT EXISTS idx_content_metadata_quality ON content_metadata(quality_score);
        CREATE INDEX IF NOT EXISTS idx_content_metadata_authority ON content_metadata(source_authority);
        CREATE INDEX IF NOT EXISTS idx_query_intent_expires ON query_intent_cache(expires_at);
      `);

    } catch (error: any) {
      throw new StorageError(
        `Failed to initialize sqlite-vec database: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Get the database path
   */
  getDatabasePath(): string {
    return this.dbPath;
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
