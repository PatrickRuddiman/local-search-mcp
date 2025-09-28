import path from 'path';
import { ContentClassification, QualityAssessment, AuthorityAssessment } from '../types/index.js';
import { log } from './Logger.js';

/**
 * Content classifier for detecting content type, language, and quality
 */
export class ContentClassifier {
  private static readonly CODE_EXTENSIONS = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd'
  ]);

  private static readonly DOCS_EXTENSIONS = new Set([
    '.md', '.txt', '.rst', '.adoc', '.tex', '.org'
  ]);

  private static readonly CONFIG_EXTENSIONS = new Set([
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.xml',
    '.plist', '.properties', '.env', '.dockerfile'
  ]);

  // JavaScript patterns
  /** Matches common JavaScript keywords and syntax (function, const, let, var, arrow functions, async/await) */
  private static readonly JS_KEYWORDS = /\b(?:function|const|let|var|=>|async|await)\b/;
  /** Matches ES6 import statements */
  private static readonly JS_IMPORT = /\bimport\s+.*\bfrom\b/;
  /** Matches CommonJS require statements */
  private static readonly JS_REQUIRE = /\brequire\s*\(/;

  // TypeScript patterns
  /** Matches TypeScript interface declarations */
  private static readonly TS_INTERFACE = /\binterface\b/;
  /** Matches TypeScript type alias declarations */
  private static readonly TS_TYPE_ALIAS = /\btype\s+\w+\s*=/;
  /** Matches TypeScript type annotations (e.g., : string[], : number | string) */
  private static readonly TS_TYPE_ANNOTATION = /:\s*\w+(?:\[\])?(?:\s*\|\s*\w+(?:\[\])?)*\s*[;,=]/;

  // Python patterns
  /** Matches Python function definitions */
  private static readonly PY_DEF = /\bdef\s+\w+\s*\(/;
  /** Matches Python import statements */
  private static readonly PY_IMPORT = /\bimport\s+\w+/;
  /** Matches Python from-import statements */
  private static readonly PY_FROM_IMPORT = /\bfrom\s+\w+\s+import\b/;
  /** Matches Python class definitions */
  private static readonly PY_CLASS = /\bclass\s+\w+:/;

  // Java patterns
  /** Matches Java public class declarations */
  private static readonly JAVA_PUBLIC_CLASS = /\bpublic\s+class\b/;
  /** Matches Java private member declarations */
  private static readonly JAVA_PRIVATE_MEMBER = /\bprivate\s+\w+/;
  /** Matches Java import statements */
  private static readonly JAVA_IMPORT = /\bimport\s+[\w.]+;/;
  /** Matches Java main method signature */
  private static readonly JAVA_MAIN = /\bpublic\s+static\s+void\s+main\b/;

  // C++ patterns
  /** Matches C++ include directives */
  private static readonly CPP_INCLUDE = /\b#include\s*</;
  /** Matches C++ std namespace usage */
  private static readonly CPP_STD = /\bstd::\w+/;
  /** Matches C++ namespace declarations */
  private static readonly CPP_NAMESPACE = /\bnamespace\s+\w+/;
  /** Matches C++ class definitions */
  private static readonly CPP_CLASS = /\bclass\s+\w+\s*{/;

  // C# patterns
  /** Matches C# using directives */
  private static readonly CSHARP_USING = /\busing\s+\w+;/;
  /** Matches C# namespace declarations */
  private static readonly CSHARP_NAMESPACE = /\bnamespace\s+\w+/;
  /** Matches C# public class declarations */
  private static readonly CSHARP_CLASS = /\bpublic\s+class\s+\w+/;

  // Go patterns
  /** Matches Go package declarations */
  private static readonly GO_PACKAGE = /\bpackage\s+\w+/;
  /** Matches Go function definitions */
  private static readonly GO_FUNC = /\bfunc\s+\w+\s*\(/;
  /** Matches Go import block */
  private static readonly GO_IMPORT_BLOCK = /\bimport\s+\(/;

  // Rust patterns
  /** Matches Rust function definitions */
  private static readonly RUST_FN = /\bfn\s+\w+\s*\(/;
  /** Matches Rust use statements */
  private static readonly RUST_USE = /\buse\s+\w+::/;
  /** Matches Rust struct definitions */
  private static readonly RUST_STRUCT = /\bstruct\s+\w+/;
  /** Matches Rust impl blocks */
  private static readonly RUST_IMPL = /\bimpl\s+\w+/;

  // PHP patterns
  /** Matches PHP opening tag */
  private static readonly PHP_TAG = /\b<\?php\b/;
  /** Matches PHP function definitions */
  private static readonly PHP_FUNCTION = /\bfunction\s+\w+\s*\(/;
  /** Matches PHP class definitions */
  private static readonly PHP_CLASS = /\bclass\s+\w+/;

  // Ruby patterns
  /** Matches Ruby method definitions */
  private static readonly RUBY_DEF = /\bdef\s+\w+/;
  /** Matches Ruby class definitions */
  private static readonly RUBY_CLASS = /\bclass\s+\w+/;
  /** Matches Ruby require statements */
  private static readonly RUBY_REQUIRE = /\brequire\s+['"]/;
  /** Matches Ruby end keyword */
  private static readonly RUBY_END = /\bend\b/;

  // Shell patterns
  /** Matches shebang lines */
  private static readonly SHELL_SHEBANG = /\b#!/;
  /** Matches shell if statements */
  private static readonly SHELL_IF = /\bif\s+\[/;
  /** Matches shell echo statements */
  private static readonly SHELL_ECHO = /\becho\s+/;
  /** Matches shell export statements */
  private static readonly SHELL_EXPORT = /\bexport\s+\w+=/;

  // SQL patterns
  /** Matches SQL SELECT statements */
  private static readonly SQL_SELECT = /\bSELECT\s+/;
  /** Matches SQL FROM clauses */
  private static readonly SQL_FROM = /\bFROM\s+\w+/;
  /** Matches SQL WHERE clauses */
  private static readonly SQL_WHERE = /\bWHERE\s+/;
  /** Matches SQL INSERT INTO statements (case-insensitive) */
  private static readonly SQL_INSERT_INTO = /\bINSERT\s+INTO\b/i;

  // HTML patterns
  /** Matches HTML <html> tag */
  private static readonly HTML_TAG = /<html\b/;
  /** Matches HTML <div> tag */
  private static readonly HTML_DIV = /<div\b/;
  /** Matches HTML <script> tag */
  private static readonly HTML_SCRIPT = /<script\b/;
  /** Matches HTML <style> tag */
  private static readonly HTML_STYLE = /<style\b/;

  // CSS patterns
  /** Matches CSS rule blocks */
  private static readonly CSS_BLOCK = /\{[^}]*\}/;
  /** Matches CSS class selectors */
  private static readonly CSS_CLASS_SELECTOR = /\.[a-zA-Z-]+\s*{/;
  /** Matches CSS @media queries */
  private static readonly CSS_MEDIA = /@media\s*\(/;

  // YAML patterns
  /** Matches YAML key-value pairs */
  private static readonly YAML_KEY_VALUE = /^\s*\w+:\s*/;
  /** Matches YAML list items */
  private static readonly YAML_LIST_ITEM = /^\s*-\s+/;
  /** Matches YAML document start */
  private static readonly YAML_DOC_START = /^\s*---\s*$/m;

  // JSON patterns
  /** Matches JSON object start */
  private static readonly JSON_OBJECT_START = /^\s*{/;
  /** Matches JSON array start */
  private static readonly JSON_ARRAY_START = /^\s*\[/;
  /** Matches JSON key-value pairs */
  private static readonly JSON_KEY_VALUE = /"[\w-]+"\s*:\s*/;

  private static readonly LANGUAGE_PATTERNS = {
    javascript: [
      ContentClassifier.JS_KEYWORDS,
      ContentClassifier.JS_IMPORT,
      ContentClassifier.JS_REQUIRE
    ],
    typescript: [
      ContentClassifier.TS_INTERFACE,
      ContentClassifier.TS_TYPE_ALIAS,
      ContentClassifier.TS_TYPE_ANNOTATION
    ],
    python: [
      ContentClassifier.PY_DEF,
      ContentClassifier.PY_IMPORT,
      ContentClassifier.PY_FROM_IMPORT,
      ContentClassifier.PY_CLASS
    ],
    java: [
      ContentClassifier.JAVA_PUBLIC_CLASS,
      ContentClassifier.JAVA_PRIVATE_MEMBER,
      ContentClassifier.JAVA_IMPORT,
      ContentClassifier.JAVA_MAIN
    ],
    cpp: [
      ContentClassifier.CPP_INCLUDE,
      ContentClassifier.CPP_STD,
      ContentClassifier.CPP_NAMESPACE,
      ContentClassifier.CPP_CLASS
    ],
    csharp: [
      ContentClassifier.CSHARP_USING,
      ContentClassifier.CSHARP_NAMESPACE,
      ContentClassifier.CSHARP_CLASS
    ],
    go: [
      ContentClassifier.GO_PACKAGE,
      ContentClassifier.GO_FUNC,
      ContentClassifier.GO_IMPORT_BLOCK
    ],
    rust: [
      ContentClassifier.RUST_FN,
      ContentClassifier.RUST_USE,
      ContentClassifier.RUST_STRUCT,
      ContentClassifier.RUST_IMPL
    ],
    php: [
      ContentClassifier.PHP_TAG,
      ContentClassifier.PHP_FUNCTION,
      ContentClassifier.PHP_CLASS
    ],
    ruby: [
      ContentClassifier.RUBY_DEF,
      ContentClassifier.RUBY_CLASS,
      ContentClassifier.RUBY_REQUIRE,
      ContentClassifier.RUBY_END
    ],
    shell: [
      ContentClassifier.SHELL_SHEBANG,
      ContentClassifier.SHELL_IF,
      ContentClassifier.SHELL_ECHO,
      ContentClassifier.SHELL_EXPORT
    ],
    sql: [
      ContentClassifier.SQL_SELECT,
      ContentClassifier.SQL_FROM,
      ContentClassifier.SQL_WHERE,
      ContentClassifier.SQL_INSERT_INTO
    ],
    html: [
      ContentClassifier.HTML_TAG,
      ContentClassifier.HTML_DIV,
      ContentClassifier.HTML_SCRIPT,
      ContentClassifier.HTML_STYLE
    ],
    css: [
      ContentClassifier.CSS_BLOCK,
      ContentClassifier.CSS_CLASS_SELECTOR,
      ContentClassifier.CSS_MEDIA
    ],
    yaml: [
      ContentClassifier.YAML_KEY_VALUE,
      ContentClassifier.YAML_LIST_ITEM,
      ContentClassifier.YAML_DOC_START
    ],
    json: [
      ContentClassifier.JSON_OBJECT_START,
      ContentClassifier.JSON_ARRAY_START,
      ContentClassifier.JSON_KEY_VALUE
    ]
  };

  private static readonly AUTHORITY_PATTERNS = [
    'docs.', 'documentation', 'official', 'reference', 'guide', 'tutorial',
    'readme', 'manual', 'specification', 'spec', 'api'
  ];

  private static readonly GENERATED_PATTERNS = [
    'generated', 'auto-generated', 'automatically generated',
    'do not edit', 'autogenerated', 'build output'
  ];

  /**
   * Classify content type, language, and quality
   */
  async classifyContent(
    content: string, 
    filePath: string, 
    fileExtension: string
  ): Promise<{
    classification: ContentClassification;
    quality: QualityAssessment;
    authority: AuthorityAssessment;
  }> {
    const timer = log.time(`content-classify-${path.basename(filePath)}`);

    try {
      log.debug('Starting content classification', {
        filePath: path.basename(filePath),
        extension: fileExtension,
        contentLength: content.length
      });

      // Detect content type
      const classification = this.detectContentType(content, fileExtension, filePath);
      
      // Assess content quality
      const quality = this.assessContentQuality(content, classification);
      
      // Assess source authority
      const authority = this.assessSourceAuthority(content, filePath);

      timer();
      log.debug('Content classification completed', {
        filePath: path.basename(filePath),
        contentType: classification.contentType,
        language: classification.language,
        qualityScore: quality.score.toFixed(3),
        authorityScore: authority.score.toFixed(3)
      });

      return { classification, quality, authority };

    } catch (error: any) {
      log.error('Content classification failed', error, {
        filePath: path.basename(filePath),
        contentLength: content.length
      });
      
      // Return fallback classification
      return {
        classification: {
          contentType: 'mixed',
          language: 'unknown',
          confidence: 0.1,
          indicators: ['classification-failed']
        },
        quality: {
          score: 0.5,
          factors: {
            semanticDensity: 0.5,
            syntaxNoise: 0.5,
            documentationPresence: 0.0,
            structuralClarity: 0.5
          }
        },
        authority: {
          score: 0.3,
          indicators: {
            isOfficialDocs: false,
            isExample: false,
            isGenerated: false,
            hasAuthorityMarkers: []
          }
        }
      };
    }
  }

  /**
   * Detect content type (code/docs/config/mixed)
   */
  private detectContentType(content: string, extension: string, filePath: string): ContentClassification {
    const indicators: string[] = [];
    let contentType: 'code' | 'docs' | 'config' | 'mixed' = 'mixed';
    let language = 'unknown';
    let confidence = 0.5;

    // Primary classification by file extension
    if (ContentClassifier.CODE_EXTENSIONS.has(extension)) {
      contentType = 'code';
      language = this.detectProgrammingLanguage(content, extension);
      confidence = 0.8;
      indicators.push(`code-extension-${extension}`);
    } else if (ContentClassifier.DOCS_EXTENSIONS.has(extension)) {
      contentType = 'docs';
      language = 'natural';
      confidence = 0.8;
      indicators.push(`docs-extension-${extension}`);
    } else if (ContentClassifier.CONFIG_EXTENSIONS.has(extension)) {
      contentType = 'config';
      language = this.detectConfigLanguage(extension);
      confidence = 0.8;
      indicators.push(`config-extension-${extension}`);
    }

    // Content-based refinement
    const codeScore = this.calculateCodeScore(content);
    const docsScore = this.calculateDocsScore(content);
    const configScore = this.calculateConfigScore(content);

    // If content scores disagree significantly with extension, adjust
    const maxScore = Math.max(codeScore, docsScore, configScore);
    if (maxScore > 0.7) {
      if (codeScore === maxScore && contentType !== 'code') {
        contentType = 'mixed';
        indicators.push('content-suggests-code');
        confidence = Math.min(confidence, 0.6);
      } else if (docsScore === maxScore && contentType !== 'docs') {
        contentType = 'mixed';
        indicators.push('content-suggests-docs');
        confidence = Math.min(confidence, 0.6);
      } else if (configScore === maxScore && contentType !== 'config') {
        contentType = 'mixed';
        indicators.push('content-suggests-config');
        confidence = Math.min(confidence, 0.6);
      }
    }

    // Special handling for mixed content
    if (contentType === 'code' && docsScore > 0.3) {
      indicators.push('has-documentation');
    }

    return {
      contentType,
      language,
      confidence,
      indicators
    };
  }

  /**
   * Detect programming language from content and extension
   */
  private detectProgrammingLanguage(content: string, extension: string): string {
    // Extension-based detection first
    const extensionMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell'
    };

    let language = extensionMap[extension] || 'unknown';

    // Content-based validation
    for (const [lang, patterns] of Object.entries(ContentClassifier.LANGUAGE_PATTERNS)) {
      const matches = patterns.filter(pattern => pattern.test(content)).length;
      if (matches >= 2) {
        // If content strongly suggests a different language, use that
        if (language === 'unknown' || matches > 2) {
          language = lang;
        }
        break;
      }
    }

    return language;
  }

  /**
   * Detect configuration language
   */
  private detectConfigLanguage(extension: string): string {
    const configMap: { [key: string]: string } = {
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini'
    };

    return configMap[extension] || 'config';
  }

  /**
   * Calculate code content score
   */
  private calculateCodeScore(content: string): number {
    let score = 0;
    
    // Look for code patterns
    const codePatterns = [
      /\bfunction\s+\w+\s*\(/g,
      /\bclass\s+\w+/g,
      /\bimport\s+/g,
      /\bif\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /[{}();]/g,
      /\b(?:const|let|var|def|public|private|protected)\b/g
    ];

    for (const pattern of codePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += Math.min(matches.length * 0.1, 0.3);
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate documentation content score
   */
  private calculateDocsScore(content: string): number {
    let score = 0;
    
    // Look for documentation patterns
    const docsPatterns = [
      /^#+\s+/gm, // Markdown headers
      /\*\*.*?\*\*/g, // Bold text
      /\[.*?\]\(.*?\)/g, // Links
      /^\s*[-*+]\s+/gm, // Lists
      /^\s*\d+\.\s+/gm, // Numbered lists
      /```[\s\S]*?```/g, // Code blocks
      /`[^`]+`/g // Inline code
    ];

    for (const pattern of docsPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += Math.min(matches.length * 0.05, 0.2);
      }
    }

    // Check for natural language indicators
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 3) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate configuration content score
   */
  private calculateConfigScore(content: string): number {
    let score = 0;
    
    // Look for config patterns
    const configPatterns = [
      /^\s*[\w-]+\s*[:=]/gm, // Key-value pairs
      /^\s*\[.*\]\s*$/gm, // Section headers
      /^\s*{[\s\S]*}$/gm, // JSON objects
      /^\s*-\s+/gm, // YAML lists
      /<[\w-]+[^>]*>/g // XML tags
    ];

    for (const pattern of configPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += Math.min(matches.length * 0.1, 0.4);
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Assess content quality
   */
  private assessContentQuality(content: string, classification: ContentClassification): QualityAssessment {
    const semanticDensity = this.calculateSemanticDensity(content, classification);
    const syntaxNoise = this.calculateSyntaxNoise(content, classification);
    const documentationPresence = this.calculateDocumentationPresence(content);
    const structuralClarity = this.calculateStructuralClarity(content, classification);

    // Overall score weighted by content type
    let score: number;
    if (classification.contentType === 'docs') {
      score = semanticDensity * 0.4 + (1 - syntaxNoise) * 0.2 + documentationPresence * 0.2 + structuralClarity * 0.2;
    } else if (classification.contentType === 'code') {
      score = semanticDensity * 0.3 + (1 - syntaxNoise) * 0.3 + documentationPresence * 0.2 + structuralClarity * 0.2;
    } else {
      score = semanticDensity * 0.4 + (1 - syntaxNoise) * 0.4 + structuralClarity * 0.2;
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors: {
        semanticDensity,
        syntaxNoise,
        documentationPresence,
        structuralClarity
      }
    };
  }

  /**
   * Calculate semantic density (meaningful content ratio)
   */
  private calculateSemanticDensity(content: string, classification: ContentClassification): number {
    const totalChars = content.length;
    if (totalChars === 0) return 0;

    // Count noise characters based on content type
    let noiseChars = 0;

    if (classification.contentType === 'code') {
      // For code, excessive brackets, semicolons, and whitespace are noise
      noiseChars += (content.match(/[{}();,]/g) || []).length;
      noiseChars += (content.match(/\s{3,}/g) || []).join('').length;
    } else if (classification.contentType === 'config') {
      // For config, structural syntax is expected, focus on repetitive patterns
      const lines = content.split('\n');
      const duplicateLines = lines.length - new Set(lines.map(l => l.trim())).size;
      noiseChars += duplicateLines * 10; // Penalize duplicate lines
    } else {
      // For docs, excessive formatting is noise
      noiseChars += (content.match(/[*_`#]/g) || []).length;
    }

    return Math.max(0, 1 - (noiseChars / totalChars));
  }

  /**
   * Calculate syntax noise ratio
   */
  private calculateSyntaxNoise(content: string, classification: ContentClassification): number {
    const lines = content.split('\n');
    let noiseLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed.length === 0) continue;

      // Different noise patterns by content type
      if (classification.contentType === 'code') {
        // High ratio of syntax characters to alphanumeric
        const syntaxChars = (trimmed.match(/[{}();,\[\]]/g) || []).length;
        const alphanumeric = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
        if (syntaxChars > alphanumeric * 0.5) {
          noiseLines++;
        }
      } else if (classification.contentType === 'docs') {
        // Lines with excessive formatting or very short content
        const formatChars = (trimmed.match(/[*_`#\-=]/g) || []).length;
        if (formatChars > trimmed.length * 0.3 || (trimmed.length < 10 && formatChars > 2)) {
          noiseLines++;
        }
      }
    }

    return noiseLines / Math.max(lines.length, 1);
  }

  /**
   * Calculate documentation presence score
   */
  private calculateDocumentationPresence(content: string): number {
    let score = 0;

    // Look for comment patterns
    const commentPatterns = [
      /\/\*[\s\S]*?\*\//g, // Multi-line comments
      /\/\/.*$/gm, // Single-line comments
      /#.*$/gm, // Hash comments
      /<!--[\s\S]*?-->/g, // HTML comments
      /"""[\s\S]*?"""/g, // Python docstrings
      /'''[\s\S]*?'''/g // Python docstrings
    ];

    for (const pattern of commentPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += Math.min(matches.length * 0.1, 0.3);
      }
    }

    // Look for documentation keywords
    const docKeywords = ['@param', '@return', '@throws', 'TODO:', 'FIXME:', 'NOTE:', 'WARNING:'];
    for (const keyword of docKeywords) {
      if (content.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate structural clarity score
   */
  private calculateStructuralClarity(content: string, classification: ContentClassification): number {
    let score = 0.5; // Base score

    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);

    if (nonEmptyLines.length === 0) return 0;

    // Check indentation consistency
    const indentedLines = nonEmptyLines.filter(l => l.match(/^\s+/));
    const consistentIndent = indentedLines.length > 0 ? 
      this.checkIndentationConsistency(indentedLines) : true;

    if (consistentIndent) {
      score += 0.2;
    }

    // Check for logical structure based on content type
    if (classification.contentType === 'code') {
      // Look for function/class definitions
      const structurePatterns = [
        /\bfunction\s+\w+/g,
        /\bclass\s+\w+/g,
        /\bdef\s+\w+/g,
        /^\s*\/\*\*[\s\S]*?\*\//gm // JSDoc comments
      ];
      
      for (const pattern of structurePatterns) {
        if (pattern.test(content)) {
          score += 0.1;
        }
      }
    } else if (classification.contentType === 'docs') {
      // Look for headers and structure
      if (content.match(/^#+\s+/gm)) score += 0.2; // Markdown headers
      if (content.match(/^\s*[-*+]\s+/gm)) score += 0.1; // Lists
    }

    return Math.min(score, 1.0);
  }

  /**
   * Check indentation consistency
   */
  private checkIndentationConsistency(lines: string[]): boolean {
    const indentSizes = lines.map(line => {
      const match = line.match(/^(\s+)/);
      return match ? match[1].length : 0;
    }).filter(size => size > 0);

    if (indentSizes.length < 2) return true;

    // Check if indentation follows a consistent pattern
    const gcd = indentSizes.reduce((a, b) => this.gcd(a, b));
    return gcd > 0 && gcd <= 8; // Reasonable indentation size
  }

  /**
   * Calculate greatest common divisor
   */
  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  /**
   * Assess source authority
   */
  private assessSourceAuthority(content: string, filePath: string): AuthorityAssessment {
    const pathLower = filePath.toLowerCase();
    const contentLower = content.toLowerCase();
    
    let score = 0.3; // Base authority score
    const authorityMarkers: string[] = [];

    // Check for authority indicators in path
    for (const pattern of ContentClassifier.AUTHORITY_PATTERNS) {
      if (pathLower.includes(pattern)) {
        score += 0.15;
        authorityMarkers.push(`path-${pattern}`);
      }
    }

    // Check for official documentation markers in content
    const officialMarkers = ['copyright', 'license', 'official', 'documentation', 'specification'];
    for (const marker of officialMarkers) {
      if (contentLower.includes(marker)) {
        score += 0.05;
        authorityMarkers.push(`content-${marker}`);
      }
    }

    // Check if it's an example
    const isExample = pathLower.includes('example') || pathLower.includes('sample') ||
                     contentLower.includes('example') || contentLower.includes('demo');

    // Check if it's generated content
    const isGenerated = ContentClassifier.GENERATED_PATTERNS.some(pattern => 
      contentLower.includes(pattern.toLowerCase())
    );

    // Adjust score based on indicators
    if (isExample) score += 0.1;
    if (isGenerated) score -= 0.2;

    // Check for URL patterns that indicate authority
    const urlPatterns = [
      /https?:\/\/[a-zA-Z0-9.-]+\.(?:org|edu|gov)/g,
      /https?:\/\/docs\./g,
      /https?:\/\/[a-zA-Z0-9.-]+\/docs?\//g
    ];

    for (const pattern of urlPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += Math.min(matches.length * 0.05, 0.15);
        authorityMarkers.push(`url-${pattern.source}`);
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      indicators: {
        isOfficialDocs: score > 0.7,
        isExample,
        isGenerated,
        hasAuthorityMarkers: authorityMarkers
      }
    };
  }
}
