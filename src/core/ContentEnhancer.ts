import path from 'path';
import { ContentClassification, ContentMetadata } from '../types/index.js';
import { log } from './Logger.js';

/**
 * Content enhancer for normalizing and improving text based on content type
 */
export class ContentEnhancer {
  
  /**
   * Enhance content based on classification
   */
  async enhanceContent(
    originalContent: string,
    classification: ContentClassification,
    filePath: string
  ): Promise<{
    processedContent: string;
    rawContent: string;
    hasComments: boolean;
    hasDocumentation: boolean;
  }> {
    const timer = log.time(`content-enhance-${path.basename(filePath)}`);

    try {
      log.debug('Starting content enhancement', {
        filePath: path.basename(filePath),
        contentType: classification.contentType,
        language: classification.language,
        originalLength: originalContent.length
      });

      let processedContent = originalContent;
      let hasComments = false;
      let hasDocumentation = false;

      // Apply content-type specific enhancements
      switch (classification.contentType) {
        case 'code':
          const codeResult = this.enhanceCodeContent(originalContent, classification.language);
          processedContent = codeResult.content;
          hasComments = codeResult.hasComments;
          hasDocumentation = codeResult.hasDocumentation;
          break;

        case 'docs':
          const docsResult = this.enhanceDocumentationContent(originalContent);
          processedContent = docsResult.content;
          hasDocumentation = true;
          break;

        case 'config':
          processedContent = this.enhanceConfigContent(originalContent, classification.language);
          break;

        case 'mixed':
          const mixedResult = this.enhanceMixedContent(originalContent, classification.language);
          processedContent = mixedResult.content;
          hasComments = mixedResult.hasComments;
          hasDocumentation = mixedResult.hasDocumentation;
          break;
      }

      // Apply universal text normalizations
      processedContent = this.applyUniversalNormalization(processedContent);

      // Add context headers
      processedContent = this.addContextHeaders(processedContent, filePath, classification);

      timer();
      log.debug('Content enhancement completed', {
        filePath: path.basename(filePath),
        originalLength: originalContent.length,
        processedLength: processedContent.length,
        hasComments,
        hasDocumentation,
        compressionRatio: (processedContent.length / originalContent.length).toFixed(3)
      });

      return {
        processedContent,
        rawContent: originalContent,
        hasComments,
        hasDocumentation
      };

    } catch (error: any) {
      log.error('Content enhancement failed', error, {
        filePath: path.basename(filePath),
        contentType: classification.contentType
      });
      
      // Return original content on failure
      return {
        processedContent: originalContent,
        rawContent: originalContent,
        hasComments: false,
        hasDocumentation: false
      };
    }
  }

  /**
   * Enhance code content
   */
  private enhanceCodeContent(content: string, language: string): {
    content: string;
    hasComments: boolean;
    hasDocumentation: boolean;
  } {
    let enhanced = content;
    let hasComments = false;
    let hasDocumentation = false;

    // Extract and preserve meaningful comments
    const comments = this.extractComments(content, language);
    hasComments = comments.length > 0;
    
    // Check for documentation patterns
    hasDocumentation = this.hasDocumentationPatterns(content);

    // Remove excessive whitespace but preserve structure
    enhanced = this.normalizeWhitespace(enhanced);

    // Remove redundant syntax noise for search while preserving meaning
    enhanced = this.reduceSyntaxNoise(enhanced, language);

    // Extract and highlight important identifiers
    enhanced = this.highlightImportantIdentifiers(enhanced, language);

    // Add extracted comments as searchable text
    if (comments.length > 0) {
      const commentText = comments
        .map(c => c.text.trim())
        .filter(c => c.length > 10) // Only meaningful comments
        .join(' ');
      
      if (commentText.length > 0) {
        enhanced = `${enhanced}\n\n/* Extracted Comments: ${commentText} */`;
      }
    }

    return { content: enhanced, hasComments, hasDocumentation };
  }

  /**
   * Enhance documentation content
   */
  private enhanceDocumentationContent(content: string): { content: string } {
    let enhanced = content;

    // Normalize markdown formatting
    enhanced = this.normalizeMarkdown(enhanced);

    // Extract and emphasize key concepts
    enhanced = this.emphasizeKeyDocConcepts(enhanced);

    // Improve readability
    enhanced = this.improveDocReadability(enhanced);

    return { content: enhanced };
  }

