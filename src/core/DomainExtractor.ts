import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { decode } from '@msgpack/msgpack';
import { DomainMatch } from '../types/index.js';
import { log } from './Logger.js';
import { EmbeddingService } from './EmbeddingService.js';
import { DOMAIN_EXEMPLARS, getDomainExemplar, getBoostFactor } from '../generated/DomainExemplars.js';

/**
 * Hybrid domain extractor combining pattern matching with semantic analysis
 * Based on research into modern code search and semantic classification systems
 * 
 * Architecture:
 * - Fast Path: Pattern matching for explicit signals (imports, decorators, file paths)
 * - Semantic Path: Embedding-based matching for ambiguous or conceptual queries
 * - Cascaded approach: Fast first, then semantic only when needed
 */
export class DomainExtractor {
  private embeddingService: EmbeddingService | null = null;
  private domainEmbeddingsCache: Map<string, number[]> = new Map();
  private isInitializingEmbeddings = false;

  // Technology to domain mappings (kept from original for fast pattern matching)
  private static readonly TECHNOLOGY_DOMAINS: Record<string, string[]> = {
    'react': ['react', 'frontend', 'ui-library', 'web-frameworks', 'javascript'],
    'vue': ['vue', 'frontend', 'ui-library', 'web-frameworks', 'javascript'],
    'angular': ['angular', 'frontend', 'ui-library', 'web-frameworks', 'typescript'],
    'svelte': ['svelte', 'frontend', 'ui-library', 'web-frameworks', 'javascript'],
    'next': ['nextjs', 'react', 'frontend', 'ssr', 'web-frameworks'],
    'nuxt': ['nuxtjs', 'vue', 'frontend', 'ssr', 'web-frameworks'],
    
    'express': ['express', 'nodejs', 'backend', 'web-server', 'javascript'],
    'fastify': ['fastify', 'nodejs', 'backend', 'web-server', 'javascript'],
    'koa': ['koa', 'nodejs', 'backend', 'web-server', 'javascript'],
    'nest': ['nestjs', 'nodejs', 'backend', 'typescript', 'web-frameworks'],
    'django': ['django', 'python', 'backend', 'web-frameworks', 'mvc'],
    'flask': ['flask', 'python', 'backend', 'web-frameworks', 'microframework'],
    'fastapi': ['fastapi', 'python', 'backend', 'api', 'async'],
    'spring': ['spring', 'java', 'backend', 'enterprise', 'web-frameworks'],
    
    'mongodb': ['mongodb', 'database', 'nosql', 'document-db'],
    'postgres': ['postgresql', 'database', 'sql', 'relational'],
    'mysql': ['mysql', 'database', 'sql', 'relational'],
    'redis': ['redis', 'cache', 'database', 'key-value', 'nosql'],
    'elasticsearch': ['elasticsearch', 'search', 'database', 'nosql'],
    
    'docker': ['docker', 'containerization', 'devops', 'infrastructure'],
    'kubernetes': ['kubernetes', 'k8s', 'orchestration', 'devops', 'infrastructure'],
    'terraform': ['terraform', 'iac', 'devops', 'infrastructure'],
    'aws': ['aws', 'cloud', 'infrastructure', 'devops'],
    
    'jest': ['jest', 'testing', 'javascript', 'unit-testing'],
    'pytest': ['pytest', 'testing', 'python', 'unit-testing'],
    'cypress': ['cypress', 'testing', 'e2e', 'frontend'],
    
    'tensorflow': ['tensorflow', 'machine-learning', 'ai', 'python'],
    'pytorch': ['pytorch', 'machine-learning', 'ai', 'python'],
    'pandas': ['pandas', 'data-analysis', 'python', 'data-science'],
    
    'graphql': ['graphql', 'api', 'query-language'],
    'rest': ['rest', 'api', 'http'],
    'websocket': ['websocket', 'real-time', 'communication'],
    
    'typescript': ['typescript', 'javascript', 'typed-language'],
    'python': ['python', 'scripting', 'backend'],
    'java': ['java', 'jvm', 'enterprise'],
    'go': ['golang', 'backend', 'systems'],
    'rust': ['rust', 'systems', 'performance']
  };

