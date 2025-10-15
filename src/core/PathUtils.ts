import path from 'path';
import fs from 'fs';

/**
 * Utility functions for handling MCP folder paths with environment variable support
 * and platform-specific defaults
 *
 * Note: This module is intentionally logging-free to avoid circular dependencies
 */

/**
 * Get the data folder path (for database, logs, and other persistent data)
 * Uses MCP_DATA_FOLDER environment variable or platform-specific default
 */
export function getDataFolder(): string {
  const envDataFolder = process.env.MCP_DATA_FOLDER;

  if (envDataFolder) {
    return envDataFolder;
  }

  return getDefaultDataFolder();
}

/**
 * Get the docs folder path (for document storage, repositories, fetched files)
 * Uses MCP_DOCS_FOLDER environment variable or platform-specific default
 */
export function getDocsFolder(): string {
  const envDocsFolder = process.env.MCP_DOCS_FOLDER;

  if (envDocsFolder) {
    return envDocsFolder;
  }

  return getDefaultDocsFolder();
}

/**
 * Get platform-specific default data folder
 * - Linux: ~/.local/share/local-search-mcp
 * - macOS: ~/Library/Application Support/local-search-mcp
 * - Windows: %LOCALAPPDATA%/local-search-mcp
 */
function getDefaultDataFolder(): string {
  const platform = process.platform;
  const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'local-search-mcp');

    case 'win32': // Windows
      const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      return path.join(localAppData, 'local-search-mcp');

    default: // Linux and others
      return path.join(homeDir, '.local', 'share', 'local-search-mcp');
  }
}

/**
 * Get platform-specific default docs folder
 * Uses same base as data folder but with 'docs' subfolder
 */
function getDefaultDocsFolder(): string {
  return path.join(getDefaultDataFolder(), 'docs');
}

/**
 * Get common MCP paths for use throughout the application
 */
export function getMcpPaths() {
  const dataFolder = getDataFolder();
  const docsFolder = getDocsFolder();

  return {
    data: dataFolder,
    docs: docsFolder,
    repositories: path.join(docsFolder, 'repositories'),
    fetched: path.join(docsFolder, 'fetched'),
    watched: path.join(docsFolder, 'watched'),
    temp: path.join(docsFolder, 'temp'),
    database: path.join(dataFolder, 'local-search-index.db'),
    logs: path.join(dataFolder, 'local-search-mcp.log')
  };
}

/**
 * Extract repository name from URL (supports Azure DevOps and GitHub)
 * Used for generating directory names and logging
 */
export function extractRepoName(repoUrl: string): string {
  try {
    const url = repoUrl.replace(/\.git$/, '');
    // Check for Azure DevOps URLs
    if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) {
      // Example: https://dev.azure.com/org/project/_git/repo
      const parts = url.split('/').filter(p => p); // remove empty parts
      const gitIndex = parts.findIndex(p => p === '_git');
      if (gitIndex > 0 && parts.length > gitIndex + 1) {
        const repo = parts[gitIndex + 1];
        const project = parts[gitIndex - 1];
        const org = parts[gitIndex - 2];
        if (org && project && repo) {
          return `${org}_${project}_${repo}`;
        }
      }
    }
    // Fallback to existing logic (GitHub style)
    const parts = url.split('/');
    if (parts.length >= 2) {
      const owner = parts[parts.length - 2];
      const repo = parts[parts.length - 1];
      return `${owner}_${repo}`;
    }

  throw new Error('Invalid repo URL format: ' + repoUrl);
  } catch (error) {
    // Generate a default name from the URL
    const cleanUrl = repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
    return cleanUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) || `unknown_repo_${Date.now()}`;
  }
}

/**
 * Ensure a directory exists, creating it recursively if needed
 * @param dirPath Directory path to create
 * @param description Description for debugging (not used in this logging-free version)
 */
export async function ensureDirectoryExists(dirPath: string, description?: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });

    // Verify the directory was created and is accessible
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path exists but is not a directory: ${dirPath}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Initialize all required MCP directories
 */
export async function initializeMcpDirectories(): Promise<void> {
  try {
    const dataFolder = getDataFolder();
    const docsFolder = getDocsFolder();

    // Create base directories
    await ensureDirectoryExists(dataFolder, 'Data folder (database, logs)');
    await ensureDirectoryExists(docsFolder, 'Docs folder (documents)');

    // Create docs subdirectories
    const repositoriesFolder = path.join(docsFolder, 'repositories');
    const fetchedFolder = path.join(docsFolder, 'fetched');
    const watchedFolder = path.join(docsFolder, 'watched');
    const tempFolder = path.join(docsFolder, 'temp');

    await ensureDirectoryExists(repositoriesFolder, 'Repositories folder');
    await ensureDirectoryExists(fetchedFolder, 'Fetched files folder');
    await ensureDirectoryExists(watchedFolder, 'Watched files folder');
    await ensureDirectoryExists(tempFolder, 'Temp folder for clones');

  } catch (error: any) {
    throw error;
  }
}
