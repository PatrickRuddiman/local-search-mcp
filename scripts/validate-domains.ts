#!/usr/bin/env tsx
/**
 * Validation script for generated domains
 * Ensures quality and consistency of domain data
 */

import * as fs from 'fs/promises';
import { config } from '../config/domain-generation.config.js';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalDomains: number;
    passedValidation: number;
    failedValidation: number;
  };
}

async function main() {
  console.log('✅ Validating generated domains...\n');

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalDomains: 0,
      passedValidation: 0,
      failedValidation: 0,
    },
  };

  try {
    // Load generated domains
    console.log(`📖 Reading ${config.paths.domainsGenerated}...`);
    const domainsData = JSON.parse(
      await fs.readFile(config.paths.domainsGenerated, 'utf-8')
    );

    if (!domainsData.domains || !Array.isArray(domainsData.domains)) {
      result.errors.push('Missing or invalid domains array');
      result.isValid = false;
      printResults(result);
      process.exit(1);
    }

    const domains = domainsData.domains;
    result.stats.totalDomains = domains.length;
    console.log(`   Found ${domains.length} domains\n`);

    // Validate each domain
    console.log('🔍 Validating domains...\n');

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const domainErrors: string[] = [];
      const domainWarnings: string[] = [];

      // Check required fields
      for (const field of config.validation.requiredFields) {
        if (!(field in domain) || domain[field] === null || domain[field] === undefined) {
          domainErrors.push(`Domain ${i + 1} (${domain.domain || 'unknown'}): Missing required field '${field}'`);
        }
      }

      // Validate domain name
      if (domain.domain) {
        if (typeof domain.domain !== 'string') {
          domainErrors.push(`Domain ${i + 1}: 'domain' must be a string`);
        } else if (domain.domain.length === 0) {
          domainErrors.push(`Domain ${i + 1}: 'domain' cannot be empty`);
        } else if (!/^[a-z0-9-]+$/.test(domain.domain)) {
          domainWarnings.push(`Domain ${i + 1} (${domain.domain}): Should only contain lowercase letters, numbers, and hyphens`);
        }
      }

      // Validate description
      if (domain.description) {
        if (typeof domain.description !== 'string') {
          domainErrors.push(`Domain ${i + 1} (${domain.domain}): 'description' must be a string`);
        } else {
          const len = domain.description.length;
          if (len < config.validation.minDescriptionLength) {
            domainErrors.push(`Domain ${i + 1} (${domain.domain}): Description too short (${len} < ${config.validation.minDescriptionLength})`);
          }
          if (len > config.validation.maxDescriptionLength) {
            domainWarnings.push(`Domain ${i + 1} (${domain.domain}): Description quite long (${len} > ${config.validation.maxDescriptionLength})`);
          }
        }
      }

      // Validate keywords
      if (domain.keywords) {
        if (!Array.isArray(domain.keywords)) {
          domainErrors.push(`Domain ${i + 1} (${domain.domain}): 'keywords' must be an array`);
        } else {
          if (domain.keywords.length < config.validation.minKeywords) {
            domainErrors.push(`Domain ${i + 1} (${domain.domain}): Too few keywords (${domain.keywords.length} < ${config.validation.minKeywords})`);
          }
          if (domain.keywords.length > config.validation.maxKeywords) {
            domainWarnings.push(`Domain ${i + 1} (${domain.domain}): Many keywords (${domain.keywords.length} > ${config.validation.maxKeywords})`);
          }

          // Check for duplicate keywords
          const uniqueKeywords = new Set(domain.keywords.map((k: string) => k.toLowerCase()));
          if (uniqueKeywords.size < domain.keywords.length) {
            domainWarnings.push(`Domain ${i + 1} (${domain.domain}): Has duplicate keywords`);
          }
        }
      }

      // Validate relatedDomains
      if (domain.relatedDomains) {
        if (!Array.isArray(domain.relatedDomains)) {
          domainErrors.push(`Domain ${i + 1} (${domain.domain}): 'relatedDomains' must be an array`);
        } else if (domain.relatedDomains.length === 0) {
          domainWarnings.push(`Domain ${i + 1} (${domain.domain}): No related domains specified`);
        }
      }

      // Validate boostFactor
      if (domain.boostFactor !== undefined) {
        if (typeof domain.boostFactor !== 'number') {
          domainErrors.push(`Domain ${i + 1} (${domain.domain}): 'boostFactor' must be a number`);
        } else {
          if (domain.boostFactor < config.output.minBoostFactor || domain.boostFactor > config.output.maxBoostFactor) {
            domainErrors.push(`Domain ${i + 1} (${domain.domain}): boostFactor out of range (${domain.boostFactor})`);
          }
        }
      }

      // Record results for this domain
      if (domainErrors.length > 0) {
        result.stats.failedValidation++;
        result.errors.push(...domainErrors);
        result.isValid = false;
      } else {
        result.stats.passedValidation++;
      }

      if (domainWarnings.length > 0) {
        result.warnings.push(...domainWarnings);
      }
    }

    // Check for duplicate domain names
    const domainNames = domains.map((d: any) => d.domain).filter(Boolean);
    const uniqueNames = new Set(domainNames);
    if (uniqueNames.size < domainNames.length) {
      result.errors.push('Duplicate domain names detected');
      result.isValid = false;
    }

    // Validate embeddings file exists and matches
    try {
      const embeddingsBuffer = await fs.readFile(config.paths.embeddingsBinary);
      console.log(`\n📦 Embeddings file exists: ${(embeddingsBuffer.length / 1024).toFixed(1)} KB`);
    } catch {
      result.warnings.push('Embeddings file not found or not readable');
    }

  } catch (error: any) {
    result.errors.push(`Fatal error: ${error.message}`);
    result.isValid = false;
  }

  // Print results
  printResults(result);

  // Exit with appropriate code
  process.exit(result.isValid ? 0 : 1);
}

function printResults(result: ValidationResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(60));

  console.log(`\nTotal domains: ${result.stats.totalDomains}`);
  console.log(`✅ Passed: ${result.stats.passedValidation}`);
  console.log(`❌ Failed: ${result.stats.failedValidation}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(error => {
      console.log(`   - ${error}`);
    });
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more errors`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
    result.warnings.slice(0, 10).forEach(warning => {
      console.log(`   - ${warning}`);
    });
    if (result.warnings.length > 10) {
      console.log(`   ... and ${result.warnings.length - 10} more warnings`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (result.isValid) {
    console.log('✅ VALIDATION PASSED');
  } else {
    console.log('❌ VALIDATION FAILED');
  }
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
