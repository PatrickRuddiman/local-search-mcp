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
          description: 'Perform semantic search across the indexed documents. Fast database lookup operation.',
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
                  maxFiles: { type: 'number', default: 1000, description: 'Maximum files to process' },
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
              docFolder: { type: 'string', default: './docs/fetched', description: 'Folder to save file' },
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

  private async handleSearchDocuments(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Executing search_documents for query: "${args.query}"`);
      const result = await this.searchService.searchDocuments(
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

      if (result.totalResults === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `${summary}${warningMessage}\n\nNo matching documents found.`,
            },
          ],
        };
      }

      const resultText = result.results
        .slice(0, 5)
        .map((chunk, index) =>
          `${index + 1}. ${chunk.filePath}:${chunk.chunkIndex} (Score: ${chunk.score?.toFixed(3)})\n   ${chunk.content.substring(0, 200)}...`
        )
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `${summary}${warningMessage}\n\nTop Results:\n${resultText}`,
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
      const vectorIndex = new (await import('./core/VectorIndex.js')).VectorIndex();
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
        docFolder: args.docFolder,
        options: args.options || {}
      });

      // Start background processing (fire and forget) - move to next tick to avoid blocking
      setTimeout(() => {
        this.backgroundProcessor.processFileFetch(
          jobId,
          args.url,
          args.filename,
          args.docFolder,
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