  // Framework-specific patterns (kept for fast detection)
  private static readonly FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
    'react': [
      /\buseState\s*\(/,
      /\buseEffect\s*\(/,
      /\bReact\.Component\b/,
      /<[A-Z][a-zA-Z]*[\s/>]/
    ],
    'vue': [
      /\bref\s*\(/,
      /\breactive\s*\(/,
      /\bv-if\b/,
      /\bv-for\b/
    ],
    'angular': [
      /@Component\s*\(/,
      /@Injectable\s*\(/,
      /@NgModule\s*\(/,
      /\bngOnInit\b/
    ],
    'express': [
      /\bapp\.get\s*\(/,
      /\bapp\.post\s*\(/,
      /\breq\.(params|query|body)\b/,
      /\bres\.(send|json|status)\b/
    ],
    'django': [
      /\bfrom\s+django\./,
      /\bmodels\.Model\b/,
      /\b@login_required\b/
    ],
    'flask': [
      /\bfrom\s+flask\s+import\b/,
      /\b@app\.route\b/,
      /\brender_template\b/
    ],
    'spring': [
      /\b@RestController\b/,
      /\b@Service\b/,
      /\b@Autowired\b/
    ]
  };

  // Technology signatures (kept for fast detection)
  private static readonly TECH_SIGNATURES: Record<string, RegExp[]> = {
    'docker': [
      /\bFROM\s+[\w:.-]+/,
      /\bRUN\s+/,
      /\bEXPOSE\s+\d+/
    ],
    'kubernetes': [
      /\bapiVersion:\s*[\w/]+/,
      /\bkind:\s*(Deployment|Service|Pod)/,
      /\bkubectl\s+/
    ],
    'sql': [
      /\bSELECT\s+.*\bFROM\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bJOIN\b/i
    ],
    'graphql': [
      /\btype\s+Query\s*{/,
      /\btype\s+Mutation\s*{/,
      /\bresolvers\s*[=:]/
    ],
    'terraform': [
      /\bresource\s+"[\w_]+"/,
      /\bprovider\s+"[\w_]+"/,
      /\bterraform\s*{/
    ]
  };

  constructor() {
    log.info('DomainExtractor initialized with hybrid pattern+semantic analysis', {
      technologyMappings: Object.keys(DomainExtractor.TECHNOLOGY_DOMAINS).length,
      frameworkPatterns: Object.keys(DomainExtractor.FRAMEWORK_PATTERNS).length,
      domainExemplars: DOMAIN_EXEMPLARS.length
    });
  }

  /**
   * Set embedding service for semantic analysis (lazy initialization)
   */
  setEmbeddingService(embeddingService: EmbeddingService): void {
    this.embeddingService = embeddingService;
    log.debug('EmbeddingService set for semantic domain analysis');
  }

  /**
   * Initialize domain embeddings cache by loading pre-computed embeddings
   * Falls back to runtime generation if msgpack file is not available
   */
  private async initializeDomainEmbeddings(): Promise<void> {
    if (this.domainEmbeddingsCache.size > 0 || this.isInitializingEmbeddings) {
      return; // Already loaded
    }

    this.isInitializingEmbeddings = true;
    const timer = log.time('domain-embeddings-load');

    try {
      // FAST PATH: Try to load pre-computed embeddings from msgpack
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const embeddingsPath = path.join(__dirname, '../generated/domain-embeddings.msgpack');
      
      log.debug('Loading pre-computed domain embeddings', {
        path: embeddingsPath
      });
      
      const buffer = readFileSync(embeddingsPath);
      const embeddings = decode(buffer) as Record<string, number[]>;
      
      for (const [domain, embedding] of Object.entries(embeddings)) {
        this.domainEmbeddingsCache.set(domain, embedding);
      }
      
      timer();
      log.info('Loaded pre-computed domain embeddings from msgpack', {
        cachedDomains: this.domainEmbeddingsCache.size,
        source: 'msgpack',
        path: path.basename(embeddingsPath)
      });
      
    } catch (error: any) {
      log.warn('Failed to load pre-computed embeddings, falling back to runtime generation', {
        error: error.message
      });
      
      // FALLBACK: Generate at runtime if msgpack loading fails
      if (!this.embeddingService) {
        log.error('No embedding service available and msgpack loading failed');
        this.isInitializingEmbeddings = false;
        return;
      }
      
      try {
        log.info('Generating domain embeddings at runtime (fallback)', {
          domainCount: DOMAIN_EXEMPLARS.length
        });
        
        for (const exemplar of DOMAIN_EXEMPLARS) {
          try {
            const embedding = await this.embeddingService.embedQuery(exemplar.description);
            this.domainEmbeddingsCache.set(exemplar.domain, embedding);
          } catch (err: any) {
            log.warn(`Failed to generate embedding for domain: ${exemplar.domain}`, err);
          }
        }
        
        timer();
        log.info('Generated domain embeddings at runtime (fallback)', {
          cachedDomains: this.domainEmbeddingsCache.size,
          source: 'runtime-generation'
        });
      } catch (genError: any) {
        log.error('Failed to generate domain embeddings at runtime', genError);
      }
    } finally {
      this.isInitializingEmbeddings = false;
    }
  }

  /**
   * Extract domain tags from content using hybrid approach
   */
  async extractDomainTags(
    content: string,
    filePath: string,
    language: string
  ): Promise<string[]> {
    const timer = log.time(`domain-extract-${path.basename(filePath)}`);

    try {
      log.debug('Starting hybrid domain extraction', {
        filePath: path.basename(filePath),
        language,
        contentLength: content.length
      });

      // FAST PATH: Pattern-based extraction
      const pathDomains = this.extractFromPath(filePath);
      const languageDomains = this.extractFromLanguage(language);
      const contentDomains = this.extractFromContent(content);
      const contextDomains = this.extractFromContext(content, filePath);

      // Combine pattern-based scores
      const domainScores = new Map<string, number>();

      for (const domain of pathDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + 0.8);
      }

      for (const domain of languageDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + 0.6);
      }

      for (const [domain, score] of contentDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + score);
      }

      for (const [domain, score] of contextDomains) {
        domainScores.set(domain, (domainScores.get(domain) || 0) + score);
      }

      // Calculate average confidence from pattern matching
      const avgConfidence = domainScores.size > 0
        ? Array.from(domainScores.values()).reduce((sum, score) => sum + score, 0) / domainScores.size
        : 0;

      // SEMANTIC PATH: Only if pattern confidence is low or to enhance results
      if (avgConfidence < 0.7 && this.embeddingService && content.length > 100) {
        try {
          await this.initializeDomainEmbeddings();
          const semanticDomains = await this.extractFromSemantics(content);
          
          // Merge semantic scores with pattern scores
          for (const [domain, score] of semanticDomains) {
            const currentScore = domainScores.get(domain) || 0;
            // Semantic analysis adds confidence when patterns are weak
            domainScores.set(domain, currentScore + score * 0.4);
          }

          log.debug('Applied semantic domain enhancement', {
            filePath: path.basename(filePath),
            semanticDomainsFound: semanticDomains.size,
            avgPatternConfidence: avgConfidence.toFixed(3)
          });
        } catch (error: any) {
          log.debug('Semantic analysis skipped or failed', {
            filePath: path.basename(filePath),
            reason: error.message
          });
        }
      }

      // Filter and sort by confidence
      const finalDomains = Array.from(domainScores.entries())
        .filter(([, score]) => score >= 0.3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([domain]) => domain);

      timer();
      log.debug('Domain extraction completed', {
        filePath: path.basename(filePath),
        detectedDomains: finalDomains,
        totalCandidates: domainScores.size,
        usedSemantics: avgConfidence < 0.7 && this.embeddingService !== null
      });

      return finalDomains;

    } catch (error: any) {
      log.error('Domain extraction failed', error, {
        filePath: path.basename(filePath)
      });
      return [];
    }
  }

  /**
   * Classify query intent using hybrid approach
   */
  async classifyQueryIntent(query: string): Promise<DomainMatch[]> {
    const timer = log.time(`query-intent-${query.substring(0, 20)}`);

    try {
      log.debug('Classifying query intent with hybrid approach', {
        query: query.substring(0, 50),
        queryLength: query.length
      });

      // FAST PATH: Pattern-based classification
      const patternMatches = await this.classifyQueryByPatterns(query);
      
      // Calculate average confidence
      const avgConfidence = patternMatches.length > 0
        ? patternMatches.reduce((sum, m) => sum + m.confidence, 0) / patternMatches.length
        : 0;

      // SEMANTIC PATH: If pattern confidence is low, use semantic matching
      if (avgConfidence < 0.6 && this.embeddingService) {
        try {
          await this.initializeDomainEmbeddings();
          const semanticMatches = await this.classifyQueryBySemantics(query);
          
          // Merge results with confidence weighting
          const merged = this.mergeQueryMatches(patternMatches, semanticMatches);
          
          timer();
          log.debug('Query classification completed with semantic enhancement', {
            query: query.substring(0, 50),
            patternMatches: patternMatches.length,
            semanticMatches: semanticMatches.length,
            finalMatches: merged.length,
            avgPatternConfidence: avgConfidence.toFixed(3)
          });

          return merged;
        } catch (error: any) {
          log.debug('Semantic query classification failed, using patterns only', {
            query: query.substring(0, 50),
            error: error.message
          });
        }
      }

      timer();
      log.debug('Query classification completed with patterns only', {
        query: query.substring(0, 50),
        matches: patternMatches.length,
        avgConfidence: avgConfidence.toFixed(3)
      });

      return patternMatches;

    } catch (error: any) {
      log.error('Query intent classification failed', error, {
        query: query.substring(0, 50)
      });
      return [];
    }
  }

  /**
   * Pattern-based query classification (fast path)
   */
  private async classifyQueryByPatterns(query: string): Promise<DomainMatch[]> {
    const queryLower = query.toLowerCase();
    const queryWords = this.tokenizeQuery(queryLower);
    const domainMatches: DomainMatch[] = [];

    // Check for direct technology mentions
    for (const [tech, domains] of Object.entries(DomainExtractor.TECHNOLOGY_DOMAINS)) {
      const techLower = tech.toLowerCase();
      
      if (queryWords.includes(techLower) || queryLower.includes(techLower)) {
        for (const domain of domains) {
          const existing = domainMatches.find(m => m.domain === domain);
          if (existing) {
            existing.confidence = Math.min(1.0, existing.confidence + 0.3);
            if (!existing.matchedKeywords.includes(tech)) {
              existing.matchedKeywords.push(tech);
            }
          } else {
            domainMatches.push({
              domain,
              confidence: 0.7,
              matchedKeywords: [tech],
              boostFactor: getBoostFactor(domain)
            });
          }
        }
      }
    }

    // Check for framework-specific terminology
    const frameworkTerms: Record<string, string[]> = {
      'hooks': ['react'],
      'component': ['react', 'vue', 'angular'],
      'directive': ['vue', 'angular'],
      'middleware': ['express'],
      'route': ['express', 'flask', 'django'],
      'model': ['django'],
      'orm': ['django'],
      'container': ['docker'],
      'pod': ['kubernetes'],
      'deployment': ['kubernetes'],
      'query': ['graphql', 'sql', 'database'],
      'mutation': ['graphql'],
      'authentication': ['backend', 'api'],
      'state management': ['react', 'vue', 'frontend']
    };

    for (const [term, techs] of Object.entries(frameworkTerms)) {
      if (queryLower.includes(term)) {
        for (const tech of techs) {
          const domains = DomainExtractor.TECHNOLOGY_DOMAINS[tech] || [tech];
          for (const domain of domains) {
            const existing = domainMatches.find(m => m.domain === domain);
            if (existing) {
              existing.confidence = Math.min(1.0, existing.confidence + 0.2);
              if (!existing.matchedKeywords.includes(term)) {
                existing.matchedKeywords.push(term);
              }
            } else {
              domainMatches.push({
                domain,
                confidence: 0.5,
                matchedKeywords: [term],
                boostFactor: getBoostFactor(domain)
              });
            }
          }
        }
      }
    }

    return domainMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Semantic query classification using embeddings (slow path)
   */
  private async classifyQueryBySemantics(query: string): Promise<DomainMatch[]> {
    if (!this.embeddingService || this.domainEmbeddingsCache.size === 0) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embedQuery(query);
      const matches: DomainMatch[] = [];

      // Compare with all domain embeddings
      for (const [domain, domainEmbedding] of this.domainEmbeddingsCache) {
        const similarity = EmbeddingService.cosineSimilarity(queryEmbedding, domainEmbedding);
        
        // Only include if similarity is significant
        if (similarity > 0.3) {
          const exemplar = getDomainExemplar(domain);
          matches.push({
            domain,
            confidence: similarity,
            matchedKeywords: ['semantic-match'],
            boostFactor: exemplar?.boostFactor || 1.0
          });
        }
      }

      return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (error: any) {
      log.warn('Semantic query classification failed', error);
      return [];
    }
  }

  /**
   * Semantic content analysis using embeddings
   */
  private async extractFromSemantics(content: string): Promise<Map<string, number>> {
    if (!this.embeddingService || this.domainEmbeddingsCache.size === 0) {
      return new Map();
    }

    try {
      // Sample content if too long (embeddings have token limits)
      const sampleContent = content.length > 2000
        ? content.substring(0, 1000) + '\n...\n' + content.substring(content.length - 1000)
        : content;

      const contentEmbedding = await this.embeddingService.embedQuery(sampleContent);
      const semanticScores = new Map<string, number>();

      // Compare with domain embeddings
      for (const [domain, domainEmbedding] of this.domainEmbeddingsCache) {
        const similarity = EmbeddingService.cosineSimilarity(contentEmbedding, domainEmbedding);
        
        if (similarity > 0.25) {
          semanticScores.set(domain, similarity);
        }
      }

      return semanticScores;

    } catch (error: any) {
      log.debug('Semantic content analysis failed', { error: error.message });
      return new Map();
    }
  }

  /**
   * Merge pattern and semantic query matches
   */
  private mergeQueryMatches(
    patternMatches: DomainMatch[],
    semanticMatches: DomainMatch[]
  ): DomainMatch[] {
    const merged = new Map<string, DomainMatch>();

    // Add pattern matches with higher weight
    for (const match of patternMatches) {
      merged.set(match.domain, {
        ...match,
        confidence: match.confidence * 0.7 // Pattern weight
      });
    }

    // Add or enhance with semantic matches
    for (const match of semanticMatches) {
      const existing = merged.get(match.domain);
      if (existing) {
        // Boost confidence when both patterns and semantics agree
        existing.confidence = Math.min(1.0, existing.confidence + match.confidence * 0.5);
        existing.matchedKeywords.push(...match.matchedKeywords);
      } else {
        // Pure semantic match
        merged.set(match.domain, {
          ...match,
          confidence: match.confidence * 0.6 // Semantic-only weight
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  // Pattern-based extraction methods (kept from original implementation)

  private extractFromPath(filePath: string): string[] {
    const pathLower = filePath.toLowerCase();
    const domains: string[] = [];

    for (const [tech, techDomains] of Object.entries(DomainExtractor.TECHNOLOGY_DOMAINS)) {
      if (pathLower.includes(tech)) {
        domains.push(...techDomains.slice(0, 2));
      }
    }

    const pathIndicators: Record<string, string[]> = {
      'javascript': ['js/', '/js/', 'node/', 'npm/'],
      'frontend': ['frontend/', 'client/', 'ui/', 'components/'],
      'backend': ['backend/', 'server/', 'api/'],
      'testing': ['test/', 'tests/', '__tests__/', 'spec/'],
      'devops': ['docker', 'k8s/', 'deploy/', 'infra/']
    };

    for (const [domain, indicators] of Object.entries(pathIndicators)) {
      if (indicators.some(indicator => pathLower.includes(indicator))) {
        domains.push(domain);
      }
    }

    return [...new Set(domains)];
  }

  private extractFromLanguage(language: string): string[] {
    const languageMap: Record<string, string[]> = {
      'javascript': ['javascript', 'web-frameworks'],
      'typescript': ['typescript', 'javascript', 'web-frameworks'],
      'python': ['python', 'backend'],
      'java': ['java', 'enterprise'],
      'go': ['golang', 'backend'],
      'rust': ['rust', 'systems'],
      'shell': ['devops', 'automation'],
      'yaml': ['devops', 'configuration'],
      'html': ['frontend', 'web'],
      'css': ['frontend', 'web']
    };

    return languageMap[language.toLowerCase()] || [];
  }

  private extractFromContent(content: string): Map<string, number> {
    const domainScores = new Map<string, number>();

    // Extract from imports
    const importDomains = this.extractFromImports(content);
    for (const [domain, score] of importDomains) {
      domainScores.set(domain, (domainScores.get(domain) || 0) + score);
    }

    // Detect framework patterns
    const frameworkDomains = this.detectFrameworkPatterns(content);
    for (const [domain, score] of frameworkDomains) {
      domainScores.set(domain, (domainScores.get(domain) || 0) + score);
    }

    // Detect technology signatures
    const techDomains = this.detectTechnologySignatures(content);
    for (const [domain, score] of techDomains) {
      domainScores.set(domain, (domainScores.get(domain) || 0) + score);
    }

    return domainScores;
  }

  private extractFromImports(content: string): Map<string, number> {
    const domainScores = new Map<string, number>();

    const jsImportPatterns = [
      /import\s+.*?['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /from\s+['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of jsImportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1].toLowerCase();
        const packageName = importPath.split('/')[0].replace('@', '');
        
        if (DomainExtractor.TECHNOLOGY_DOMAINS[packageName]) {
          const domains = DomainExtractor.TECHNOLOGY_DOMAINS[packageName];
          for (const domain of domains) {
            domainScores.set(domain, (domainScores.get(domain) || 0) + 0.4);
          }
        }
      }
    }

    return domainScores;
  }

  private detectFrameworkPatterns(content: string): Map<string, number> {
    const domainScores = new Map<string, number>();

    for (const [framework, patterns] of Object.entries(DomainExtractor.FRAMEWORK_PATTERNS)) {
      let matchCount = 0;
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(matchCount * 0.15, 0.6);
        
        if (DomainExtractor.TECHNOLOGY_DOMAINS[framework]) {
          const domains = DomainExtractor.TECHNOLOGY_DOMAINS[framework];
          for (const domain of domains) {
            domainScores.set(domain, (domainScores.get(domain) || 0) + confidence);
          }
        }
      }
    }

    return domainScores;
  }

  private detectTechnologySignatures(content: string): Map<string, number> {
    const domainScores = new Map<string, number>();

    for (const [tech, patterns] of Object.entries(DomainExtractor.TECH_SIGNATURES)) {
      let matchCount = 0;
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(matchCount * 0.2, 0.7);
        
        if (DomainExtractor.TECHNOLOGY_DOMAINS[tech]) {
          const domains = DomainExtractor.TECHNOLOGY_DOMAINS[tech];
          for (const domain of domains) {
            domainScores.set(domain, (domainScores.get(domain) || 0) + confidence);
          }
        }
      }
    }

    return domainScores;
  }

  private extractFromContext(content: string, filePath: string): Map<string, number> {
    const contextScores = new Map<string, number>();

    if (filePath.includes('package.json') || content.includes('"dependencies"')) {
      contextScores.set('javascript', 0.5);
      contextScores.set('nodejs', 0.4);
    }

    if (filePath.includes('requirements.txt') || filePath.includes('Pipfile')) {
      contextScores.set('python', 0.5);
    }

    if (filePath.toLowerCase().includes('dockerfile') || content.includes('FROM ')) {
      contextScores.set('docker', 0.6);
      contextScores.set('containerization', 0.5);
      contextScores.set('devops', 0.4);
    }

    if (content.includes('apiVersion:') && content.includes('kind:')) {
      contextScores.set('kubernetes', 0.7);
      contextScores.set('k8s', 0.7);
      contextScores.set('orchestration', 0.5);
    }

    return contextScores;
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  getBoostFactor(domain: string): number {
    return getBoostFactor(domain);
  }

  getDomains(): string[] {
    const allDomains = new Set<string>();
    
    for (const domains of Object.values(DomainExtractor.TECHNOLOGY_DOMAINS)) {
      for (const domain of domains) {
        allDomains.add(domain);
      }
    }
    
    // Add domains from exemplars
    for (const exemplar of DOMAIN_EXEMPLARS) {
      allDomains.add(exemplar.domain);
    }
    
    return Array.from(allDomains).sort();
  }
}