  /**
   * Enhance configuration content
   */
  private enhanceConfigContent(content: string, language: string): string {
    let enhanced = content;

    // Normalize based on config type
    switch (language) {
      case 'json':
        enhanced = this.normalizeJson(enhanced);
        break;
      case 'yaml':
        enhanced = this.normalizeYaml(enhanced);
        break;
      case 'xml':
        enhanced = this.normalizeXml(enhanced);
        break;
      default:
        enhanced = this.normalizeGenericConfig(enhanced);
    }

    // Extract configuration keys and values for better searchability
    enhanced = this.extractConfigKeywords(enhanced, language);

    return enhanced;
  }

  /**
   * Enhance mixed content
   */
  private enhanceMixedContent(content: string, language: string): {
    content: string;
    hasComments: boolean;
    hasDocumentation: boolean;
  } {
    let enhanced = content;
    let hasComments = false;
    let hasDocumentation = false;

    // Try to separate code and documentation sections
    const sections = this.separateContentSections(content);
    
    for (const section of sections) {
      if (section.type === 'code') {
        const codeResult = this.enhanceCodeContent(section.content, language);
        hasComments = hasComments || codeResult.hasComments;
        hasDocumentation = hasDocumentation || codeResult.hasDocumentation;
      } else if (section.type === 'docs') {
        hasDocumentation = true;
      }
    }

    // Apply general improvements
    enhanced = this.normalizeWhitespace(enhanced);
    enhanced = this.improveReadability(enhanced);

    return { content: enhanced, hasComments, hasDocumentation };
  }

  /**
   * Apply universal text normalizations
   */
  private applyUniversalNormalization(content: string): string {
    let normalized = content;

    // Remove excessive escaping
    normalized = normalized.replace(/\\\\+/g, '\\');

    // Normalize line endings
    normalized = normalized.replace(/\r\n/g, '\n');

    // Remove trailing whitespace
    normalized = normalized.replace(/[ \t]+$/gm, '');

    // Normalize multiple blank lines
    normalized = normalized.replace(/\n{4,}/g, '\n\n\n');

    // Fix common encoding issues
    normalized = this.fixEncodingIssues(normalized);

    return normalized;
  }

  /**
   * Add context headers for better searchability
   */
  private addContextHeaders(content: string, filePath: string, classification: ContentClassification): string {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath);
    const directory = path.dirname(filePath);

    const headers: string[] = [];

    // Add file context
    headers.push(`File: ${fileName}`);
    
    // Add directory context if meaningful
    const dirParts = directory.split(/[/\\]/).filter(p => p.length > 0);
    if (dirParts.length > 0) {
      const relevantDirs = dirParts.slice(-2); // Last 2 directory levels
      headers.push(`Location: ${relevantDirs.join('/')}`);
    }

    // Add content type context
    headers.push(`Type: ${classification.contentType} (${classification.language})`);

    // Add extension context
    if (fileExt) {
      headers.push(`Format: ${fileExt.substring(1)}`);
    }

