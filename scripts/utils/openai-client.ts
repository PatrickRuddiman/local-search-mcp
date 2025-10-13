/**
 * OpenAI client for LLM-based domain enrichment
 */

import OpenAI from 'openai';
import { config } from '../../config/domain-generation.config.js';

export interface DomainCandidate {
  technology: string;
  category: string;
  popularity: number;
  description: string;
  keywords: string[];
  relatedTechnologies: string[];
  platform?: string;
}

export interface EnrichedDomain {
  domain: string;
  description: string;
  keywords: string[];
  relatedDomains: string[];
  boostFactor: number;
  metadata?: {
    source: string;
    popularity: number;
    category: string;
    platform?: string;
  };
}

export class OpenAIClient {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    this.client = new OpenAI({ apiKey: key });
    this.model = config.llm.model;
    this.temperature = config.llm.temperature;
    this.maxRetries = config.llm.retries;
    this.retryDelay = config.llm.retryDelay;
  }

  /**
   * Enrich domain candidates with LLM-generated descriptions
   */
  async enrichDomains(candidates: DomainCandidate[]): Promise<EnrichedDomain[]> {
    const prompt = this.buildEnrichmentPrompt(candidates);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a technical documentation expert specializing in software development technologies. Your task is to create comprehensive, searchable descriptions for code search systems.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.temperature,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        const parsed = JSON.parse(content);
        
        if (!parsed.domains || !Array.isArray(parsed.domains)) {
          throw new Error('Invalid response format: missing domains array');
        }

        return this.mapToEnrichedDomains(parsed.domains, candidates);

      } catch (error: any) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to enrich domains after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Build the enrichment prompt for the LLM
   */
  private buildEnrichmentPrompt(candidates: DomainCandidate[]): string {
    const candidateList = candidates
      .map((c, i) => {
        return `${i + 1}. **${c.technology}**
   - Category: ${c.category}
   - Platform: ${c.platform || 'multiple'}
   - Popularity: ${c.popularity.toLocaleString()} dependents
   - Current Keywords: ${c.keywords.join(', ')}
   - Description: ${c.description || 'N/A'}`;
      })
      .join('\n\n');

    return `You are creating domain definitions for a semantic code search system. For each technology below, generate:

1. **domain**: Technology name (lowercase, hyphenated if needed)
2. **description**: 2-3 sentence description that includes:
   - What the technology does
   - Key features, APIs, or patterns developers use
   - Common use cases and search terms developers look for
   - Related concepts (be specific with function names, decorators, CLI commands)
3. **keywords**: 8-12 searchable terms (include specific APIs, patterns, common operations)
4. **relatedDomains**: 3-6 related technology domains
5. **boostFactor**: Search relevance boost (1.0-1.5, where 1.5 is most important/popular)

**Technologies to enrich:**

${candidateList}

**Important Guidelines:**
- Make descriptions semantic-rich and searchable
- Include specific APIs, decorators, functions, CLI commands
- Focus on what developers actually search for
- Be concise but information-dense
- Use present tense, active voice
- Avoid marketing language

**Output Format:**
Return a JSON object with this structure:
{
  "domains": [
    {
      "domain": "react",
      "description": "React library for building user interfaces...",
      "keywords": ["hooks", "useState", "useEffect", ...],
      "relatedDomains": ["frontend", "javascript", ...],
      "boostFactor": 1.3
    },
    ...
  ]
}`;
  }

  /**
   * Map LLM response to enriched domains with metadata
   */
  private mapToEnrichedDomains(
    llmDomains: any[],
    candidates: DomainCandidate[]
  ): EnrichedDomain[] {
    return llmDomains.map((llmDomain, index) => {
      const candidate = candidates[index];
      
      return {
        domain: llmDomain.domain || candidate.technology,
        description: llmDomain.description,
        keywords: llmDomain.keywords || candidate.keywords,
        relatedDomains: llmDomain.relatedDomains || candidate.relatedTechnologies,
        boostFactor: this.normalizeBoostFactor(llmDomain.boostFactor),
        metadata: {
          source: 'libraries.io',
          popularity: candidate.popularity,
          category: candidate.category,
          platform: candidate.platform,
        },
      };
    });
  }

  /**
   * Normalize boost factor to valid range
   */
  private normalizeBoostFactor(value: any): number {
    const num = typeof value === 'number' ? value : 1.0;
    return Math.max(
      config.output.minBoostFactor,
      Math.min(config.output.maxBoostFactor, num)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
