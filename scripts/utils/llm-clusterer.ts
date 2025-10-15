/**
 * LLM-based technology clusterer
 * Uses GPT-4 to intelligently group packages into technology domains
 * No manual pattern maintenance required
 */

import { OpenAIClient, DomainCandidate } from './openai-client.js';
import type { LibrariesIoPackage } from './libraries-io-client.js';
import { config } from '../../config/domain-generation.config.js';

interface ClusterBatch {
  clusters: {
    domain: string;
    category: string;
    packages: string[];
    totalPopularity: number;
    description: string;
    keywords: string[];
    relatedDomains: string[];
  }[];
}

export class LLMClusterer {
  private openaiClient: OpenAIClient;
  private minPopularity: number;
  private batchSize: number;
  private maxDomains: number;

  constructor(clusteringConfig?: typeof config.clustering) {
    this.openaiClient = new OpenAIClient();
    this.minPopularity = clusteringConfig?.minPopularity || config.clustering.minPopularity;
    this.batchSize = 50; // Optimal batch size for LLM context
    this.maxDomains = config.output.maxDomains;
  }

  /**
   * Cluster packages into technology domains using LLM
   */
  async cluster(packages: LibrariesIoPackage[]): Promise<DomainCandidate[]> {
    console.log(`  Analyzing ${packages.length} packages with LLM...`);

    // Filter by minimum popularity
    const popularPackages = packages.filter(
      pkg => pkg.dependents_count >= this.minPopularity
    );

    console.log(`  ${popularPackages.length} packages meet minimum popularity threshold`);

    // Sort by popularity (most popular first for better clustering)
    const sorted = popularPackages.sort((a, b) => b.dependents_count - a.dependents_count);

    // Process in batches
    const batches = this.createBatches(sorted);
    console.log(`  Processing ${batches.length} batches with LLM...`);

    const allClusters: ClusterBatch['clusters'] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      process.stdout.write(`  Batch ${i + 1}/${batches.length}...`);

      try {
        const result = await this.clusterBatch(batch);
        allClusters.push(...result.clusters);
        process.stdout.write(` ✓ (${result.clusters.length} clusters)\n`);
      } catch (error: any) {
        process.stdout.write(` ✗ (${error.message})\n`);
        console.warn(`  Skipping batch ${i + 1} due to error`);
      }

      // Rate limiting
      if (i < batches.length - 1) {
        await this.sleep(1000); // 1 second between batches
      }
    }

    console.log(`  Identified ${allClusters.length} clusters from all batches`);

    // Merge and consolidate clusters across batches
    const mergedClusters = this.mergeClusters(allClusters, sorted);
    console.log(`  Merged into ${mergedClusters.length} unique domains`);

    // Convert to DomainCandidate format
    const candidates = this.toDomainCandidates(mergedClusters, sorted);

    // Apply limits and sort
    const limited = this.applyLimits(candidates);
    console.log(`  Final: ${limited.length} domain candidates`);

