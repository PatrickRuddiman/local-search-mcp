#!/usr/bin/env tsx
/**
 * Script 2: Cluster technologies from raw package data
 * Uses LLM to intelligently group packages into technology domains
 */

import * as fs from 'fs/promises';
import { LLMClusterer } from './utils/llm-clusterer.js';
import { config } from '../config/domain-generation.config.js';

async function main() {
  console.log('🏷️  Clustering technologies...\n');

  const startTime = Date.now();

  // Load raw packages
  console.log(`📖 Reading ${config.paths.packagesRaw}...`);
  const rawData = JSON.parse(
    await fs.readFile(config.paths.packagesRaw, 'utf-8')
  );

  if (!rawData.packages || rawData.packages.length === 0) {
    console.error('❌ No packages found in raw data file');
    process.exit(1);
  }

  console.log(`   Found ${rawData.packages.length} packages from ${rawData.fetchedAt}`);

  // Cluster packages into technologies using LLM
  console.log('\n🤖 Clustering packages with LLM (this may take a few minutes)...');
  const clusterer = new LLMClusterer(config.clustering);
  const clusters = await clusterer.cluster(rawData.packages);

  console.log(`\n✅ Created ${clusters.length} technology clusters with LLM`);

  // Statistics
  const byCategory = clusters.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Clusters by category:');
  for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${category}: ${count}`);
  }

  // Top 10 by popularity
  console.log('\n🔝 Top 100 technologies by popularity:');
  clusters
    .slice(0, 100)
    .forEach((cluster, i) => {
      console.log(
        `   ${i + 1}. ${cluster.technology} (${cluster.category}) - ${cluster.popularity.toLocaleString()} dependents`
      );
    });

  // Save to file
  await fs.writeFile(
    config.paths.technologyClusters,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceFile: config.paths.packagesRaw,
      totalClusters: clusters.length,
      clusters,
    }, null, 2)
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n💾 Saved to ${config.paths.technologyClusters}`);
  console.log(`⏱️  Completed in ${elapsed}s`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
