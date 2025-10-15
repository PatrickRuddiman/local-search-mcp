import * as use from '@tensorflow-models/universal-sentence-encoder';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DocumentChunk, EmbeddingError, EmbeddingBackend, EmbeddingConfig, EmbeddingBackendInfo } from '../types/index.js';
import { log } from './Logger.js';

// Re-export types for convenience
export { EmbeddingBackend, EmbeddingConfig, EmbeddingBackendInfo } from '../types/index.js';

// Dynamic TensorFlow import with platform detection
let tf: any;
let tfBackend: string;

// MCP Server instance for sampling
let mcpServerInstance: Server | undefined;

/**
 * Initialize TensorFlow with fallback strategy
 * - Always try tfjs-node first for optimal performance (GPU support when available)
 * - Fall back to tfjs with CPU backend if tfjs-node fails
 */
async function initializeTensorFlow(): Promise<void> {
  const platform = process.platform;

  try {
    log.info('Attempting TensorFlow.js Node backend initialization (optimal)', { platform });

    try {
      tf = await import('@tensorflow/tfjs-node');
      tfBackend = 'tensorflow-node';
      log.info('TensorFlow.js Node backend initialized successfully');
    } catch (nodeError: any) {
      log.warn('tfjs-node initialization failed, falling back to CPU backend', {
        platform,
        error: nodeError.message
      });

      tf = await import('@tensorflow/tfjs');
      await tf.setBackend('cpu');
      tfBackend = 'cpu';
      log.info('TensorFlow.js CPU backend initialized successfully (fallback)');
    }

  } catch (error: any) {
    log.error('Failed to initialize TensorFlow backend', error);
    throw new EmbeddingError(`TensorFlow initialization failed: ${error.message}`);
  }
}

// Initialize TensorFlow at module load time
const tfInitPromise = initializeTensorFlow();

export class EmbeddingService {
  private static instance?: EmbeddingService;
  private static modelPromise?: Promise<use.UniversalSentenceEncoder>;
  private static model?: use.UniversalSentenceEncoder;
  private static isLoading = false;

  private config: EmbeddingConfig;
  private initialized = false;
  private currentBackend?: EmbeddingBackend;

  /**
   * Set MCP server instance for sampling capability
   * Should be called once during server initialization
   */
  static setMCPServer(server: Server): void {
    mcpServerInstance = server;
    log.debug('MCP server instance set for embedding service');
  }

  private constructor(config: EmbeddingConfig = {}, mcpServer?: Server) {
    log.debug('Initializing EmbeddingService singleton', { config });

    this.config = {
      batchSize: 32, // USE can handle larger batches
      ...config
    };

    // Store MCP server instance if provided
    if (mcpServer) {
      mcpServerInstance = mcpServer;
    }

    log.debug('EmbeddingService singleton initialized', {
      batchSize: this.config.batchSize,
      hasMCPServer: !!mcpServerInstance
    });
  }

  /**
   * Get singleton instance with centralized model loading
   */
  static async getInstance(config: EmbeddingConfig = {}, mcpServer?: Server): Promise<EmbeddingService> {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService(config, mcpServer);
    }

    // Select backend but don't necessarily load model yet
    await EmbeddingService.instance.selectBackend();

