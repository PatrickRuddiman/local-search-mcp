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
import { RepoService } from './core/RepoService.js';
import { FileDownloadService } from './core/FileDownloadService.js';
import { FileWatcher } from './core/FileWatcher.js';
import { logger, log } from './core/Logger.js';
import { initializeMcpDirectories } from './core/PathUtils.js';
import {
  IndexOptions,
  SearchOptions,
  FileDetailsOptions
} from './types/index.js';

class LocalSearchServer {
  private server: Server;
  private searchService: SearchService;
  private repoService: RepoService;
  private fileDownloadService: FileDownloadService;
  private fileWatcher: FileWatcher;

  constructor() {
    const timer = log.time('server-constructor-total');
    log.info('Starting Local Search MCP server initialization');

    // Initialize MCP directories first to fix permission issues
    log.debug('Initializing MCP directory structure');
    initializeMcpDirectories().catch(error => {
      log.error('Failed to initialize MCP directories', error);
      // Don't throw - try to continue with default behavior
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

    log.debug('Initializing service orchestration');

    // Initialize the search service
    const searchTimer = log.time('search-service-init');
    log.debug('Creating SearchService instance');
    try {
      this.searchService = new SearchService();
      log.debug('SearchService initialized successfully');
    } catch (error: any) {
      log.error('Failed to initialize SearchService', error);
      throw error;
    }
    searchTimer();

    // Initialize file watcher for automatic indexing
    const watcherTimer = log.time('file-watcher-init');
    log.debug('Creating FileWatcher instance');
    try {
      this.fileWatcher = new FileWatcher(this.searchService);
      log.debug('FileWatcher initialized successfully');
    } catch (error: any) {
      log.error('Failed to initialize FileWatcher', error);
      throw error;
    }
    watcherTimer();

    // Initialize repository and file services with watcher
    const servicesTimer = log.time('services-init');
    log.debug('Initializing RepoService and FileDownloadService');
    try {
      this.repoService = new RepoService(this.searchService, this.fileWatcher);
      this.fileDownloadService = new FileDownloadService(this.searchService, this.fileWatcher);
      log.debug('Repository and file services initialized successfully');
    } catch (error: any) {
      log.error('Failed to initialize service orchestration', error);
      throw error;
    }
    servicesTimer();

    // Create MCP server
    const serverTimer = log.time('mcp-server-init');
    log.debug('Creating MCP Server instance');
    try {
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
      log.debug('MCP Server instance created successfully');
    } catch (error: any) {
      log.error('Failed to create MCP Server', error);
      throw error;
    }
    serverTimer();

    // Setup tool handlers
    const toolsTimer = log.time('tool-handlers-init');
    log.debug('Setting up MCP tool handlers');
    try {
      this.setupToolHandlers();
      log.debug('MCP tool handlers set up successfully');
    } catch (error: any) {
      log.error('Failed to setup tool handlers', error);
      throw error;
    }
    toolsTimer();

    // Initialize file watcher (async)
    log.debug('Starting file watcher initialization (deferred)');
    this.initializeFileWatcher().catch(error => {
      log.error('File watcher initialization failed', error);
    });

    // Setup error handling
    log.debug('Setting up error handlers');
    this.server.onerror = (error) => {
      log.error('MCP Server error', error);
      console.error('[MCP Error]', error);
    };

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      log.info('Received SIGINT, starting graceful shutdown');
      const shutdownTimer = log.time('graceful-shutdown');

      try {
        await this.stopFileWatcher();
        await this.server.close();
        this.searchService.dispose();
        log.info('Graceful shutdown completed');
      } catch (error: any) {
        log.error('Error during graceful shutdown', error);
      }

      shutdownTimer();
      process.exit(0);
    });

    timer();
    log.info('Local Search MCP Server initialization completed');
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_documents',
          description: 'Perform semantic search across the indexed documents. Computes embeddings for the query, calculates cosine similarity with stored chunks, and returns the most relevant results.',
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
          description: 'Retrieve detailed content of a specific file with chunk context. Provides detailed view of indexed files, useful for AI agent context retrieval.',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to file' },
              chunkIndex: { type: 'number', description: 'Optional specific chunk to retrieve' },
              contextLines: { type: 'number', default: 3, description: 'Lines of context around chunk' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'fetch_repo',
          description: 'Clone a GitHub repository using repomix, convert to markdown, and add to searchable index. Uses repomix to clone and convert the repository, limiting to documentation-focused file types.',
          inputSchema: {
            type: 'object',
            properties: {
              repoUrl: { type: 'string', description: 'GitHub repository URL' },
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
          description: 'Download a single file from a URL and add it to the searchable index after saving to the docs folder. Downloads a single file from supported text-based URLs and automatically indexes it.',
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
                  maxFileSizeMB: { type: 'number', default: 10, description: 'Maximum file size in MB' },
                },
              },
            },
            required: ['url', 'filename'],
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
        let result;

        switch (name) {
          case 'search_documents':
            result = await this.handleSearchDocuments(args, requestId);
            break;
          case 'get_file_details':
            result = await this.handleGetFileDetails(args, requestId);
            break;
          case 'fetch_repo':
            result = await this.handleFetchRepo(args, requestId);
            break;
          case 'fetch_file':
            result = await this.handleFetchFile(args, requestId);
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
        log.error(`[${requestId}] Tool call failed: ${name}`, error, { toolName: name, args });
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
      log.debug(`[${requestId}] Search completed`, {
        query: args.query,
        resultsFound: result.totalResults,
        searchTime: result.searchTime
      });

      const summary = `Found ${result.totalResults} results for "${result.query}" in ${result.searchTime}ms`;

      if (result.totalResults === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `${summary}\n\nNo matching documents found.`,
            },
          ],
        };
      }

      const resultText = result.results
        .slice(0, 5) // Limit to top 5 for response size
        .map((chunk, index) =>
          `${index + 1}. ${chunk.filePath}:${chunk.chunkIndex} (Score: ${chunk.score?.toFixed(3)})\n   ${chunk.content.substring(0, 200)}...`
        )
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `${summary}\n\nTop Results:\n${resultText}`,
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
        args.contextLines || 3
      );
      log.debug(`[${requestId}] Retrieved ${chunks.length} chunks for ${args.filePath}`);

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

  private async handleFetchRepo(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Fetching repository: ${args.repoUrl}`, {
        branch: args.branch,
        options: args.options
      });
      const result = await this.repoService.fetchRepository(
        args.repoUrl,
        args.branch,
        args.options || {}
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      log.info(`[${requestId}] Repository fetched successfully: ${result.repoName}`, {
        filesProcessed: result.filesProcessed,
        outputDir: result.outputDir
      });

      const message = `Successfully processed repository: ${result.repoName}\n` +
                      `Files processed: ${result.filesProcessed}\n` +
                      `Output directory: ${result.outputDir}`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: JSON.stringify(result.stats, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Repository fetch failed: ${error.message}`
      );
    }
  }

  private async handleFetchFile(args: any, requestId: string) {
    try {
      log.debug(`[${requestId}] Downloading file: ${args.url}`, {
        filename: args.filename,
        docFolder: args.docFolder
      });
      const result = await this.fileDownloadService.downloadFile(
        args.url,
        args.filename,
        args.docFolder, // Let the service use its own default
        args.options || {}
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const size = result.size;
      log.info(`[${requestId}] File downloaded successfully: ${result.filePath}`, {
        sizeKb: (size / 1024).toFixed(1)
      });

      const message = `Successfully downloaded file: ${result.filePath}\n` +
                      `Size: ${(size / 1024).toFixed(1)}KB`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: JSON.stringify(result.indexResult, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `File download failed: ${error.message}`
      );
    }
  }



  /**
   * Initialize file watcher
   */
  private async initializeFileWatcher(): Promise<void> {
    log.debug('Initializing file watcher (deferred)');
    try {
      const timer = log.time('file-watcher-start');
      await this.fileWatcher.startWatching();
      log.info('File watcher started for automatic indexing');
      timer();
    } catch (error: any) {
      log.error('Failed to start file watcher', error);
      log.warn('File watcher disabled - manual indexing will still work');
      // Don't throw - file watcher is not critical for basic functionality
    }
  }

  /**
   * Stop file watcher
   */
  private async stopFileWatcher(): Promise<void> {
    log.debug('Stopping file watcher');
    try {
      await this.fileWatcher.stopWatching();
      log.info('File watcher stopped');
    } catch (error: any) {
      log.error('Error stopping file watcher', error);
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
        availableTools: ['search_documents', 'get_file_details', 'fetch_repo', 'fetch_file']
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
