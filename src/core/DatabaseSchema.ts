import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
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

      // Domain vocabulary for technology detection and search routing
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS domain_vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL, -- 'javascript', 'web-frameworks', 'databases'
          keywords TEXT NOT NULL, -- JSON array of weighted keywords
          authority_patterns TEXT, -- JSON array of authority indicators
          boost_factor REAL DEFAULT 1.0, -- Search boost multiplier
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        CREATE INDEX IF NOT EXISTS idx_domain_vocabulary_domain ON domain_vocabulary(domain);
        CREATE INDEX IF NOT EXISTS idx_query_intent_expires ON query_intent_cache(expires_at);
      `);

      // Initialize default domain vocabularies
      this.initializeDefaultDomainVocabularies();

    } catch (error: any) {
      throw new StorageError(
        `Failed to initialize sqlite-vec database: ${error.message}`,
        error
      );
    }
  }

  /**
   * Initialize default domain vocabularies for common technologies
   */
  private initializeDefaultDomainVocabularies(): void {
    const defaultVocabularies = [
      {
        domain: 'javascript',
        keywords: JSON.stringify([
          { keyword: 'javascript', weight: 1.0 },
          { keyword: 'js', weight: 0.9 },
          { keyword: 'node', weight: 0.8 },
          { keyword: 'npm', weight: 0.8 },
          { keyword: 'ES6', weight: 0.7 },
          { keyword: 'async', weight: 0.6 },
          { keyword: 'await', weight: 0.6 },
          { keyword: 'promise', weight: 0.7 }
        ]),
        authority_patterns: JSON.stringify([
          'developer.mozilla.org',
          'nodejs.org',
          'javascript.info'
        ]),
        boost_factor: 1.2
      },
      {
        domain: 'web-frameworks',
        keywords: JSON.stringify([
          { keyword: 'express', weight: 1.0 },
          { keyword: 'expressjs', weight: 1.0 },
          { keyword: 'react', weight: 1.0 },
          { keyword: 'vue', weight: 1.0 },
          { keyword: 'angular', weight: 1.0 },
          { keyword: 'middleware', weight: 0.8 },
          { keyword: 'router', weight: 0.7 },
          { keyword: 'component', weight: 0.6 }
        ]),
        authority_patterns: JSON.stringify([
          'expressjs.com',
          'reactjs.org',
          'vuejs.org',
          'angular.io'
        ]),
        boost_factor: 1.5
      },
      {
        domain: 'python',
        keywords: JSON.stringify([
          { keyword: 'python', weight: 1.0 },
          { keyword: 'pip', weight: 0.8 },
          { keyword: 'django', weight: 0.9 },
          { keyword: 'flask', weight: 0.9 },
          { keyword: 'import', weight: 0.6 },
          { keyword: 'def', weight: 0.5 },
          { keyword: 'class', weight: 0.5 }
        ]),
        authority_patterns: JSON.stringify([
          'python.org',
          'docs.python.org',
          'pypi.org'
        ]),
        boost_factor: 1.2
      },
      {
        domain: 'databases',
        keywords: JSON.stringify([
          { keyword: 'sql', weight: 1.0 },
          { keyword: 'database', weight: 0.9 },
          { keyword: 'mongodb', weight: 0.9 },
          { keyword: 'postgres', weight: 0.9 },
          { keyword: 'mysql', weight: 0.9 },
          { keyword: 'sqlite', weight: 0.8 },
          { keyword: 'query', weight: 0.7 },
          { keyword: 'schema', weight: 0.7 }
        ]),
        authority_patterns: JSON.stringify([
          'postgresql.org',
          'mysql.com',
          'mongodb.com',
          'sqlite.org'
        ]),
        boost_factor: 1.3
      }
    ];

    const insertVocabulary = this.db.prepare(`
      INSERT OR IGNORE INTO domain_vocabulary (domain, keywords, authority_patterns, boost_factor)
      VALUES (?, ?, ?, ?)
    `);

    for (const vocab of defaultVocabularies) {
      insertVocabulary.run(vocab.domain, vocab.keywords, vocab.authority_patterns, vocab.boost_factor);
    }

    log.info('Default domain vocabularies initialized', {
      domains: defaultVocabularies.map(v => v.domain)
    });
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
