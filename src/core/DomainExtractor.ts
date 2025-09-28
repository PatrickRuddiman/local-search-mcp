import path from 'path';
import * as Database from 'better-sqlite3';
import { DomainVocabulary, KeywordWeight, DomainMatch } from '../types/index.js';
import { log } from './Logger.js';

/**
 * Domain extractor for detecting technology keywords and domain classification
 */
export class DomainExtractor {
  private db: Database.Database;
  private vocabularies: Map<string, DomainVocabulary> = new Map();
  private lastVocabularyUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(database: Database.Database) {
    this.db = database;
    this.loadVocabularies();
    
    log.info('DomainExtractor initialized', {
      vocabularyCount: this.vocabularies.size,
      domains: Array.from(this.vocabularies.keys())
    });
  }

  /**
   * Extract domain tags from content
   */
  async extractDomainTags(
    content: string,
    filePath: string,
    language: string
  ): Promise<string[]> {
    const timer = log.time(`domain-extract-${path.basename(filePath)}`);

    try {
      log.debug('Starting domain extraction', {
        filePath: path.basename(filePath),
        language,
        contentLength: content.length
      });

      // Refresh vocabularies if needed
      this.refreshVocabulariesIfNeeded();

      // Extract domains using multiple strategies
      const pathDomains = this.extractFromPath(filePath);
      const languageDomains = this.extractFromLanguage(language);
      const contentDomains = this.extractFromContent(content);
      const contextDomains = this.extractFromContext(content, filePath);

      // Combine and score all detected domains
      const domainScores = new Map<string, number>();

      // Add path-based domains with high confidence
      for (const domain of pathDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + 0.8);
      }

      // Add language-based domains with medium confidence
      for (const domain of languageDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + 0.6);
      }