    const headerText = headers.join(' | ');
    return `[Context: ${headerText}]\n\n${content}`;
  }

  /**
   * Extract comments from code
   */
  private extractComments(content: string, language: string): Array<{ type: string; text: string }> {
    const comments: Array<{ type: string; text: string }> = [];

    const patterns = this.getCommentPatterns(language);

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const text = match[1] || match[0];
        if (text && text.trim().length > 5) {
          comments.push({
            type: pattern.type,
            text: text.trim()
          });
        }
      }
    }

    return comments;
  }

  /**
   * Get comment patterns for different languages
   */
  private getCommentPatterns(language: string): Array<{ type: string; regex: RegExp }> {
    const patterns: Array<{ type: string; regex: RegExp }> = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'java':
      case 'cpp':
      case 'csharp':
        patterns.push(
          { type: 'line', regex: /\/\/\s*(.+)$/gm },
          { type: 'block', regex: /\/\*\s*([\s\S]*?)\s*\*\//g },
          { type: 'jsdoc', regex: /\/\*\*\s*([\s\S]*?)\s*\*\//g }
        );
        break;
      
      case 'python':
        patterns.push(
          { type: 'line', regex: /#\s*(.+)$/gm },
          { type: 'docstring', regex: /"""\s*([\s\S]*?)\s*"""/g },
          { type: 'docstring', regex: /'''\s*([\s\S]*?)\s*'''/g }
        );
        break;
      
      case 'shell':
        patterns.push(
          { type: 'line', regex: /#\s*(.+)$/gm }
        );
        break;
      
      case 'html':
      case 'xml':
        patterns.push(
          { type: 'block', regex: /<!--\s*([\s\S]*?)\s*-->/g }
        );
        break;
    }

    return patterns;
  }

  /**
   * Check for documentation patterns
   */
  private hasDocumentationPatterns(content: string): boolean {
    const docPatterns = [
      /@param\b/i,
      /@return\b/i,
      /@throws\b/i,
      /@author\b/i,
      /"""[\s\S]*?"""/,
      /'''[\s\S]*?'''/,
      /\/\*\*[\s\S]*?\*\//,
      /TODO:/i,
      /FIXME:/i,
      /NOTE:/i
    ];

    return docPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Normalize whitespace while preserving structure
   */
  private normalizeWhitespace(content: string): string {
    return content
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
      .replace(/\n +/g, '\n') // Remove leading spaces on lines
      .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
  }

  /**
   * Reduce syntax noise for better searchability
   */
  private reduceSyntaxNoise(content: string, language: string): string {
    let reduced = content;

    // Language-specific noise reduction
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Reduce excessive semicolons and brackets for search
        reduced = reduced.replace(/;{2,}/g, ';');
        reduced = reduced.replace(/\){2,}/g, ')');
        break;
      
      case 'json':
        // Pretty print JSON for better readability
        try {
          const parsed = JSON.parse(reduced);
          reduced = JSON.stringify(parsed, null, 2);
        } catch {
          // Keep original if parsing fails
        }
        break;
    }

    return reduced;
  }

  /**
   * Highlight important identifiers for search
   */
  private highlightImportantIdentifiers(content: string, language: string): string {
    let highlighted = content;

    // Add emphasis to important programming constructs
    const patterns = this.getImportantPatterns(language);

    for (const pattern of patterns) {
      highlighted = highlighted.replace(pattern.regex, pattern.replacement);
    }

    return highlighted;
  }

  /**
   * Get important identifier patterns by language
   */
  private getImportantPatterns(language: string): Array<{ regex: RegExp; replacement: string }> {
    const patterns: Array<{ regex: RegExp; replacement: string }> = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
        patterns.push(
          { regex: /\b(export\s+(?:default\s+)?(?:class|function|const|let|var)\s+)(\w+)/g, replacement: '$1⟨$2⟩' },
          { regex: /\b(import\s+.*?\s+from\s+['"`])([^'"`]+)(['"`])/g, replacement: '$1⟨$2⟩$3' }
        );
        break;
      
      case 'python':
        patterns.push(
          { regex: /\b(def\s+)(\w+)/g, replacement: '$1⟨$2⟩' },
          { regex: /\b(class\s+)(\w+)/g, replacement: '$1⟨$2⟩' }
        );
        break;
    }

    return patterns;
  }

  /**
   * Normalize markdown formatting
   */
  private normalizeMarkdown(content: string): string {
    return content
      .replace(/#{1,6}\s*(.+)/g, '⟨HEADER: $1⟩') // Normalize headers
      .replace(/\*\*(.+?)\*\*/g, '⟨BOLD: $1⟩') // Normalize bold
      .replace(/\*(.+?)\*/g, '⟨ITALIC: $1⟩') // Normalize italic
      .replace(/`(.+?)`/g, '⟨CODE: $1⟩') // Normalize inline code
      .replace(/```[\s\S]*?```/g, match => `⟨CODEBLOCK: ${match.replace(/```/g, '')}⟩`);
  }

  /**
   * Emphasize key documentation concepts
   */
  private emphasizeKeyDocConcepts(content: string): string {
    const keyTerms = [
      'API', 'function', 'method', 'class', 'interface', 'parameter', 'return',
      'example', 'usage', 'installation', 'configuration', 'setup'
    ];

    let emphasized = content;
    
    for (const term of keyTerms) {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      emphasized = emphasized.replace(regex, '⟨KEY: $1⟩');
    }

    return emphasized;
  }

  /**
   * Improve documentation readability
   */
  private improveDocReadability(content: string): string {
    return content
      .replace(/\n{4,}/g, '\n\n\n') // Limit excessive line breaks
      .replace(/[ \t]{3,}/g, '  ') // Normalize indentation
      .replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2'); // Improve paragraph separation
  }

  /**
   * Normalize JSON content
   */
  private normalizeJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      
      // Extract keys for better searchability
      const keys = this.extractJsonKeys(parsed);
      const keyText = keys.length > 0 ? `\n⟨CONFIG_KEYS: ${keys.join(', ')}⟩` : '';
      
      return JSON.stringify(parsed, null, 2) + keyText;
    } catch {
      return content;
    }
  }

  /**
   * Extract JSON keys recursively
   */
  private extractJsonKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    
    if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys.push(...this.extractJsonKeys(value, fullKey));
        }
      }
    }
    
    return keys;
  }

  /**
   * Normalize YAML content
   */
  private normalizeYaml(content: string): string {
    // Extract YAML keys and values for better searchability
    const lines = content.split('\n');
    const keys: string[] = [];
    
    for (const line of lines) {
      const match = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:/);
      if (match) {
        keys.push(match[1]);
      }
    }
    
    const keyText = keys.length > 0 ? `\n⟨YAML_KEYS: ${keys.join(', ')}⟩` : '';
    return content + keyText;
  }

  /**
   * Normalize XML content
   */
  private normalizeXml(content: string): string {
    // Extract XML tags for better searchability
    const tags = content.match(/<([a-zA-Z0-9_-]+)(?:\s|>)/g);
    const uniqueTags = tags ? [...new Set(tags.map(t => t.replace(/[<>\s]/g, '')))] : [];
    
    const tagText = uniqueTags.length > 0 ? `\n⟨XML_TAGS: ${uniqueTags.join(', ')}⟩` : '';
    return content + tagText;
  }

  /**
   * Normalize generic configuration
   */
  private normalizeGenericConfig(content: string): string {
    // Extract key=value pairs
    const pairs = content.match(/^[a-zA-Z0-9_-]+\s*[=:]/gm);
    const keys = pairs ? pairs.map(p => p.replace(/\s*[=:].*/, '')) : [];
    
    const keyText = keys.length > 0 ? `\n⟨CONFIG_KEYS: ${keys.join(', ')}⟩` : '';
    return content + keyText;
  }

  /**
   * Extract configuration keywords
   */
  private extractConfigKeywords(content: string, language: string): string {
    const keywords: string[] = [];
    
    // Extract configuration-specific terms
    const configPatterns = [
      /\b(server|port|host|database|username|password|timeout|retry|ssl|tls|cert)\b/gi,
      /\b(api_key|secret|token|auth|login|session|cookie)\b/gi,
      /\b(memory|cpu|disk|storage|cache|buffer|pool)\b/gi
    ];
    
    for (const pattern of configPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        keywords.push(...matches.map(m => m.toLowerCase()));
      }
    }
    
    const uniqueKeywords = [...new Set(keywords)];
    return uniqueKeywords.length > 0 ? 
      `${content}\n⟨CONFIG_TERMS: ${uniqueKeywords.join(', ')}⟩` : content;
  }

  /**
   * Separate mixed content into sections
   */
  private separateContentSections(content: string): Array<{ type: 'code' | 'docs' | 'config'; content: string }> {
    const sections: Array<{ type: 'code' | 'docs' | 'config'; content: string }> = [];
    
    // Simple heuristic - could be improved with more sophisticated parsing
    const lines = content.split('\n');
    let currentSection: { type: 'code' | 'docs' | 'config'; content: string } = { type: 'docs', content: '' };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect code patterns
      if (trimmed.match(/^(function|class|def|import|export|const|let|var)\s/)) {
        if (currentSection.type !== 'code') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'code', content: line + '\n' };
        } else {
          currentSection.content += line + '\n';
        }
      }
      // Detect config patterns
      else if (trimmed.match(/^[a-zA-Z0-9_-]+\s*[=:]/)) {
        if (currentSection.type !== 'config') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'config', content: line + '\n' };
        } else {
          currentSection.content += line + '\n';
        }
      }
      // Default to docs
      else {
        if (currentSection.type !== 'docs') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'docs', content: line + '\n' };
        } else {
          currentSection.content += line + '\n';
        }
      }
    }
    
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Improve general readability
   */
  private improveReadability(content: string): string {
    return content
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure space after sentences
      .replace(/([,;])\s*([a-zA-Z])/g, '$1 $2') // Ensure space after commas/semicolons
      .replace(/\s{2,}/g, ' ') // Multiple spaces to single
      .replace(/\n\s*\n\s*\n/g, '\n\n'); // Limit consecutive newlines
  }

  /**
   * Fix common encoding issues
   */
  private fixEncodingIssues(content: string): string {
    return content
      .replace(/â€™/g, "'") // Smart quote
      .replace(/â€œ/g, '"') // Smart quote
      .replace(/â€/g, '"') // Smart quote
      .replace(/Ã¡/g, 'á') // Common encoding issue
      .replace(/Ã©/g, 'é') // Common encoding issue
      .replace(/â€"/g, '—'); // Em dash
  }
}
