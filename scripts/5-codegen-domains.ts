#!/usr/bin/env tsx
/**
 * Script 5: Generate TypeScript code from domain definitions
 * Creates the DomainExemplars.ts file with all domain data
 */

import * as fs from 'fs/promises';
import { format } from 'prettier';
import { config } from '../config/domain-generation.config.js';

async function main() {
  console.log('📝 Generating TypeScript code...\n');

  const startTime = Date.now();

  // Load domains
  console.log(`📖 Reading ${config.paths.domainsGenerated}...`);
  const domainsData = JSON.parse(
    await fs.readFile(config.paths.domainsGenerated, 'utf-8')
  );

  if (!domainsData.domains || domainsData.domains.length === 0) {
    console.error('❌ No domains found in file');
    process.exit(1);
  }

  const domains = domainsData.domains;
  console.log(`   Found ${domains.length} domains from ${domainsData.generatedAt}`);

  // Generate TypeScript code
  console.log('\n✍️  Generating TypeScript code...');

  const code = `
/**
 * Domain exemplar definitions for semantic domain classification
 * Auto-generated from Libraries.io data + LLM enrichment
 * 
 * Generated: ${new Date().toISOString()}
 * Source: ${domainsData.sourceFile}
 * LLM Model: ${domainsData.llmModel}
 * Total Domains: ${domains.length}
 * 
 * ⚠️  DO NOT EDIT MANUALLY
 * This file is regenerated monthly via CI/CD
 * To update: Run the domain generation pipeline or trigger the GitHub Action
 */

export interface DomainExemplar {
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

/**
 * Complete list of domain exemplars
 * Used for semantic domain classification during indexing and search
 */
export const DOMAIN_EXEMPLARS: DomainExemplar[] = ${JSON.stringify(domains, null, 2)};

/**
 * Get a specific domain exemplar by name
 */
export function getDomainExemplar(domain: string): DomainExemplar | undefined {
  return DOMAIN_EXEMPLARS.find(e => e.domain === domain);
}

/**
 * Get all domain names
 */
export function getAllDomainNames(): string[] {
  return DOMAIN_EXEMPLARS.map(e => e.domain);
}

/**
 * Get related domains for a given domain
 */
export function getRelatedDomains(domain: string): string[] {
  const exemplar = getDomainExemplar(domain);
  return exemplar?.relatedDomains || [];
}

/**
 * Get boost factor for a domain (for search relevance tuning)
 */
export function getBoostFactor(domain: string): number {
  const exemplar = getDomainExemplar(domain);
  return exemplar?.boostFactor || 1.0;
}

/**
 * Get domains by category
 */
export function getDomainsByCategory(category: string): DomainExemplar[] {
  return DOMAIN_EXEMPLARS.filter(e => e.metadata?.category === category);
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const exemplar of DOMAIN_EXEMPLARS) {
    if (exemplar.metadata?.category) {
      categories.add(exemplar.metadata.category);
    }
  }
  return Array.from(categories).sort();
}

/**
 * Search domains by keyword
 */
export function searchDomainsByKeyword(keyword: string): DomainExemplar[] {
  const lowerKeyword = keyword.toLowerCase();
  return DOMAIN_EXEMPLARS.filter(e =>
    e.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
    e.domain.toLowerCase().includes(lowerKeyword) ||
    e.description.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get top N domains by popularity
 */
export function getTopDomainsByPopularity(limit: number = 10): DomainExemplar[] {
  return DOMAIN_EXEMPLARS
    .filter(e => e.metadata?.popularity)
    .sort((a, b) => (b.metadata!.popularity || 0) - (a.metadata!.popularity || 0))
    .slice(0, limit);
}

/**
 * Statistics about the domain collection
 */
export const DOMAIN_STATS = {
  total: ${domains.length},
  generatedAt: '${domainsData.generatedAt}',
  categories: getAllCategories(),
  avgKeywordsPerDomain: ${(domains.reduce((sum: number, d: any) => sum + d.keywords.length, 0) / domains.length).toFixed(1)},
  avgBoostFactor: ${(domains.reduce((sum: number, d: any) => sum + d.boostFactor, 0) / domains.length).toFixed(2)},
};
`;

  // Format with Prettier
  console.log('   Formatting with Prettier...');
  const formatted = await format(code, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'es5',
    printWidth: 100,
    tabWidth: 2,
  });

  // Save to file
  await fs.mkdir('src/generated', { recursive: true });
  await fs.writeFile(config.paths.domainsTypeScript, formatted);

  const fileSize = (formatted.length / 1024).toFixed(1);
  console.log(`\n✅ Generated TypeScript file`);
  console.log(`   File size: ${fileSize} KB`);
  console.log(`   Exported functions: 9`);
  console.log(`   Total domains: ${domains.length}`);

  // Create README for generated directory
  const readme = `# Generated Files

This directory contains auto-generated files from the domain generation pipeline.

## Files

- \`DomainExemplars.ts\` - TypeScript domain definitions with utility functions
- \`domain-embeddings.msgpack\` - Pre-computed embeddings in MessagePack format
- \`.gitattributes\` - Git configuration for binary files

## ⚠️  Important

**DO NOT EDIT THESE FILES MANUALLY**

These files are regenerated monthly via CI/CD workflow. Any manual changes will be overwritten.

## Regeneration

To regenerate these files:

1. **Locally**: Run \`npm run generate:all\`
2. **CI/CD**: Trigger the "Monthly Domain Update" GitHub Action
3. **Manual**: Run each script in sequence (1-5)

## Pipeline

1. \`scripts/1-fetch-libraries-io.ts\` - Fetch package data
2. \`scripts/2-cluster-technologies.ts\` - Cluster into domains
3. \`scripts/3-enrich-llm.ts\` - LLM enrichment
4. \`scripts/4-generate-embeddings.ts\` - Generate embeddings
5. \`scripts/5-codegen-domains.ts\` - Generate TypeScript

Last generated: ${new Date().toISOString()}
`;

  await fs.writeFile('src/generated/README.md', readme);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n💾 Saved to ${config.paths.domainsTypeScript}`);
  console.log(`📝 Created src/generated/README.md`);
  console.log(`⏱️  Completed in ${elapsed}s`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
