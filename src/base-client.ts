import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DomeSDKConfig, RequestConfig, ApiError } from './types.js';

/**
 * Get the SDK version from package.json
 * Tries multiple strategies to find the version reliably
 * Works in both ESM and CommonJS environments
 */
function getSDKVersion(): string {
  // Strategy 1: Use npm_package_version if available (set by npm/yarn)
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  // Strategy 2: Try to read package.json from various locations
  try {
    let currentDir: string;

    // Detect module system and get current directory accordingly
    try {
      // ESM environment - use import.meta.url
      // Use eval to avoid Jest parsing issues with import.meta
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const importMeta =
        typeof eval !== 'undefined'
          ? eval('typeof import !== "undefined" ? import.meta : undefined')
          : undefined;
      // @ts-ignore - import.meta may not exist in CJS builds, but will in ESM
      if (importMeta && importMeta.url) {
        // @ts-ignore - import.meta.url exists in ESM builds
        const __filename = fileURLToPath(importMeta.url);
        currentDir = dirname(__filename);
      } else {
        throw new Error('Not ESM');
      }
    } catch {
      // CommonJS environment - use process.cwd as fallback
      currentDir = process.cwd();
    }

    // Try common locations for package.json
    const possiblePaths = [
      // Built package location (dist/base-client.js -> ../../package.json)
      join(currentDir, '..', '..', 'package.json'),
      // Development location (src/base-client.ts -> ../../package.json)
      join(currentDir, '..', '..', 'package.json'),
      // Alternative: from node_modules if installed
      join(currentDir, '..', '..', '..', 'package.json'),
      // From project root
      join(process.cwd(), 'package.json'),
    ];

    for (const packageJsonPath of possiblePaths) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.version) {
          return packageJson.version;
        }
      } catch {
        // Continue to next path
        continue;
      }
    }
  } catch (error) {
    // Fall through to default
  }

  // Fallback: return a default version
  return '0.0.0';
}

/**
 * Base client class that provides common HTTP functionality
 * for all Dome API endpoints
 */
export abstract class BaseClient {
  protected readonly apiKey: string;
  protected readonly baseURL: string;
  private readonly sdkVersion: string;

  constructor(config: DomeSDKConfig) {
    if (!config.apiKey) {
      throw new Error('DOME_API_KEY is required');
    }
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.domeapi.io/v1';
    this.sdkVersion = getSDKVersion();
  }

  /**
   * Makes a generic HTTP request with authentication
   */
  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestConfig
  ): Promise<T> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'x-dome-sdk': `node/v${this.sdkVersion}`,
          ...options?.headers,
        },
        timeout: options?.timeout || 30000,
      };

      if (params) {
        if (method === 'GET') {
          // Ensure arrays are serialized as repeated query params (explode: true format)
          requestConfig.paramsSerializer = p => {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(p)) {
              if (Array.isArray(value)) {
                value.forEach(item => searchParams.append(key, String(item)));
              } else if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
              }
            }
            return searchParams.toString();
          };
          requestConfig.params = params;
        } else {
          requestConfig.data = params;
        }
      }

      const response: AxiosResponse<T> = await axios.request(requestConfig);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      if (axiosError.response?.data) {
        throw new Error(
          `API Error: ${axiosError.response.data.error} - ${axiosError.response.data.message}`
        );
      }
      throw new Error(`Request failed: ${axiosError.message}`);
    }
  }
}
