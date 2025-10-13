#!/usr/bin/env tsx
/**
 * Script 3: Enrich domain candidates with LLM-generated descriptions
 * Uses OpenAI to generate rich, searchable descriptions
 */

import * as fs from 'fs/promises';
import { OpenAIClient } from './utils/openai-client.js';
import { config } from '../config/domain-generation.config.js';

async function main() {
  console.log('🤖 Enriching domains with LLM...\n');

  const startTime = Date.now();

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Load technology clusters
  console.log(`📖 Reading ${config.paths.technologyClusters}...`);
  const clustersData = JSON.parse(
    await fs.readFile(config.paths.technologyClusters, 'utf-8')
  );

  if (!clustersData.clusters || clustersData.clusters.length === 0) {
    console.error('❌ No clusters found in file');
    process.exit(1);
  }

  console.log(`   Found ${clustersData.clusters.length} clusters from ${clustersData.generatedAt}`);

  // Limit to top N domains
  const topClusters = clustersData.clusters.slice(0, config.output.maxDomains);
  console.log(`   Processing top ${topClusters.length} domains`);

  // Enrich with LLM
  const client = new OpenAIClient(process.env.OPENAI_API_KEY);
  const allDomains = [];
  const batchSize = config.llm.batchSize;

  console.log(`\n🔄 Processing in batches of ${batchSize}...`);

  for (let i = 0; i < topClusters.length; i += batchSize) {
    const batch = topClusters.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(topClusters.length / batchSize);

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} domains)`);
    console.log(`   Technologies: ${batch.map((c: any) => c.technology).slice(0, 5).join(', ')}${batch.length > 5 ? '...' : ''}`);

    try {
      const enriched = await client.enrichDomains(batch);
      allDomains.push(...enriched);
      console.log(`   ✓ Successfully enriched ${enriched.length} domains`);
    } catch (error: any) {
      console.error(`   ❌ Error enriching batch:`, error.message);
      // Continue with next batch
    }

    // Progress indicator
    console.log(`   Progress: ${allDomains.length}/${topClusters.length} domains completed`);
  }

  if (allDomains.length === 0) {
    console.error('\n❌ No domains were enriched successfully');
    process.exit(1);
  }

  console.log(`\n✅ Successfully enriched ${allDomains.length} domains`);

  // Statistics
  const avgDescLength = allDomains.reduce((sum, d) => sum + d.description.length, 0) / allDomains.length;
  const avgKeywords = allDomains.reduce((sum, d) => sum + d.keywords.length, 0) / allDomains.length;

  console.log('\n📊 Statistics:');
  console.log(`   Average description length: ${Math.round(avgDescLength)} characters`);
  console.log(`   Average keywords per domain: ${avgKeywords.toFixed(1)}`);
  console.log(`   Boost factor range: ${Math.min(...allDomains.map(d => d.boostFactor)).toFixed(2)} - ${Math.max(...allDomains.map(d => d.boostFactor)).toFixed(2)}`);

  // Preview first domain
  if (allDomains.length > 0) {
    const first = allDomains[0];
    console.log('\n📝 Example domain:');
    console.log(`   Domain: ${first.domain}`);
    console.log(`   Description: ${first.description.substring(0, 100)}...`);
    console.log(`   Keywords: ${first.keywords.slice(0, 5).join(', ')}...`);
    console.log(`   Boost factor: ${first.boostFactor}`);
  }

  // Save to file
  await fs.writeFile(
    config.paths.domainsGenerated,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceFile: config.paths.technologyClusters,
      totalDomains: allDomains.length,
      llmModel: config.llm.model,
      domains: allDomains,
    }, null, 2)
  );

  // Also save as fallback
  await fs.writeFile(
    config.paths.domainsFallback,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      domains: allDomains,
    }, null, 2)
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n💾 Saved to ${config.paths.domainsGenerated}`);
  console.log(`💾 Saved fallback to ${config.paths.domainsFallback}`);
  console.log(`⏱️  Completed in ${elapsed}s`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