    return EmbeddingService.instance;
  }

  /**
   * Detect and select optimal embedding backend
   */
  private async selectBackend(): Promise<EmbeddingBackend> {
    const envBackend = process.env.EMBEDDING_BACKEND?.toLowerCase();
    
    // If environment variable is set and not 'auto', use it
    if (envBackend && envBackend !== 'auto') {
      log.info('Using pinned embedding backend from env', { backend: envBackend });
      
      switch (envBackend) {
        case 'local-gpu':
          if (await this.isGPUAvailable()) {
            this.currentBackend = EmbeddingBackend.LOCAL_GPU;
            return this.currentBackend;
          }
          log.warn('EMBEDDING_BACKEND=local-gpu but no GPU detected, falling back');
          break;
          
        case 'local-cpu':
          this.currentBackend = EmbeddingBackend.LOCAL_CPU;
          return this.currentBackend;
          
        case 'mcp-sampling':
          if (await this.isMCPSamplingAvailable()) {
            this.currentBackend = EmbeddingBackend.MCP_SAMPLING;
            return this.currentBackend;
          }
          log.warn('EMBEDDING_BACKEND=mcp-sampling but not available, falling back');
          break;
          
        case 'openai':
          if (this.isOpenAIConfigured()) {
            this.currentBackend = EmbeddingBackend.OPENAI;
            return this.currentBackend;
          }
          log.warn('EMBEDDING_BACKEND=openai but OPENAI_API_KEY not set, falling back');
          break;
          
        case 'cohere':
          if (this.isCohereConfigured()) {
            this.currentBackend = EmbeddingBackend.COHERE;
            return this.currentBackend;
          }
          log.warn('EMBEDDING_BACKEND=cohere but COHERE_API_KEY not set, falling back');
          break;
      }
    }
    
    // Auto-detection priority:
    // 1. GPU available → use it
    // 2. External API configured → use it (OpenAI preferred)
    // 3. CPU fallback
    // Note: MCP sampling is NOT in auto-detection due to client compatibility issues.
    //       Use EMBEDDING_BACKEND=mcp-sampling to explicitly enable it.
    
    if (await this.isGPUAvailable()) {
      log.info('GPU detected, using local GPU embeddings');
      this.currentBackend = EmbeddingBackend.LOCAL_GPU;
      return this.currentBackend;
    }
    
    if (this.isOpenAIConfigured()) {
      log.info('No GPU, using OpenAI embeddings API');
      this.currentBackend = EmbeddingBackend.OPENAI;
      return this.currentBackend;
    }
    
    if (this.isCohereConfigured()) {
      log.info('No GPU, using Cohere embeddings API');
      this.currentBackend = EmbeddingBackend.COHERE;
      return this.currentBackend;
    }
    
    log.warn('No GPU or API keys configured - falling back to CPU (slow)');
    log.info('Tip: Add OPENAI_API_KEY to environment for faster embeddings on CPU-only systems');
    this.currentBackend = EmbeddingBackend.LOCAL_CPU;
    return this.currentBackend;
  }

  /**
   * Check if GPU is available
   */
  private async isGPUAvailable(): Promise<boolean> {
    return await EmbeddingService.isGPUAvailable();
  }
  
  /**
   * Check if MCP sampling is available
   */
  private async isMCPSamplingAvailable(): Promise<boolean> {
    return mcpServerInstance !== undefined;
  }
  
  /**
   * Check if OpenAI is configured
   */
  private isOpenAIConfigured(): boolean {
    return !!(process.env.OPENAI_API_KEY || this.config.openaiConfig?.apiKey);
  }
  
  /**
   * Check if Cohere is configured
   */
  private isCohereConfigured(): boolean {
    return !!(process.env.COHERE_API_KEY || this.config.cohereConfig?.apiKey);
  }

  /**
   * Centralized model loading - prevents multiple workers competing for model download
   */
  private async ensureModelLoaded(): Promise<void> {
    if (EmbeddingService.model) {
      this.initialized = true;
      return;
    }

    if (EmbeddingService.isLoading && EmbeddingService.modelPromise) {
      // Another thread is loading, wait for it
      log.debug('Waiting for model loading to complete in another thread');
      EmbeddingService.model = await EmbeddingService.modelPromise;
      this.initialized = true;
      return;
    }

    // This thread takes responsibility for loading
    EmbeddingService.isLoading = true;
    EmbeddingService.modelPromise = this.loadModelSingleton();

    try {
      EmbeddingService.model = await EmbeddingService.modelPromise;
      this.initialized = true;
      log.info('Singleton model loading completed successfully');
    } catch (error) {
      EmbeddingService.isLoading = false;
      EmbeddingService.modelPromise = undefined;
      throw error;
    } finally {
      EmbeddingService.isLoading = false;
    }
  }

  /**
   * Singleton model loading implementation
   */
  private async loadModelSingleton(): Promise<use.UniversalSentenceEncoder> {
    // Ensure TensorFlow is initialized first
    await tfInitPromise;

    const timer = log.time('singleton-embedding-model-init');
    log.info('Starting singleton Universal Sentence Encoder model loading', {
      tfBackend
    });

    try {
      const model = await use.load();

      log.info('Singleton Universal Sentence Encoder loaded successfully', {
        dimensions: 512,
        backend: tfBackend,
        gpuEnabled: tfBackend === 'tensorflow-node'
      });

      timer();
      return model;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Failed to load singleton Universal Sentence Encoder model', error);

      throw new EmbeddingError(
        `Failed to initialize singleton Universal Sentence Encoder: ${message}`,
        error instanceof Error ? error : undefined
      );
    }
  }


  /**
   * Generate embeddings for text chunks
   * @param chunks Array of document chunks
   * @returns Chunks with embeddings added
   */
  async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const timer = log.time('generate-embeddings');
    
    // Select backend if not already selected
    if (!this.currentBackend) {
      await this.selectBackend();
    }
    
    log.info('Starting embedding generation', {
      backend: this.currentBackend,
      totalChunks: chunks.length,
      batchSize: this.config.batchSize || 32
    });

    try {
      let results: DocumentChunk[];
      
      switch (this.currentBackend) {
        case EmbeddingBackend.LOCAL_GPU:
        case EmbeddingBackend.LOCAL_CPU:
          results = await this.generateWithLocalModel(chunks);
          break;
          
        case EmbeddingBackend.OPENAI:
          results = await this.generateWithOpenAI(chunks);
          break;
          
        case EmbeddingBackend.COHERE:
          results = await this.generateWithCohere(chunks);
          break;
          
        case EmbeddingBackend.MCP_SAMPLING:
          results = await this.generateWithMCPSampling(chunks);
          break;
          
        default:
          throw new EmbeddingError(`Unsupported backend: ${this.currentBackend}`);
      }
      
      log.info('Embedding generation completed', {
        backend: this.currentBackend,
        totalEmbeddings: results.length
      });
      
      timer();
      return results;
      
    } catch (error: any) {
      log.error('Embedding generation failed', error, {
        backend: this.currentBackend,
        chunkCount: chunks.length
      });
      throw new EmbeddingError(
        `Embedding generation failed with ${this.currentBackend}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Generate embeddings using local TensorFlow model (existing implementation)
   */
  private async generateWithLocalModel(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    await this.ensureModelLoaded();
    
    if (!EmbeddingService.model) {
      throw new EmbeddingError('Universal Sentence Encoder not initialized');
    }
    
    // Adjust batch size based on backend for responsiveness
    // CPU mode: smaller batches (4-8) for more frequent interrupts and progress updates
    // GPU mode: larger batches (32) for efficiency
    const isCPUMode = this.currentBackend === EmbeddingBackend.LOCAL_CPU;
    const batchSize = isCPUMode 
      ? (this.config.batchSize || 6)  // Default 6 for CPU mode
      : (this.config.batchSize || 32); // Default 32 for GPU mode
    
    if (isCPUMode) {
      log.warn('WARNING: Embeddings running in CPU-only mode - this will take a very long time. For 10-100x faster processing, add OPENAI_API_KEY to your environment configuration.');
    }
    
    // Process in batches for efficiency
    const results: DocumentChunk[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

        log.debug(`Processing embedding batch ${batchNum}/${totalBatches}`, {
          batchSize: batch.length,
          remainingChunks: chunks.length - i,
          backend: this.currentBackend
        });

        const batchEmbeddings = await this.processBatch(batch);
        results.push(...batchEmbeddings);

      log.debug(`Completed embedding batch ${batchNum}/${totalBatches}`, {
        embedCount: batchEmbeddings.length
      });
    }

    return results;
  }

  /**
   * Process a single batch of chunks using Universal Sentence Encoder
   */
  private async processBatch(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (!EmbeddingService.model) {
      throw new EmbeddingError('Model not initialized');
    }

    const texts = chunks.map(chunk => this.prepareText(chunk.content));

    try {
      // Generate embeddings using Universal Sentence Encoder
      const embeddings = await EmbeddingService.model.embed(texts);

      // Extract embedding vectors from TensorFlow tensor
      const embeddingArray = await embeddings.array();

      // Add embeddings to chunks
      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: Array.from(embeddingArray[index] as number[]) // Convert tensor to array
      }));

    } catch (error: any) {
      log.warn('Batch processing failed, processing individually', { batchSize: chunks.length });
      log.error('Batch processing error details', error);

      // Fallback: process individually
      const results: DocumentChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await this.generateSingleEmbedding(chunks[i].content);
          if (embedding && embedding.length > 0) {
            results.push({
              ...chunks[i],
              embedding
            });
          } else {
            log.error(`Generated empty embedding for chunk ${chunks[i].id}, skipping`);
          }
        } catch (individualError: any) {
          log.error(`Failed to embed chunk ${chunks[i].id}`, individualError);
          // Skip chunks that fail to embed rather than adding empty embeddings
        }
      }
      
      if (results.length === 0) {
        throw new EmbeddingError('All chunks failed to generate embeddings');
      }
      
      return results;
    }
  }

  /**
   * Generate embedding for single text using Universal Sentence Encoder
   */
  private async generateSingleEmbedding(text: string): Promise<number[]> {
    if (!EmbeddingService.model) {
      throw new EmbeddingError('Model not initialized');
    }

    const preparedText = this.prepareText(text);
    const embedding = await EmbeddingService.model.embed([preparedText]);
    const embeddingArray = await embedding.array();

    return Array.from(embeddingArray[0] as number[]);
  }

  /**
   * Prepare text for embedding (truncate, clean)
   */
  private prepareText(text: string): string {
    // Universal Sentence Encoder can handle up to ~512 tokens
    const maxLength = 2000; // Character limit (approximates token limit)
    let prepared = text.trim();

    if (prepared.length > maxLength) {
      prepared = prepared.substring(0, maxLength - 3) + '...';
    }

    // Remove excessive whitespace
    prepared = prepared.replace(/\s+/g, ' ');

    return prepared;
  }

  /**
   * Generate embeddings using OpenAI API
   */
  private async generateWithOpenAI(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const apiKey = process.env.OPENAI_API_KEY || this.config.openaiConfig?.apiKey;
    if (!apiKey) {
      throw new EmbeddingError('OpenAI API key not configured');
    }
    
    const model = this.config.openaiConfig?.model || 'text-embedding-3-small';
    const dimensions = this.config.openaiConfig?.dimensions || 512;
    
    const results: DocumentChunk[] = [];
    const batchSize = 100; // OpenAI allows up to 2048 inputs per request
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => this.prepareText(c.content));
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            input: texts,
            dimensions
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        
        // Map embeddings to chunks
        batch.forEach((chunk, idx) => {
          results.push({
            ...chunk,
            embedding: data.data[idx].embedding
          });
        });
        
        log.debug(`Processed OpenAI batch ${i / batchSize + 1}`, {
          batchSize: batch.length
        });
        
      } catch (error: any) {
        log.error('OpenAI embedding batch failed', error);
        throw new EmbeddingError(`OpenAI API request failed: ${error.message}`, error);
      }
    }
    
    return results;
  }

  /**
   * Generate embeddings using Cohere API
   */
  private async generateWithCohere(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const apiKey = process.env.COHERE_API_KEY || this.config.cohereConfig?.apiKey;
    if (!apiKey) {
      throw new EmbeddingError('Cohere API key not configured');
    }
    
    const model = this.config.cohereConfig?.model || 'embed-english-v3.0';
    const inputType = this.config.cohereConfig?.inputType || 'search_document';
    
    const results: DocumentChunk[] = [];
    const batchSize = 96; // Cohere allows up to 96 texts per request
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => this.prepareText(c.content));
      
      try {
        const response = await fetch('https://api.cohere.ai/v1/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            texts,
            input_type: inputType,
            embedding_types: ['float']
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Cohere API error: ${error.message || response.statusText}`);
        }
        
        const data = await response.json();
        
        // Map embeddings to chunks
        batch.forEach((chunk, idx) => {
          results.push({
            ...chunk,
            embedding: data.embeddings.float[idx]
          });
        });
        
        log.debug(`Processed Cohere batch ${i / batchSize + 1}`, {
          batchSize: batch.length
        });
        
      } catch (error: any) {
        log.error('Cohere embedding batch failed', error);
        throw new EmbeddingError(`Cohere API request failed: ${error.message}`, error);
      }
    }
    
    return results;
  }

  /**
   * Generate embeddings using MCP sampling (experimental)
   */
  private async generateWithMCPSampling(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (!mcpServerInstance) {
      throw new EmbeddingError('MCP server not available for sampling');
    }
    
    const results: DocumentChunk[] = [];
    
    // Process one at a time due to MCP sampling overhead
    for (const chunk of chunks) {
      try {
        const embedding = await this.generateSingleEmbeddingMCP(chunk.content);
        if (embedding && embedding.length > 0) {
          results.push({
            ...chunk,
            embedding
          });
        } else {
          log.error(`Generated empty MCP embedding for chunk ${chunk.id}, skipping`);
        }
      } catch (error: any) {
        log.error(`Failed to generate MCP embedding for chunk ${chunk.id}`, error);
        // Skip chunks that fail to embed rather than adding empty embeddings
      }
    }
    
    if (results.length === 0) {
      throw new EmbeddingError('All chunks failed to generate MCP embeddings');
    }
    
    return results;
  }

  /**
   * Generate single embedding via MCP sampling
   */
  private async generateSingleEmbeddingMCP(text: string): Promise<number[]> {
    if (!mcpServerInstance) {
      throw new EmbeddingError('MCP server not available');
    }
    
    const preparedText = this.prepareText(text);
    
    try {
      // Request embedding-like representation from LLM
      const response = await mcpServerInstance.request(
        {
          method: 'sampling/createMessage',
          params: {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Generate a 512-dimensional numerical embedding vector for the following text. Return ONLY a valid JSON array of exactly 512 floating-point numbers between -1 and 1, with no other text or explanation:\n\n${preparedText}`
              }
            }],
            systemPrompt: 'You are an embedding generator. Return only valid JSON arrays of numbers.',
            maxTokens: 2048,
            temperature: 0.3
          }
        },
        { timeout: 30000 } as any
      );
      
      // Parse response and extract embedding
      const embedding = this.parseEmbeddingFromMCPResponse(response);
      
      if (embedding.length !== 512) {
        throw new Error(`Expected 512 dimensions, got ${embedding.length}`);
      }
      
      return embedding;
      
    } catch (error: any) {
      log.error('MCP sampling embedding failed', error);
      throw new EmbeddingError(`MCP sampling failed: ${error.message}`, error);
    }
  }

  /**
   * Parse embedding vector from MCP response
   */
  private parseEmbeddingFromMCPResponse(response: any): number[] {
    try {
      // Extract text content from MCP response
      let text = '';
      if (response.content?.text) {
        text = response.content.text;
      } else if (Array.isArray(response.content)) {
        text = response.content.find((c: any) => c.type === 'text')?.text || '';
      }
      
      // Try to parse as JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.every((n: any) => typeof n === 'number')) {
          return parsed;
        }
      }
      
      throw new Error('Could not parse embedding from MCP response');
      
    } catch (error: any) {
      throw new EmbeddingError(`Failed to parse MCP embedding: ${error.message}`, error);
    }
  }

  /**
   * Create embedding for query text
   * @param query Search query
   * @returns Query embedding vector
   */
  async embedQuery(query: string): Promise<number[]> {
    // Select backend if not already selected
    if (!this.currentBackend) {
      await this.selectBackend();
    }

    // Route to appropriate backend
    switch (this.currentBackend) {
      case EmbeddingBackend.LOCAL_GPU:
      case EmbeddingBackend.LOCAL_CPU:
        await this.ensureModelLoaded();
        if (!EmbeddingService.model) {
          throw new EmbeddingError('Model not initialized');
        }
        return await this.generateSingleEmbedding(query);
        
      case EmbeddingBackend.OPENAI:
        return await this.embedQueryWithOpenAI(query);
        
      case EmbeddingBackend.COHERE:
        return await this.embedQueryWithCohere(query);
        
      case EmbeddingBackend.MCP_SAMPLING:
        return await this.generateSingleEmbeddingMCP(query);
        
      default:
        throw new EmbeddingError(`Unsupported backend: ${this.currentBackend}`);
    }
  }

  /**
   * Embed query using OpenAI API
   */
  private async embedQueryWithOpenAI(query: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY || this.config.openaiConfig?.apiKey;
    if (!apiKey) {
      throw new EmbeddingError('OpenAI API key not configured');
    }
    
    const model = this.config.openaiConfig?.model || 'text-embedding-3-small';
    const dimensions = this.config.openaiConfig?.dimensions || 512;
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: this.prepareText(query),
          dimensions
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
      
    } catch (error: any) {
      log.error('OpenAI query embedding failed', error);
      throw new EmbeddingError(`OpenAI API request failed: ${error.message}`, error);
    }
  }

  /**
   * Embed query using Cohere API
   */
  private async embedQueryWithCohere(query: string): Promise<number[]> {
    const apiKey = process.env.COHERE_API_KEY || this.config.cohereConfig?.apiKey;
    if (!apiKey) {
      throw new EmbeddingError('Cohere API key not configured');
    }
    
    const model = this.config.cohereConfig?.model || 'embed-english-v3.0';
    
    try {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          texts: [this.prepareText(query)],
          input_type: 'search_query',
          embedding_types: ['float']
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cohere API error: ${error.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.embeddings.float[0];
      
    } catch (error: any) {
      log.error('Cohere query embedding failed', error);
      throw new EmbeddingError(`Cohere API request failed: ${error.message}`, error);
    }
  }

  /**
   * Cosine similarity calculation
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity score
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector lengths must match: got ' + vec1.length + ' and ' + vec2.length);
    }

    if (vec1.length === 0) {
      return 0; // Handle empty embeddings
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Check if GPU is available (TensorFlow.js will use it automatically if available)
   * @returns GPU availability
   */
  static async isGPUAvailable(): Promise<boolean> {
    try {
      // Ensure TensorFlow is initialized
      await tfInitPromise;
      // tfjs-node provides actual GPU support, tfjs only provides CPU
      return tfBackend === 'tensorflow-node';
    } catch {
      return false;
    }
  }

  /**
   * Get information about available backends
   */
  async getBackendInfo(): Promise<EmbeddingBackendInfo[]> {
    const info: EmbeddingBackendInfo[] = [];
    
    // Local GPU
    info.push({
      backend: EmbeddingBackend.LOCAL_GPU,
      available: await this.isGPUAvailable(),
      dimensions: 512,
      reason: await this.isGPUAvailable() ? 'GPU available' : 'No GPU detected'
    });
    
    // OpenAI
    info.push({
      backend: EmbeddingBackend.OPENAI,
      available: this.isOpenAIConfigured(),
      dimensions: 512,
      cost: '$0.02 per 1M tokens',
      reason: this.isOpenAIConfigured() ? 'API key configured' : 'OPENAI_API_KEY not set'
    });
    
    // Cohere
    info.push({
      backend: EmbeddingBackend.COHERE,
      available: this.isCohereConfigured(),
      dimensions: 1024,
      cost: '$0.10 per 1M tokens',
      reason: this.isCohereConfigured() ? 'API key configured' : 'COHERE_API_KEY not set'
    });
    
    // MCP Sampling
    info.push({
      backend: EmbeddingBackend.MCP_SAMPLING,
      available: await this.isMCPSamplingAvailable(),
      dimensions: 512,
      reason: await this.isMCPSamplingAvailable() ? 'MCP server available' : 'MCP server not configured'
    });
    
    // Local CPU
    info.push({
      backend: EmbeddingBackend.LOCAL_CPU,
      available: true,
      dimensions: 512,
      reason: 'Always available (fallback)'
    });
    
    return info;
  }

  /**
   * Get current model info
   * @returns Model information
   */
  getModelInfo(): { model: string; dimensions: number; gpuEnabled: boolean; backend?: EmbeddingBackend } {
    return {
      model: 'universal-sentence-encoder',
      dimensions: 512,
      gpuEnabled: tfBackend === 'tensorflow-node',
      backend: this.currentBackend
    };
  }

  /**
   * Clean up TensorFlow resources
   */
  dispose(): void {
    log.debug('Disposing EmbeddingService resources');

    // Clean up TensorFlow resources (static model shared across instances)
    if (EmbeddingService.model) {
      // Universal Sentence Encoder cleanup
      EmbeddingService.model = undefined;
    }

    // Dispose of any remaining Tensors
    tf.disposeVariables();

    this.initialized = false;
    log.info('EmbeddingService disposed');
  }
}
