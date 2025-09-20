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
    // Initialize the search service
    this.searchService = new SearchService();

    // Initialize file watcher for automatic indexing
    this.fileWatcher = new FileWatcher(this.searchService);

    // Initialize repository and file services with watcher
    this.repoService = new RepoService(this.searchService, this.fileWatcher);
    this.fileDownloadService = new FileDownloadService(this.searchService, this.fileWatcher);

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

    // Start file watcher
    this.initializeFileWatcher();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.stopFileWatcher();
      await this.server.close();
      this.searchService.dispose();
      process.exit(0);
    });
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
                  includePatterns: { type: 'array', items: { type: 'string' }, default: ['*.md', '*.txt', '*.json', '*.rst'], description: 'File patterns to include' },
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

      try {
        switch (name) {
          case 'search_documents':
            return await this.handleSearchDocuments(args);
          case 'get_file_details':
            return await this.handleGetFileDetails(args);
          case 'fetch_repo':
            return await this.handleFetchRepo(args);
          case 'fetch_file':
            return await this.handleFetchFile(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool error: ${error.message}`
        );
      }
    });
  }



  private async handleSearchDocuments(args: any) {
    try {
      const result = await this.searchService.searchDocuments(
        args.query,
        args.options || {}
      );

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

  private async handleGetFileDetails(args: any) {
    try {
      const chunks = await this.searchService.getFileDetails(
        args.filePath,
        args.chunkIndex,
        args.contextLines || 3
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

  private async handleFetchRepo(args: any) {
    try {
      const result = await this.repoService.fetchRepository(
        args.repoUrl,
        args.branch,
        args.options || {}
      );

      if (!result.success) {
        throw new Error(result.error);
      }

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

  private async handleFetchFile(args: any) {
    try {
      const result = await this.fileDownloadService.downloadFile(
        args.url,
        args.filename,
        args.docFolder || './docs/fetched',
        args.options || {}
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const message = `Successfully downloaded file: ${result.filePath}\n` +
                      `Size: ${(result.size / 1024).toFixed(1)}KB`;

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
    try {
      await this.fileWatcher.startWatching();
      console.log('File watcher started for automatic indexing');
    } catch (error: any) {
      console.error('Failed to start file watcher:', error.message);
      // Don't throw - file watcher is not critical for basic functionality
    }
  }

  /**
   * Stop file watcher
   */
  private async stopFileWatcher(): Promise<void> {
    try {
      await this.fileWatcher.stopWatching();
      console.log('File watcher stopped');
    } catch (error: any) {
      console.error('Error stopping file watcher:', error.message);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local Search MCP server running on stdio');
  }
}

const server = new LocalSearchServer();
server.run().catch(console.error);
