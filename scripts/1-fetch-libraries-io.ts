#!/usr/bin/env tsx
/**
 * Script 1: Fetch top packages from Libraries.io
 * Fetches the most popular packages across multiple platforms
 */

import * as fs from 'fs/promises';
import { LibrariesIoClient } from './utils/libraries-io-client.js';
import { config } from '../config/domain-generation.config.js';

async function main() {
  console.log('📚 Fetching top packages from Libraries.io...\n');

  const startTime = Date.now();
  
  // Check for API key
  if (!config.librariesIo.apiKey) {
    console.error('❌ Error: LIBRARIESIO_API_KEY environment variable is required');
    console.log('\nGet your API key from: https://libraries.io/account');
    process.exit(1);
  }

  const client = new LibrariesIoClient(config.librariesIo.apiKey);
  const allPackages = [];

  // Fetch packages from each platform
  for (const platform of config.librariesIo.platforms) {
    console.log(`📦 Fetching from ${platform}...`);
    
    try {
      const packages = await client.searchPackages({
        platform,
        sort: 'dependents_count',
        per_page: config.librariesIo.packagesPerPlatform,
      });

      console.log(`   ✓ Found ${packages.length} packages`);
      console.log(`   Top 3: ${packages.slice(0, 3).map(p => p.name).join(', ')}`);
      
      allPackages.push(...packages);

      // Rate limiting
      if (platform !== config.librariesIo.platforms[config.librariesIo.platforms.length - 1]) {
        console.log(`   Waiting ${config.librariesIo.rateLimitDelay}ms (rate limiting)...`);
        await LibrariesIoClient.sleep(config.librariesIo.rateLimitDelay);
      }
    } catch (error: any) {
      console.error(`   ❌ Error fetching from ${platform}:`, error.message);
      // Continue with other platforms
    }
  }

  if (allPackages.length === 0) {
    console.error('\n❌ No packages were fetched. Check your API key and network connection.');
    process.exit(1);
  }

  console.log(`\n✅ Successfully fetched ${allPackages.length} packages total`);

  // Statistics
  const byPlatform = allPackages.reduce((acc, pkg) => {
    acc[pkg.platform] = (acc[pkg.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Packages by platform:');
  for (const [platform, count] of Object.entries(byPlatform)) {
    console.log(`   ${platform}: ${count}`);
  }

  const totalDependents = allPackages.reduce((sum, pkg) => sum + pkg.dependents_count, 0);
  console.log(`\n📈 Total dependents: ${totalDependents.toLocaleString()}`);

  // Save to file
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(
    config.paths.packagesRaw,
    JSON.stringify({
      fetchedAt: new Date().toISOString(),
      totalPackages: allPackages.length,
      platforms: config.librariesIo.platforms,
      packages: allPackages,
    }, null, 2)
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n💾 Saved to ${config.paths.packagesRaw}`);
  console.log(`⏱️  Completed in ${elapsed}s`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
