import { DomeClient } from '../index.js';
import axios from 'axios';

// Mock axios to avoid actual HTTP calls in tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DomeClient', () => {
  let sdk: DomeClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    sdk = new DomeClient({ apiKey: mockApiKey });
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      expect(sdk).toBeInstanceOf(DomeClient);
    });

    it('should throw error if API key is missing', () => {
      expect(() => new DomeClient({ apiKey: '' })).toThrow(
        'DOME_API_KEY is required'
      );
    });

    it('should use default base URL', () => {
      const client = new DomeClient({ apiKey: mockApiKey });
      expect(client).toBeInstanceOf(DomeClient);
    });

    it('should use custom base URL', () => {
      const customBaseURL = 'https://custom.api.com/v1';
      const client = new DomeClient({
        apiKey: mockApiKey,
        baseURL: customBaseURL,
      });
      expect(client).toBeInstanceOf(DomeClient);
    });
  });

  describe('getMarketPrice', () => {
    it('should fetch market price successfully', async () => {
      const mockResponse = {
        data: {
          price: 0.215,
          at_time: 1757008834,
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.polymarket.markets.getMarketPrice({
        token_id: '1234567890',
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/polymarket/market-price/1234567890',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {},
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch market price with historical timestamp', async () => {
      const mockResponse = {
        data: {
          price: 0.215,
          at_time: 1740000000,
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.polymarket.markets.getMarketPrice({
        token_id: '1234567890',
        at_time: 1740000000,
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/polymarket/market-price/1234567890',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: { at_time: 1740000000 },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getCandlesticks', () => {
    it('should fetch candlestick data successfully', async () => {
      const mockResponse = {
        data: {
          candlesticks: [
            [
              [
                {
                  end_period_ts: 1727827200,
                  open_interest: 8456498,
                  price: {
                    open: 0,
                    high: 0,
                    low: 0,
                    close: 0,
                    open_dollars: '0.0049',
                    high_dollars: '0.0049',
                    low_dollars: '0.0048',
                    close_dollars: '0.0048',
                    mean: 0,
                    mean_dollars: '0.0049',
                    previous: 0,
                    previous_dollars: '0.0049',
                  },
                  volume: 8456498,
                  yes_ask: {
                    open: 0.00489,
                    close: 0.0048200000000000005,
                    high: 0.00491,
                    low: 0.0048,
                    open_dollars: '0.0049',
                    close_dollars: '0.0048',
                    high_dollars: '0.0049',
                    low_dollars: '0.0048',
                  },
                  yes_bid: {
                    open: 0.00489,
                    close: 0.004829999990880811,
                    high: 0.004910000000138527,
                    low: 0.0048,
                    open_dollars: '0.0049',
                    close_dollars: '0.0048',
                    high_dollars: '0.0049',
                    low_dollars: '0.0048',
                  },
                },
              ],
              {
                token_id:
                  '21742633143463906290569050155826241533067272736897614950488156847949938836455',
              },
            ],
          ],
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.polymarket.markets.getCandlesticks({
        condition_id:
          '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
        start_time: 1640995200,
        end_time: 1672531200,
        interval: 60,
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/polymarket/candlesticks/0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {
            start_time: 1640995200,
            end_time: 1672531200,
            interval: 60,
          },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getWalletPnL', () => {
    it('should fetch wallet PnL successfully', async () => {
      const mockResponse = {
        data: {
          granularity: 'day',
          start_time: 1726857600,
          end_time: 1758316829,
          wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
          pnl_over_time: [
            {
              timestamp: 1726857600,
              pnl_to_date: 2001,
            },
          ],
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.polymarket.wallet.getWalletPnL({
        wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
        granularity: 'day',
        start_time: 1726857600,
        end_time: 1758316829,
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/polymarket/wallet/pnl/0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {
            granularity: 'day',
            start_time: 1726857600,
            end_time: 1758316829,
          },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getOrders', () => {
    it('should fetch orders successfully', async () => {
      const mockResponse = {
        data: {
          orders: [
            {
              token_id:
                '58519484510520807142687824915233722607092670035910114837910294451210534222702',
              side: 'BUY',
              market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
              condition_id:
                '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
              shares: 4995000,
              shares_normalized: 4.995,
              price: 0.65,
              tx_hash:
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
              title:
                'Will Bitcoin be above $50,000 on July 25, 2025 at 8:00 PM ET?',
              timestamp: 1757008834,
              order_hash:
                '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
            },
          ],
          pagination: {
            limit: 50,
            offset: 0,
            total: 1250,
            has_more: true,
          },
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.polymarket.orders.getOrders({
        market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
        limit: 50,
        offset: 0,
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/polymarket/orders',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {
            market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
            limit: 50,
            offset: 0,
          },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMatchingMarkets', () => {
    it('should fetch matching markets successfully', async () => {
      const mockResponse = {
        data: {
          markets: {
            'nfl-ari-den-2025-08-16': [
              {
                platform: 'KALSHI',
                event_ticker: 'KXNFLGAME-25AUG16ARIDEN',
                market_tickers: [
                  'KXNFLGAME-25AUG16ARIDEN-ARI',
                  'KXNFLGAME-25AUG16ARIDEN-DEN',
                ],
              },
              {
                platform: 'POLYMARKET',
                market_slug: 'nfl-ari-den-2025-08-16',
                token_ids: [
                  '34541522652444763571858406546623861155130750437169507355470933750634189084033',
                  '104612081187206848956763018128517335758189185749897027211060738913329108425255',
                ],
              },
            ],
          },
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.matchingMarkets.getMatchingMarkets({
        polymarket_market_slug: ['nfl-ari-den-2025-08-16'],
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/matching-markets/sports/',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {
            polymarket_market_slug: ['nfl-ari-den-2025-08-16'],
          },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMatchingMarketsBySport', () => {
    it('should fetch matching markets by sport successfully', async () => {
      const mockResponse = {
        data: {
          markets: {
            'nfl-ari-den-2025-08-16': [
              {
                platform: 'KALSHI',
                event_ticker: 'KXNFLGAME-25AUG16ARIDEN',
                market_tickers: [
                  'KXNFLGAME-25AUG16ARIDEN-ARI',
                  'KXNFLGAME-25AUG16ARIDEN-DEN',
                ],
              },
            ],
          },
          sport: 'nfl',
          date: '2025-08-16',
        },
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await sdk.matchingMarkets.getMatchingMarketsBySport({
        sport: 'nfl',
        date: '2025-08-16',
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.domeapi.io/v1/matching-markets/sports/nfl/',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          params: {
            date: '2025-08-16',
          },
          paramsSerializer: expect.any(Function),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('error handling', () => {
    it('should handle API errors properly', async () => {
      const mockError = {
        response: {
          data: {
            error: 'BAD_REQUEST',
            message: 'Invalid parameters',
          },
        },
        message: 'Request failed with status code 400',
      };

      mockedAxios.request.mockRejectedValueOnce(mockError);

      await expect(
        sdk.polymarket.markets.getMarketPrice({ token_id: 'invalid' })
      ).rejects.toThrow('API Error: BAD_REQUEST - Invalid parameters');
    });

    it('should handle network errors properly', async () => {
      const mockError = {
        message: 'Network Error',
      };

      mockedAxios.request.mockRejectedValueOnce(mockError);

      await expect(
        sdk.polymarket.markets.getMarketPrice({ token_id: '123' })
      ).rejects.toThrow('Request failed: Network Error');
    });
  });
});
