# Generated Files

This directory contains auto-generated files from the domain generation pipeline.

## Files

- `DomainExemplars.ts` - TypeScript domain definitions with utility functions
- `domain-embeddings.msgpack` - Pre-computed embeddings in MessagePack format
- `.gitattributes` - Git configuration for binary files

## ⚠️  Important

**DO NOT EDIT THESE FILES MANUALLY**

These files are regenerated monthly via CI/CD workflow. Any manual changes will be overwritten.

## Regeneration

To regenerate these files:

1. **Locally**: Run `npm run generate:all`
2. **CI/CD**: Trigger the "Monthly Domain Update" GitHub Action
3. **Manual**: Run each script in sequence (1-5)

## Pipeline

1. `scripts/1-fetch-libraries-io.ts` - Fetch package data
2. `scripts/2-cluster-technologies.ts` - Cluster into domains
3. `scripts/3-enrich-llm.ts` - LLM enrichment
4. `scripts/4-generate-embeddings.ts` - Generate embeddings
5. `scripts/5-codegen-domains.ts` - Generate TypeScript

Last generated: 2025-10-03T22:38:53.889Z