      // Add content-based domains with variable confidence
      for (const [domain, score] of contentDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + score);
      }

      // Add context-based domains
      for (const [domain, score] of contextDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + score);
      }

      // Filter and sort by confidence
      const finalDomains = Array.from(domainScores.entries())
        .filter(([, score]) => score >= 0.3) // Minimum confidence threshold
        .sort(([, a], [, b]) => b - a) // Sort by confidence descending
        .slice(0, 5) // Limit to top 5 domains
        .map(([domain]) => domain);

      timer();
      log.debug('Domain extraction completed', {
        filePath: path.basename(filePath),
        detectedDomains: finalDomains,
        totalCandidates: domainScores.size
      });

      return finalDomains;

    } catch (error: any) {
      log.error('Domain extraction failed', error, {
        filePath: path.basename(filePath),
        contentLength: content.length
      });
      return [];
    }
  }

  /**
   * Classify query intent by detecting domains
   */
  async classifyQueryIntent(query: string): Promise<DomainMatch[]> {
    const timer = log.time(`query-intent-${query.substring(0, 20)}`);

    try {
      log.debug('Classifying query intent', {
        query: query.substring(0, 50),
        queryLength: query.length
      });

      // Refresh vocabularies if needed
      this.refreshVocabulariesIfNeeded();

      const queryLower = query.toLowerCase();
      const queryWords = this.tokenizeQuery(queryLower);

      const domainMatches: DomainMatch[] = [];

      // Check each domain vocabulary
      for (const [domainName, vocabulary] of this.vocabularies) {
        const matchedKeywords: string[] = [];
        let totalWeight = 0;
        let maxWeight = 0;

        // Check for keyword matches
        for (const keywordData of vocabulary.keywords) {
          const keyword = keywordData.keyword.toLowerCase();
          
          if (queryWords.includes(keyword) || queryLower.includes(keyword)) {
            matchedKeywords.push(keyword);
            totalWeight += keywordData.weight;
            maxWeight = Math.max(maxWeight, keywordData.weight);
          }
        }

        // Calculate confidence based on matches
        if (matchedKeywords.length > 0) {
          // Confidence factors:
          // - Number of matched keywords
          // - Weight of matched keywords
          // - Exact vs partial matches
          // - Query coverage
          
          const keywordFactor = Math.min(matchedKeywords.length / 3, 1); // Up to 3 keywords = max
          const weightFactor = Math.min(totalWeight / 2, 1); // Normalize weights
          const coverageFactor = Math.min(
            matchedKeywords.join(' ').length / query.length, 
            0.8
          ); // Max 80% coverage

          const confidence = (keywordFactor * 0.4 + weightFactor * 0.4 + coverageFactor * 0.2);

          if (confidence >= 0.2) { // Minimum confidence threshold
            domainMatches.push({
              domain: domainName,
              confidence,
              matchedKeywords,
              boostFactor: vocabulary.boostFactor
            });
          }
        }
      }

      // Sort by confidence and limit results
      const sortedMatches = domainMatches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Top 3 domain matches

      timer();
      log.debug('Query intent classification completed', {
        query: query.substring(0, 50),
        detectedDomains: sortedMatches.map(m => m.domain),
        confidences: sortedMatches.map(m => m.confidence.toFixed(3))
      });

      return sortedMatches;

    } catch (error: any) {
      log.error('Query intent classification failed', error, {
        query: query.substring(0, 50)
      });
      return [];
    }
  }

  /**
   * Extract domains from file path
   */
  private extractFromPath(filePath: string): string[] {
    const pathLower = filePath.toLowerCase();
    const domains: string[] = [];

    // Check for framework/library names in path
    const pathIndicators = {
      'javascript': ['js', 'node', 'npm'],
      'web-frameworks': ['express', 'react', 'vue', 'angular', 'next', 'nuxt'],
      'python': ['python', 'py', 'pip', 'django', 'flask'],
      'databases': ['db', 'database', 'sql', 'mongo', 'postgres', 'mysql'],
      'devops': ['docker', 'k8s', 'kubernetes', 'ci', 'cd', 'deploy'],
      'testing': ['test', 'spec', '__tests__', 'cypress', 'jest']
    };

    for (const [domain, indicators] of Object.entries(pathIndicators)) {
      if (indicators.some(indicator => pathLower.includes(indicator))) {
        domains.push(domain);
      }
    }

    return domains;
  }

  /**
   * Extract domains from programming language
   */
  private extractFromLanguage(language: string): string[] {
    const languageMap: { [key: string]: string[] } = {
      'javascript': ['javascript', 'web-frameworks'],
      'typescript': ['javascript', 'web-frameworks'],
      'python': ['python'],
      'java': ['java', 'enterprise'],
      'csharp': ['dotnet', 'enterprise'],
      'go': ['go', 'backend'],
      'rust': ['rust', 'systems'],
      'php': ['php', 'web-frameworks'],
      'ruby': ['ruby', 'web-frameworks'],
      'shell': ['devops', 'automation'],
      'sql': ['databases'],
      'yaml': ['devops', 'configuration'],
      'json': ['configuration', 'api'],
      'html': ['web-frontend'],
      'css': ['web-frontend']
    };

    return languageMap[language.toLowerCase()] || [];
  }

  /**
   * Extract domains from content analysis
   */
  private extractFromContent(content: string): Map<string, number> {
    const contentLower = content.toLowerCase();
    const domainScores = new Map<string, number>();

    // Analyze content for each vocabulary
    for (const [domainName, vocabulary] of this.vocabularies) {
      let domainScore = 0;
      let matchCount = 0;

      for (const keywordData of vocabulary.keywords) {
        const keyword = keywordData.keyword.toLowerCase();
        const regex = new RegExp(`\\b${this.escapeRegExp(keyword)}\\b`, 'gi');
        const matches = contentLower.match(regex);

        if (matches) {
          const keywordScore = matches.length * keywordData.weight * 0.1;
          domainScore += keywordScore;
          matchCount++;
        }
      }

      // Normalize score by vocabulary size and content length
      if (matchCount > 0) {
        const normalizedScore = Math.min(
          domainScore / Math.log(content.length + 1000) * 100,
          1.0
        );
        
        if (normalizedScore >= 0.1) {
          domainScores.set(domainName, normalizedScore);
        }
      }
    }

    return domainScores;
  }

  /**
   * Extract domains from contextual analysis
   */
  private extractFromContext(content: string, filePath: string): Map<string, number> {
    const contextScores = new Map<string, number>();

    // Analyze import statements and dependencies
    const importPatterns = [
      /import\s+.*?['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /from\s+['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1].toLowerCase();
        
        // Map common imports to domains
        if (importPath.includes('express')) {
          contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.3);
        } else if (importPath.includes('react')) {
          contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.3);
        } else if (importPath.includes('vue')) {
          contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.3);
        } else if (importPath.includes('angular')) {
          contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.3);
        } else if (importPath.includes('django') || importPath.includes('flask')) {
          contextScores.set('python', (contextScores.get('python') || 0) + 0.3);
          contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.2);
        }
      }
    }

    // Analyze package.json or requirements.txt content
    if (filePath.includes('package.json') || content.includes('"dependencies"')) {
      contextScores.set('javascript', (contextScores.get('javascript') || 0) + 0.4);
      if (content.includes('express')) {
        contextScores.set('web-frameworks', (contextScores.get('web-frameworks') || 0) + 0.4);
      }
    } else if (filePath.includes('requirements.txt') || filePath.includes('Pipfile')) {
      contextScores.set('python', (contextScores.get('python') || 0) + 0.4);
    }

    // Analyze Docker and infrastructure context
    if (content.includes('FROM ') || content.includes('COPY ') || filePath.includes('dockerfile')) {
      contextScores.set('devops', (contextScores.get('devops') || 0) + 0.3);
    }

    return contextScores;
  }

  /**
   * Load vocabularies from database
   */
  private loadVocabularies(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT domain, keywords, authority_patterns, boost_factor
        FROM domain_vocabulary
        ORDER BY domain
      `);

      const rows = stmt.all() as Array<{
        domain: string;
        keywords: string;
        authority_patterns: string;
        boost_factor: number;
      }>;

      this.vocabularies.clear();

      for (const row of rows) {
        try {
          const vocabulary: DomainVocabulary = {
            domain: row.domain,
            keywords: JSON.parse(row.keywords) as KeywordWeight[],
            authorityPatterns: JSON.parse(row.authority_patterns) as string[],
            boostFactor: row.boost_factor
          };

          this.vocabularies.set(row.domain, vocabulary);
        } catch (parseError: any) {
          log.warn('Failed to parse vocabulary data for domain: ' + row.domain, parseError);
        }
      }

      this.lastVocabularyUpdate = Date.now();

      log.info('Domain vocabularies loaded', {
        count: this.vocabularies.size,
        domains: Array.from(this.vocabularies.keys())
      });

    } catch (error: any) {
      log.error('Failed to load domain vocabularies', error);
    }
  }

  /**
   * Refresh vocabularies if cache is stale
   */
  private refreshVocabulariesIfNeeded(): void {
    if (Date.now() - this.lastVocabularyUpdate > this.CACHE_TTL) {
      this.loadVocabularies();
    }
  }

  /**
   * Tokenize query into words
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/) // Split on whitespace
      .filter(word => word.length > 1); // Filter out single characters
  }

  /**
   * Escape regex special characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add or update domain vocabulary
   */
  async addVocabulary(vocabulary: DomainVocabulary): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO domain_vocabulary (domain, keywords, authority_patterns, boost_factor)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        vocabulary.domain,
        JSON.stringify(vocabulary.keywords),
        JSON.stringify(vocabulary.authorityPatterns),
        vocabulary.boostFactor
      );

      // Update in-memory cache
      this.vocabularies.set(vocabulary.domain, vocabulary);

      log.info('Domain vocabulary updated', {
        domain: vocabulary.domain,
        keywordCount: vocabulary.keywords.length
      });

    } catch (error: any) {
      log.error('Failed to add domain vocabulary', error, {
        domainName: vocabulary.domain
      });
      throw error;
    }
  }

  /**
   * Get all available domains
   */
  getDomains(): string[] {
    this.refreshVocabulariesIfNeeded();
    return Array.from(this.vocabularies.keys());
  }

  /**
   * Get vocabulary for a specific domain
   */
  getVocabulary(domain: string): DomainVocabulary | undefined {
    this.refreshVocabulariesIfNeeded();
    return this.vocabularies.get(domain);
  }

  /**
   * Get boost factor for a domain
   */
  getBoostFactor(domain: string): number {
    const vocabulary = this.getVocabulary(domain);
    return vocabulary?.boostFactor || 1.0;
  }
}