    return limited;
  }

  /**
   * Create batches of packages for LLM processing
   */
  private createBatches(packages: LibrariesIoPackage[]): LibrariesIoPackage[][] {
    const batches: LibrariesIoPackage[][] = [];
    
    for (let i = 0; i < packages.length; i += this.batchSize) {
      batches.push(packages.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Cluster a single batch using LLM
   */
  private async clusterBatch(packages: LibrariesIoPackage[]): Promise<ClusterBatch> {
    const prompt = this.buildClusteringPrompt(packages);
    
    // Use the OpenAI client's internal client property
    const response = await (this.openaiClient as any).client.chat.completions.create({
      model: config.llm.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer analyzing package ecosystems. Group related packages into technology domains. Output valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Deterministic clustering
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content);
  }

  /**
   * Build clustering prompt for LLM
   */
  private buildClusteringPrompt(packages: LibrariesIoPackage[]): string {
    const packageList = packages.map((pkg, i) => {
      const desc = pkg.description ? pkg.description.substring(0, 100) : 'No description';
      const keywords = pkg.keywords.slice(0, 5).join(', ');
      return `${i + 1}. ${pkg.name} (${pkg.platform}) - ${pkg.dependents_count.toLocaleString()} dependents
   Description: ${desc}
   Keywords: ${keywords || 'none'}`;
    }).join('\n\n');

    return `Analyze these ${packages.length} software packages and group them into technology domains.

PACKAGES:
${packageList}

TASK:
1. Identify which packages belong to the same technology/framework
2. Group related packages into domains (e.g., "react", "django", "tensorflow")
3. Assign each domain a category: frontend, backend, database, machine-learning, devops, testing, or general
4. Calculate total popularity (sum of dependents)
5. Extract relevant keywords from descriptions
6. Identify 3-5 related domains

RULES:
- Group packages with same core technology (e.g., "react" + "react-dom" = "react" domain)
- Popular standalone packages (>50k dependents) can be their own domain
- Focus on major frameworks, libraries, and tools
- Aim for 5-15 clusters from this batch

OUTPUT (valid JSON):
{
  "clusters": [
    {
      "domain": "technology-name",
      "category": "frontend|backend|database|machine-learning|devops|testing|general",
      "packages": ["package1", "package2"],
      "totalPopularity": 123456,
      "description": "Brief description of what this technology does",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "relatedDomains": ["related1", "related2", "related3"]
    }
  ]
}`;
  }

  /**
   * Merge clusters from multiple batches
   */
  private mergeClusters(
    clusters: ClusterBatch['clusters'],
    allPackages: LibrariesIoPackage[]
  ): ClusterBatch['clusters'] {
    const domainMap = new Map<string, ClusterBatch['clusters'][0]>();

    for (const cluster of clusters) {
      const domainKey = cluster.domain.toLowerCase();

      if (domainMap.has(domainKey)) {
        // Merge with existing cluster
        const existing = domainMap.get(domainKey)!;
        existing.packages.push(...cluster.packages);
        existing.packages = [...new Set(existing.packages)]; // Dedupe
        existing.totalPopularity += cluster.totalPopularity;
        
        // Merge keywords
        const allKeywords = new Set([...existing.keywords, ...cluster.keywords]);
        existing.keywords = Array.from(allKeywords).slice(0, 15);
        
        // Merge related domains
        const allRelated = new Set([...existing.relatedDomains, ...cluster.relatedDomains]);
        existing.relatedDomains = Array.from(allRelated).slice(0, 6);
        
        // Use longer description if available
        if (cluster.description.length > existing.description.length) {
          existing.description = cluster.description;
        }
      } else {
        domainMap.set(domainKey, { ...cluster });
      }
    }

    // Sort by popularity
    return Array.from(domainMap.values())
      .sort((a, b) => b.totalPopularity - a.totalPopularity);
  }

  /**
   * Convert to DomainCandidate format
   */
  private toDomainCandidates(
    clusters: ClusterBatch['clusters'],
    allPackages: LibrariesIoPackage[]
  ): DomainCandidate[] {
    return clusters.map(cluster => {
      // Find primary package (most popular in cluster)
      const clusterPackages = allPackages.filter(pkg => 
        cluster.packages.includes(pkg.name)
      );
      
      const primaryPackage = clusterPackages.reduce((max, pkg) => 
        pkg.dependents_count > max.dependents_count ? pkg : max,
        clusterPackages[0] || allPackages[0]
      );

      return {
        technology: cluster.domain,
        category: cluster.category,
        popularity: cluster.totalPopularity,
        description: cluster.description,
        keywords: cluster.keywords,
        relatedTechnologies: cluster.relatedDomains,
        platform: primaryPackage.platform
      };
    });
  }

  /**
   * Apply category limits and final sorting
   */
  private applyLimits(candidates: DomainCandidate[]): DomainCandidate[] {
    const byCategory = new Map<string, DomainCandidate[]>();

    // Group by category
    for (const candidate of candidates) {
      if (!byCategory.has(candidate.category)) {
        byCategory.set(candidate.category, []);
      }
      byCategory.get(candidate.category)!.push(candidate);
    }

    // Apply limits per category
    const limited: DomainCandidate[] = [];
    const maxPerCategory = config.clustering.maxDomainsPerCategory;

    for (const [category, items] of byCategory) {
      const categoryWeight = (config.clustering.categoryWeights as any)[category] || 1.0;
      const limit = Math.floor(maxPerCategory * categoryWeight);
      limited.push(...items.slice(0, limit));
    }

    // Sort by popularity and apply final limit
    return limited
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, this.maxDomains);
  }

  /**
   * Sleep utility for rate limiting
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
