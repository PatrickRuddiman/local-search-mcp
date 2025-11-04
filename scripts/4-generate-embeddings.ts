#!/usr/bin/env node
/**
 * Script 4: Generate Embeddings
 * 
 * Generates embeddings for domain descriptions using Universal Sentence Encoder
 * to enable semantic similarity matching at runtime.
 * 
 * Uses TensorFlow.js with Universal Sentence Encoder (512 dimensions)
 * - Same model as runtime for consistency
 * - Pre-computes domain embeddings for fast lookup
 * - Serializes to MessagePack for efficient loading
 */

import fs from 'fs/promises';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { encode } from '@msgpack/msgpack';
import { config } from '../config/domain-generation.config.js';

// Dynamic TensorFlow import with fallback
let tf: any;
let tfBackend: string;

async function initializeTensorFlow(): Promise<void> {
  try {
    console.log('⚙️  Initializing TensorFlow backend...');
    
    try {
      // Try tfjs-node first (faster, GPU support)
      tf = await import('@tensorflow/tfjs-node');
      tfBackend = 'tensorflow-node';
      console.log('✓ TensorFlow.js Node backend initialized');
    } catch (nodeError) {
      // Fallback to CPU backend
      tf = await import('@tensorflow/tfjs');
      await tf.setBackend('cpu');
      tfBackend = 'cpu';
      console.log('✓ TensorFlow.js CPU backend initialized (fallback)');
    }
  } catch (error: any) {
    console.error('✗ Failed to initialize TensorFlow:', error.message);
    throw error;
  }
}

interface DomainData {
  domain: string;
  description: string;
  keywords: string[];
  relatedDomains: string[];
  boostFactor: number;
}

interface EmbeddingData {
  model: string;
  dimensions: number;
  embeddings: Record<string, number[]>;
}

async function loadDomains(): Promise<DomainData[]> {
  console.log('\n📖 Loading domain data...');
  
  try {
    const data = await fs.readFile(config.paths.domainsGenerated, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle both array format and object with domains property
    const domains = Array.isArray(parsed) ? parsed : parsed.domains;
    
    if (!Array.isArray(domains) || domains.length === 0) {
      throw new Error('No domains found in file. Make sure you ran scripts 1-3 first.');
    }
    
    console.log(`✓ Loaded ${domains.length} domains`);
    return domains;
  } catch (error: any) {
    console.error('✗ Failed to load domains:', error.message);
    console.error('   Make sure you ran the previous steps:');
    console.error('   1. npm run generate:1-fetch');
    console.error('   2. npm run generate:2-cluster');
    console.error('   3. npm run generate:3-enrich');
    throw error;
  }
}

async function generateEmbeddings(domains: DomainData[]): Promise<EmbeddingData> {
  console.log('\n🧮 Generating embeddings with Universal Sentence Encoder...');
  console.log(`   Model: ${config.embeddings.model}`);
  console.log(`   Dimensions: ${config.embeddings.dimensions}`);
  console.log(`   Backend: ${tfBackend}`);
  
  try {
    // Load Universal Sentence Encoder
    console.log('   Loading model...');
    const model = await use.load();
    console.log('   ✓ Model loaded');
    
    const embeddings: Record<string, number[]> = {};
    const batchSize = config.embeddings.batchSize;
    const totalBatches = Math.ceil(domains.length / batchSize);
    
    // Process in batches
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      process.stdout.write(`   Processing batch ${batchNum}/${totalBatches}...`);
      
      // Extract descriptions for embedding
      const texts = batch.map(d => d.description);
      
      // Generate embeddings
      const embeddingTensor = await model.embed(texts);
      const embeddingArray = await embeddingTensor.array();
      
      // Store embeddings
      batch.forEach((domain, idx) => {
        embeddings[domain.domain] = Array.from(embeddingArray[idx] as number[]);
      });
      
      // Clean up tensor
      embeddingTensor.dispose();
      
      process.stdout.write(` ✓\n`);
    }
    
    console.log(`✓ Generated ${Object.keys(embeddings).length} embeddings`);
    
    return {
      model: config.embeddings.model,
      dimensions: config.embeddings.dimensions,
      embeddings
    };
    
  } catch (error: any) {
    console.error('\n✗ Failed to generate embeddings:', error.message);
    throw error;
  }
}

async function serializeEmbeddings(data: EmbeddingData): Promise<void> {
  console.log('\n💾 Serializing embeddings to MessagePack...');
  
  try {
    // Encode to MessagePack
    const packed = encode(data);
    
    // Write to file
    await fs.writeFile(config.paths.embeddingsBinary, packed);
    
    const sizeKB = (packed.length / 1024).toFixed(2);
    console.log(`✓ Saved embeddings to ${config.paths.embeddingsBinary}`);
    console.log(`   Size: ${sizeKB} KB`);
    
  } catch (error: any) {
    console.error('✗ Failed to serialize embeddings:', error.message);
    throw error;
  }
}

async function verifyEmbeddings(data: EmbeddingData): Promise<void> {
  console.log('\n🔍 Verifying embeddings...');
  
  const embeddingCount = Object.keys(data.embeddings).length;
  const sampleDomain = Object.keys(data.embeddings)[0];
  const sampleEmbedding = data.embeddings[sampleDomain];
  
  console.log(`   Total embeddings: ${embeddingCount}`);
  console.log(`   Dimensions: ${sampleEmbedding.length}`);
  console.log(`   Sample domain: ${sampleDomain}`);
  console.log(`   Sample vector (first 5): [${sampleEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  
  // Verify all embeddings have correct dimensions
  const invalidDimensions = Object.entries(data.embeddings)
    .filter(([, emb]) => emb.length !== config.embeddings.dimensions);
  
  if (invalidDimensions.length > 0) {
    console.error(`✗ Found ${invalidDimensions.length} embeddings with invalid dimensions`);
    throw new Error('Embedding dimension mismatch');
  }
  
  console.log('✓ All embeddings verified');
}

async function main() {
  console.log('🚀 Script 4: Generate Embeddings');
  console.log('=====================================');
  
  const startTime = Date.now();
  
  try {
    // Initialize TensorFlow
    await initializeTensorFlow();
    
    // Load domains
    const domains = await loadDomains();
    
    // Generate embeddings
    const embeddingData = await generateEmbeddings(domains);
    
    // Verify embeddings
    await verifyEmbeddings(embeddingData);
    
    // Serialize to MessagePack
    await serializeEmbeddings(embeddingData);
    
    // Clean up TensorFlow resources
    if (tf) {
      tf.disposeVariables();
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Embedding generation completed in ${duration}s`);
    console.log(`📦 Output: ${config.paths.embeddingsBinary}`);
    
  } catch (error: any) {
    console.error('\n❌ Embedding generation failed:', error.message);
    process.exit(1);
  }
}

main();
