/**
 * Libraries.io API client for fetching package data
 * API documentation: https://libraries.io/api
 */

import { config } from '../../config/domain-generation.config.js';

export interface LibrariesIoPackage {
  name: string;
  platform: string;
  description: string | null;
  homepage: string | null;
  repository_url: string | null;
  normalized_licenses: string[];
  rank: number;
  latest_release_published_at: string | null;
  latest_stable_release_number: string | null;
  language: string | null;
  status: string | null;
  package_manager_url: string;
  stars: number;
  forks: number;
  keywords: string[];
  latest_download_url: string | null;
  dependents_count: number;
  dependent_repos_count: number;
  versions: any[];
}

export interface SearchParams {
  platform: string;
  sort?: 'rank' | 'stars' | 'dependents_count' | 'dependent_repos_count' | 'latest_release_published_at' | 'created_at' | 'contributions_count';
  per_page?: number;
  page?: number;
}

export class LibrariesIoClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.librariesIo.apiKey;
    this.baseUrl = config.librariesIo.baseUrl;
    this.timeout = config.librariesIo.timeout;

    if (!this.apiKey) {
      console.warn('⚠️  No Libraries.io API key provided. Rate limits will be very strict.');
    }
  }

  /**
   * Search for packages on a specific platform
   */
  async searchPackages(params: SearchParams): Promise<LibrariesIoPackage[]> {
    const maxRetries = config.librariesIo.retries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._searchPackagesInternal(params);
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`   Retry ${attempt}/${maxRetries - 1} after ${delay}ms...`);
          await LibrariesIoClient.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to search packages');
  }

  /**
   * Internal search implementation (without retry logic)
   */
  private async _searchPackagesInternal(params: SearchParams): Promise<LibrariesIoPackage[]> {
    const { platform, sort = 'dependents_count', per_page = 100, page = 1 } = params;

    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('platforms', platform);
    url.searchParams.set('sort', sort);
    url.searchParams.set('per_page', per_page.toString());
    url.searchParams.set('page', page.toString());
    
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'local-search-mcp/1.0',
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please provide a valid API key or wait before retrying.');
      }
      throw new Error(`Libraries.io API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as LibrariesIoPackage[];
  }

  /**
   * Get detailed information about a specific package
   */
  async getPackage(platform: string, packageName: string): Promise<LibrariesIoPackage> {
    const encodedName = encodeURIComponent(packageName);
    const url = new URL(`${this.baseUrl}/${platform}/${encodedName}`);
    
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'local-search-mcp/1.0',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Libraries.io API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get package dependencies
   */
  async getPackageDependencies(platform: string, packageName: string, version?: string): Promise<any> {
    const encodedName = encodeURIComponent(packageName);
    const versionPath = version ? `/${version}` : '/latest';
    const url = new URL(`${this.baseUrl}/${platform}/${encodedName}${versionPath}/dependencies`);
    
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'local-search-mcp/1.0',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Libraries.io API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
