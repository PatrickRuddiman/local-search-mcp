#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from './core/SearchService.js';
import { BackgroundProcessor } from './core/BackgroundProcessor.js';
import { JobManager } from './core/JobManager.js';
import { logger, log } from './core/Logger.js';
import { initializeMcpDirectories, extractRepoName } from './core/PathUtils.js';

class LocalSearchServer {
  private server: Server;
  private searchService: SearchService;
  private backgroundProcessor: BackgroundProcessor;
  private jobManager: JobManager;

  constructor() {
    const timer = log.time('server-initialization');
    log.info('Starting Local Search MCP server initialization');

    // Initialize MCP directories
    initializeMcpDirectories().catch(error => {
      log.error('Failed to initialize MCP directories', error);
    });

    // Log environment info
    const stats = logger.getLogStats();
    log.info('Environment info', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)}MB`,
      cwd: process.cwd(),
      logFile: logger.getLogFile(),
      logStats: stats
    });

    // Initialize services
    try {
      this.searchService = new SearchService();
      this.backgroundProcessor = new BackgroundProcessor();
      this.jobManager = JobManager.getInstance();

      log.info('Core services initialized successfully');
    } catch (error: any) {
      log.error('Failed to initialize services', error);
      throw error;
    }

    // Create MCP server
    this.server = new Server(
      {
        name: 'local-search-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Setup error handling
    this.server.onerror = (error) => {
      log.error('MCP Server error', error);
      console.error('[MCP Error]', error);
    };

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      log.info('Received SIGINT, starting graceful shutdown');
      try {
        await this.server.close();
        this.searchService.dispose();
        log.info('Graceful shutdown completed');
      } catch (error: any) {
        log.error('Error during graceful shutdown', error);
      }
      process.exit(0);
    });

    timer();
    log.info('Local Search MCP server initialization completed');
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_documents',
          description: 'Perform AI-enhanced semantic search with content classification, domain detection, and intelligent recommendations.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Natural language search query' },
              options: {
                type: 'object',
                properties: {
                  limit: { type: 'number', default: 10, description: 'Maximum results to return' },
                  minScore: { type: 'number', default: 0.7, description: 'Minimum similarity score (0-1)' },
                  includeMetadata: { type: 'boolean', default: true, description: 'Include metadata in results' },
                  domainFilter: { type: 'array', items: { type: 'string' }, description: 'Filter by technology domains (e.g., ["javascript", "python"])' },
                  contentTypeFilter: { type: 'array', items: { type: 'string', enum: ['code', 'docs', 'config', 'mixed'] }, description: 'Filter by content type' },
                  languageFilter: { type: 'array', items: { type: 'string' }, description: 'Filter by programming language (e.g., ["typescript", "javascript"])' },
                  minQualityScore: { type: 'number', minimum: 0, maximum: 1, description: 'Minimum content quality score (0-1)' },
                  minAuthorityScore: { type: 'number', minimum: 0, maximum: 1, description: 'Minimum source authority score (0-1)' },
                },
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_file_details',
          description: 'Retrieve detailed content of a specific file with surrounding chunk context.',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to file' },
              chunkIndex: { type: 'number', description: 'Optional specific chunk to retrieve with surrounding context' },
              contextSize: { type: 'number', default: 3, description: 'Number of chunks to include before and after the target chunk (default 3)' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'remove_file',
          description: 'Delete a file and all its associated chunks and embeddings from the index.',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to file to remove' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'fetch_repo',
          description: 'Clone a Git repository (GitHub, Azure DevOps, etc.) using repomix, convert to markdown, and add to searchable index. Returns job ID for progress tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              repoUrl: { type: 'string', description: 'Git repository URL' },
              branch: { type: 'string', description: 'Optional branch/tag/commit, defaults to main/master' },
              options: {
                type: 'object',
                properties: {
                  includePatterns: { type: 'array', items: { type: 'string' }, default: ['**/*.md', '**/*.mdx', '**/*.txt', '**/*.json', '**/*.rst', '**/*.yml', '**/*.yaml'], description: 'File patterns to include' },
                  excludePatterns: { type: 'array', items: { type: 'string' }, default: ['**/node_modules/**'], description: 'File patterns to exclude' },
                  outputStyle: { type: 'string', enum: ['markdown'], default: 'markdown', description: 'Output format (fixed to markdown)' },
                  removeComments: { type: 'boolean', default: false, description: 'Remove comments from code files' },
                  showLineNumbers: { type: 'boolean', default: true, description: 'Show line numbers in output' },
                },
              },
            },
            required: ['repoUrl'],
          },
        },
        {
          name: 'fetch_file',
          description: 'Download a single file from a URL and add it to the searchable index. Returns job ID for progress tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL of file to download' },
              filename: { type: 'string', description: 'Desired filename for saving' },
              options: {
                type: 'object',
                properties: {
                  overwrite: { type: 'boolean', default: true, description: 'Whether to overwrite existing files' },
                  indexAfterSave: { type: 'boolean', default: true, description: 'Automatically index after download' },
                  maxFileSizeMB: { type: 'number', default: 1024, description: 'Maximum file size in MB' },
                },
              },
            },
            required: ['url', 'filename'],
          },
        },
        {
          name: 'get_job_status',
          description: 'Get status and progress of an async job by ID with real-time accurate progress.',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: { type: 'string', description: 'Job ID returned from fetch_* operations' },
            },
            required: ['jobId'],
          },
        },
        {
          name: 'list_active_jobs',
          description: 'List all currently active (running) jobs with their status and progress.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      log.debug(`[${requestId}] Tool call received: ${name}`, { args: Object.keys(args || {}) });

      try {
        const timer = log.time(`tool-${name}-${requestId}`);
        let result: any;

        switch (name) {
          case 'search_documents':
            result = await this.handleSearchDocuments(args, requestId);
            break;
          case 'get_file_details':
            result = await this.handleGetFileDetails(args, requestId);
            break;
          case 'remove_file':
            result = await this.handleRemoveFile(args, requestId);
            break;
          case 'fetch_repo':
            result = await this.handleFetchRepo(args, requestId);
            break;
          case 'fetch_file':
            result = await this.handleFetchFile(args, requestId);
            break;
          case 'get_job_status':
            result = await this.handleGetJobStatus(args, requestId);
            break;
          case 'list_active_jobs':
            result = await this.handleListActiveJobs(args, requestId);
            break;
          default:
            log.warn(`[${requestId}] Unknown tool requested: ${name}`);
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }

        timer();
        log.debug(`[${requestId}] Tool call completed successfully: ${name}`);
        return result;

      } catch (error: any) {
        log.error(`[${requestId}] Tool call failed: ${name}`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool error: ${error.message}`
        );
      }
    });
  }

  private formatSearchRecommendation(recommendation: any): string {
    const strategyDescriptions = {
      'term_removal': 'Removing low TF-IDF scoring terms',
      'term_refinement': 'Replacing terms with better alternatives', 
      'contextual_addition': 'Adding contextual terms for clarity'
    };

    const strategyDesc = strategyDescriptions[recommendation.suggestionStrategy as keyof typeof strategyDescriptions] || 'Optimizing search terms';
    const suggestedQuery = recommendation.suggestedTerms.join(' ');
    
    let recommendationText = `\n\n🤖 **AI Search Recommendation** (${strategyDesc}):\n` +
           `   💡 Try: "${suggestedQuery}"\n` +
           `   🎯 Confidence: ${(recommendation.confidence * 100).toFixed(1)}%\n` +
           `   📊 TF-IDF Threshold: ${recommendation.tfidfThreshold?.toFixed(3) || 'N/A'}\n` +
           `   🔬 Analysis: ${recommendation.analyzedDocuments} documents examined`;

    // Add strategy-specific details
    if (recommendation.suggestionStrategy === 'term_removal') {
      recommendationText += `\n   📉 Removed low-scoring terms that were reducing search precision`;
    } else if (recommendation.suggestionStrategy === 'term_refinement') {
      recommendationText += `\n   🔄 Replaced terms with higher TF-IDF scoring alternatives`;
    } else if (recommendation.suggestionStrategy === 'contextual_addition') {
      recommendationText += `\n   ➕ Added related terms found in high-scoring documents`;
    }

    return recommendationText;
  }

  private async handleSearchDocuments(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Executing enhanced search_documents for query: "${args.query}"`);
      const result = await this.searchService.searchDocumentsEnhanced(
        args.query,
        args.options || {}
      );

      // Check for active indexing jobs
      const activeJobs = this.jobManager.getActiveJobs();

      const summary = `Found ${result.totalResults} results for "${result.query}" in ${result.searchTime}ms`;

      let warningMessage = '';
      if (activeJobs.length > 0) {
        const jobDetails = activeJobs.map(job => `${job.type}: ${job.progress}%`).join(', ');
        warningMessage = `\n\nNote: Index is currently incomplete - ${activeJobs.length} active jobs running (${jobDetails}). Results may be incomplete. Poll job status for completion.`;
      }

      // Format recommendation if present
      let recommendationText = '';
      if (result.recommendation) {
        recommendationText = this.formatSearchRecommendation(result.recommendation);
      }

      if (result.totalResults === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `${summary}${warningMessage}${recommendationText}\n\nNo matching documents found.`,
            },
          ],
        };
      }

      const resultText = result.results
        .slice(0, 5)
        .map((chunk, index) => {
          let resultLine = `${index + 1}. ${chunk.filePath}:${chunk.chunkIndex} (Score: ${chunk.score?.toFixed(3)})`;
          
          // Add AI metadata if available
          if (chunk.contentMetadata) {
            const meta = chunk.contentMetadata;
            const metadataInfo = [
              `Type: ${meta.contentType}`,
              meta.language !== 'unknown' ? `Lang: ${meta.language}` : null,
              meta.domainTags?.length > 0 ? `Domains: [${meta.domainTags.slice(0, 2).join(', ')}]` : null,
              `Quality: ${meta.qualityScore.toFixed(2)}`,
              `Authority: ${meta.sourceAuthority.toFixed(2)}`
            ].filter(Boolean).join(' | ');
            
            resultLine += `\n   📊 ${metadataInfo}`;
          }
          
          resultLine += `\n   ${chunk.content.substring(0, 180)}...`;
          return resultLine;
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `${summary}${warningMessage}${recommendationText}\n\nTop Results:\n${resultText}`,
          },
          {
            type: 'text',
            text: JSON.stringify(result.results.slice(0, 10), null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error.message}`
      );
    }
  }

  private async handleGetFileDetails(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Retrieving file details for: ${args.filePath}`);
      const chunks = await this.searchService.getFileDetails(
        args.filePath,
        args.chunkIndex,
        args.contextSize || 3
      );

      if (chunks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No indexed content found for file: ${args.filePath}`,
            },
          ],
        };
      }

      const summary = `Found ${chunks.length} chunks for ${args.filePath}`;
      const chunkText = chunks
        .map((chunk, index) =>
          `Chunk ${chunk.chunkIndex} (${chunk.metadata.tokenCount} tokens):\n${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? '...' : ''}`
        )
        .join('\n\n' + '='.repeat(50) + '\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `${summary}\n\n${chunkText}`,
          },
          {
            type: 'text',
            text: JSON.stringify(chunks, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get file details: ${error.message}`
      );
    }
  }

  private async handleRemoveFile(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Removing file from index: ${args.filePath}`);

      // Use VectorIndex directly for instant file deletion
      const { VectorIndex } = await import('./core/VectorIndex.js');
      const { DatabaseSchema } = await import('./core/DatabaseSchema.js');
      const schema = new DatabaseSchema();
      const vectorIndex = new VectorIndex(schema);
      const deletedCount = await vectorIndex.deleteFile(args.filePath);
      vectorIndex.close();

      const message = deletedCount > 0
        ? `Removed ${deletedCount} chunks for file: ${args.filePath}`
        : `No chunks found for file: ${args.filePath}`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: JSON.stringify({ deletedChunks: deletedCount, filePath: args.filePath }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to remove file: ${error.message}`
      );
    }
  }

  private async handleFetchRepo(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Starting async repository fetch: ${args.repoUrl}`);

      const jobId = this.jobManager.createJob('fetch_repo', {
        repoUrl: args.repoUrl,
        branch: args.branch || 'default',
        options: args.options || {}
      });

      // Start background processing (fire and forget) - move to next tick to avoid blocking
      setTimeout(() => {
        this.backgroundProcessor.processRepoFetch(
          jobId,
          args.repoUrl,
          args.branch,
          args.options || {}
        ).catch(error => {
          this.jobManager.failJob(jobId, error.message);
        });
      }, 0);

      const repoName = extractRepoName(args.repoUrl);
      const message = `Started async repository fetch: ${repoName}\nJob ID: ${jobId}\nUse get_job_status to poll for completion.`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: JSON.stringify({ jobId, repoName }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to start repository fetch: ${error.message}`
      );
    }
  }

  private async handleFetchFile(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Starting async file download: ${args.url}`);

      const jobId = this.jobManager.createJob('fetch_file', {
        url: args.url,
        filename: args.filename,
        options: args.options || {}
      });

      // Start background processing (fire and forget) - move to next tick to avoid blocking
      setTimeout(() => {
        this.backgroundProcessor.processFileFetch(
          jobId,
          args.url,
          args.filename,
          args.options || {}
        ).catch(error => {
          this.jobManager.failJob(jobId, error.message);
        });
      }, 0);

      const message = `Started async file download: ${args.filename}\nJob ID: ${jobId}\nUse get_job_status to poll for completion.`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: JSON.stringify({ jobId, filename: args.filename }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to start file download: ${error.message}`
      );
    }
  }

  private async handleGetJobStatus(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Getting job status (NON-BLOCKING): ${args.jobId}`);

      // Use async method with setImmediate to prevent blocking (2025 best practice)
      return await new Promise((resolve) => {
        setImmediate(() => {
          try {
            const job = this.jobManager.getJob(args.jobId);

            if (!job) {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `Job not found: ${args.jobId}`,
                  },
                ],
              });
              return;
            }

            const duration = job.endTime
              ? job.endTime.getTime() - job.startTime.getTime()
              : Date.now() - job.startTime.getTime();

            const message = `Job Status: ${job.id}\n` +
              `Type: ${job.type}\n` +
              `Status: ${job.status}\n` +
              `Progress: ${job.progress}%\n` +
              `Duration: ${(duration / 1000).toFixed(1)}s\n` +
              (job.error ? `Error: ${job.error}\n` : '') +
              (job.status === 'completed' ? 'Job completed successfully!' : '');

            resolve({
              content: [
                {
                  type: 'text',
                  text: message,
                },
                {
                  type: 'text',
                  text: JSON.stringify(job, null, 2),
                },
              ],
            });
          } catch (error: any) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Error getting job status: ${error.message}`,
                },
              ],
            });
          }
        });
      });
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get job status: ${error.message}`
      );
    }
  }

  private async handleListActiveJobs(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Listing active jobs (NON-BLOCKING)`);

      // Use async method with setImmediate to prevent blocking (2025 best practice)
      return await new Promise((resolve) => {
        setImmediate(() => {
          try {
            const activeJobs = this.jobManager.getActiveJobs();
            const stats = this.jobManager.getStatistics();

            if (activeJobs.length === 0) {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `No active jobs running.\n\nTotal jobs: ${stats.total}\nCompleted: ${stats.completed}\nFailed: ${stats.failed}`,
                  },
                ],
              });
              return;
            }

            const jobSummary = activeJobs
              .map(job => {
                const duration = Date.now() - job.startTime.getTime();
                return `${job.id}: ${job.type} (${job.progress}%, ${(duration / 1000).toFixed(1)}s)`;
              })
              .join('\n');

            const message = `Active Jobs (${activeJobs.length}):\n${jobSummary}\n\n` +
              `Statistics:\n` +
              `Total: ${stats.total}\n` +
              `Running: ${stats.running}\n` +
              `Completed: ${stats.completed}\n` +
              `Failed: ${stats.failed}\n` +
              `Avg Duration: ${(stats.averageDuration / 1000).toFixed(1)}s`;

            resolve({
              content: [
                {
                  type: 'text',
                  text: message,
                },
                {
                  type: 'text',
                  text: JSON.stringify(activeJobs, null, 2),
                },
              ],
            });
          } catch (error: any) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Error listing active jobs: ${error.message}`,
                },
              ],
            });
          }
        });
      });
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list active jobs: ${error.message}`
      );
    }
  }

  async run() {
    log.debug('Connecting MCP server to transport');
    try {
      const timer = log.time('server-transport-connect');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      timer();

      log.info('Local Search MCP server running on stdio', {
        availableTools: ['search_documents', 'get_file_details', 'remove_file', 'fetch_repo', 'fetch_file']
      });

      console.error('Local Search MCP server running on stdio');
    } catch (error: any) {
      log.error('Failed to start MCP server', error);
      console.error('Failed to start MCP server:', error.message);
      throw error;
    }
  }
}

const server = new LocalSearchServer();
server.run().catch(console.error);
