/**
 * Configuration for domain generation pipeline
 * Used by all generator scripts
 */

export const config = {
  librariesIo: {
    apiKey: process.env.LIBRARIESIO_API_KEY || '',
    baseUrl: 'https://libraries.io/api',
    platforms: [
      'npm',        // JavaScript/TypeScript
      'pypi',       // Python
      'maven',      // Java
      'rubygems',   // Ruby
      'cargo',      // Rust
      'nuget',      // .NET/C#
      'packagist',  // PHP
      'go',         // Go
      'pub',        // Dart/Flutter
      'hex',        // Elixir
    ] as const,
    packagesPerPlatform: 100,
    rateLimitDelay: 1100, // ms between requests (55 req/min, safely under 60/min limit)
    timeout: 120000, // 60 seconds (increased for slow npm queries)
    retries: 3, // Number of retries for failed requests
  },

  clustering: {
    minPopularity: 1000, // Min dependents count
    maxDomainsPerCategory: 20, // Prevent overrepresentation
    categoryWeights: {
      frontend: 1.2,
      backend: 1.1,
      database: 1.0,
      'machine-learning': 1.3,
      devops: 1.1,
      testing: 0.9,
      general: 0.8,
    },
  },

  llm: {
    provider: 'openai' as const,
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    batchSize: 20,
    maxTokensPerDescription: 300,
    retries: 3,
    retryDelay: 2000,
  },

  embeddings: {
    model: 'universal-sentence-encoder',
    dimensions: 512,
    batchSize: 32,
    backend: 'tensorflow' as const,
  },

  output: {
    maxDomains: 100,
    minBoostFactor: 1.0,
    maxBoostFactor: 1.5,
    serializationFormat: 'msgpack' as const,
  },

  validation: {
    minDescriptionLength: 100,
    maxDescriptionLength: 600,
    minKeywords: 3,
    maxKeywords: 15,
    requiredFields: [
      'domain',
      'description',
      'keywords',
      'relatedDomains',
      'boostFactor',
    ] as const,
  },

  paths: {
    packagesRaw: 'data/packages-raw.json',
    technologyClusters: 'data/technology-clusters.json',
    domainsGenerated: 'data/domains-generated.json',
    domainsFallback: 'data/domains-fallback.json',
    embeddingsBinary: 'src/generated/domain-embeddings.msgpack',
    domainsTypeScript: 'src/generated/DomainExemplars.ts',
  },
} as const;

export type Config = typeof config;
