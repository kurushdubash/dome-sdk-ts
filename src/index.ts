import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { DomeSDKConfig } from './types';

/**
 * Main Dome SDK Client
 *
 * Provides a comprehensive TypeScript SDK for interacting with Dome services.
 * Features include user management, event handling, and API communication.
 *
 * @example
 * ```typescript
 * import { DomeClient } from '@dome/sdk';
 *
 * const dome = new DomeClient({
 *   apiKey: 'your-api-key'
 * });
 *
 * const user = await dome.healthCheck();
 * ```
 */
export class DomeClient {
  private readonly apiKey: string;

  /**
   * Creates a new instance of the Dome SDK
   *
   * @param config - Configuration options for the SDK
   */
  constructor(config: DomeSDKConfig = {}) {
    this.apiKey = config.apiKey || '';
  }

  /**
   * Makes a generic HTTP request
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    try {
      const requestConfig: any = {
        method,
        url: endpoint,
        data,
      };

      if (options?.headers) {
        requestConfig.headers = options.headers;
      }

      if (options?.timeout) {
        requestConfig.timeout = options.timeout;
      }

      const response: AxiosResponse<AxiosResponse<T>> =
        await axios.request(requestConfig);

      return response.data;
    } catch (error) {
      throw error as AxiosError;
    }
  }

  /**
   * Performs a health check on the Dome API
   *
   * @returns Promise resolving to health status
   */
  async healthCheck(): Promise<
    AxiosResponse<{ status: string; timestamp: string }>
  > {
    return this.makeRequest('GET', '/health');
  }
}

// Re-export types for convenience
export * from './types';

// Default export
export default DomeClient;
