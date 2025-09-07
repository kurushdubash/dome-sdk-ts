import { DomeClient } from '../index';

// Mock axios to avoid actual HTTP calls in tests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    request: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: { common: {} },
    },
  })),
}));

describe('DomeClient', () => {
  let sdk: DomeClient;

  beforeEach(() => {
    sdk = new DomeClient();
  });

  describe('constructor', () => {
    it('should noop', () => {});
  });
});
