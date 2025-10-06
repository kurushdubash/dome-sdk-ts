import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { DomeSDKConfig, RequestConfig, ApiError } from './types';

/**
 * Base client class that provides common HTTP functionality
 * for all Dome API endpoints
 */
export abstract class BaseClient {
  protected readonly apiKey: string;
  protected readonly baseURL: string;

  constructor(config: DomeSDKConfig) {
    if (!config.apiKey) {
      throw new Error('DOME_API_KEY is required');
    }
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.domeapi.io/v1';
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
          ...options?.headers,
        },
        timeout: options?.timeout || 30000,
      };

      if (params) {
        if (method === 'GET') {
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
