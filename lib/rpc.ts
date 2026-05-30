/**
 * Enhanced RPC client with fallback endpoints and circuit breaker
 * Improves reliability and handles failures gracefully
 */

import { CHAINS, getChainByKey } from './chains';
import { cache, generateCacheKey } from './cache';

interface RpcCallOptions {
  timeout?: number;
  retries?: number;
  useCache?: boolean;
  cacheTtl?: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  };

  private readonly threshold = 5; // Open after 5 failures
  private readonly timeout = 60000; // Try again after 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.isOpen) {
      if (Date.now() < this.state.nextAttemptTime) {
        throw new Error('Circuit breaker is open');
      }
      // Try to close the circuit
      this.state.isOpen = false;
      this.state.failureCount = 0;
    }

    try {
      const result = await fn();
      // Reset on success
      this.state.failureCount = 0;
      this.state.isOpen = false;
      return result;
    } catch (error) {
      this.state.failureCount++;
      this.state.lastFailureTime = Date.now();

      if (this.state.failureCount >= this.threshold) {
        this.state.isOpen = true;
        this.state.nextAttemptTime = Date.now() + this.timeout;
      }

      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

class RpcClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  private getCircuitBreaker(endpoint: string): CircuitBreaker {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, new CircuitBreaker());
    }
    return this.circuitBreakers.get(endpoint)!;
  }

  async call(
    chainKey: string,
    to: string,
    data: string,
    options: RpcCallOptions = {}
  ): Promise<any> {
    const {
      timeout = 10000,
      retries = 2,
      useCache = true,
      cacheTtl = 30000
    } = options;

    const chain = getChainByKey(chainKey);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainKey}`);
    }

    // Check cache first
    if (useCache) {
      const cacheKey = generateCacheKey('rpc', { chain: chainKey, to, data });
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const errors: Error[] = [];

    // Try each RPC endpoint
    for (const rpcUrl of chain.rpc) {
      const circuitBreaker = this.getCircuitBreaker(rpcUrl);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await circuitBreaker.execute(async () => {
            const response = await fetch(rpcUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [
                  {
                    to,
                    data,
                  },
                  'latest'
                ],
                id: 1,
              }),
              signal: AbortSignal.timeout(timeout),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            if (json.error) {
              throw new Error(`RPC Error: ${json.error.message}`);
            }

            return json.result;
          });

          // Cache successful result
          if (useCache) {
            const cacheKey = generateCacheKey('rpc', { chain: chainKey, to, data });
            cache.set(cacheKey, result, cacheTtl);
          }

          return result;
        } catch (error) {
          errors.push(error as Error);
          
          // If this is the last attempt or last endpoint, throw the last error
          if (attempt === retries) {
            break;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    // All endpoints failed
    const errorSummary = errors.map(e => e.message).join('; ');
    throw new Error(`All RPC endpoints failed for ${chainKey}: ${errorSummary}`);
  }

  async batchCall(
    chainKey: string,
    calls: Array<{ to: string; data: string }>,
    options: RpcCallOptions = {}
  ): Promise<any[]> {
    const {
      timeout = 15000,
      retries = 2,
      useCache = true,
      cacheTtl = 30000
    } = options;

    const chain = getChainByKey(chainKey);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainKey}`);
    }

    // Check cache for all calls
    if (useCache) {
      const cacheKey = generateCacheKey('rpc_batch', { chain: chainKey, calls });
      const cached = cache.get<any[]>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const errors: Error[] = [];

    // Try each RPC endpoint
    for (const rpcUrl of chain.rpc) {
      const circuitBreaker = this.getCircuitBreaker(rpcUrl);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await circuitBreaker.execute(async () => {
            const response = await fetch(rpcUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_multicall',
                params: [
                  calls.map(call => ({
                    to: call.to,
                    data: call.data,
                  })),
                  'latest'
                ],
                id: 1,
              }),
              signal: AbortSignal.timeout(timeout),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            if (json.error) {
              throw new Error(`RPC Error: ${json.error.message}`);
            }

            return json.result;
          });

          // Cache successful result
          if (useCache) {
            const cacheKey = generateCacheKey('rpc_batch', { chain: chainKey, calls });
            cache.set(cacheKey, result, cacheTtl);
          }

          return result;
        } catch (error) {
          errors.push(error as Error);
          
          // If multicall is not supported, fallback to individual calls
          if ((error as Error).message.includes('method not supported') && attempt === 0) {
            return Promise.all(calls.map(call => this.call(chainKey, call.to, call.data, options)));
          }

          if (attempt === retries) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    // All endpoints failed
    const errorSummary = errors.map(e => e.message).join('; ');
    throw new Error(`All RPC endpoints failed for ${chainKey}: ${errorSummary}`);
  }

  // Get circuit breaker states for monitoring
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    this.circuitBreakers.forEach((breaker, endpoint) => {
      states[endpoint] = breaker.getState();
    });
    return states;
  }
}

// Singleton instance
export const rpcClient = new RpcClient();

// Helper functions for common calls
export async function getTokenUri(chainKey: string, contract: string, tokenId: number): Promise<string> {
  const tokenIdHex = tokenId.toString(16).padStart(64, '0');
  const data = `0xc87b56dd${tokenIdHex}`;
  const result = await rpcClient.call(chainKey, contract, data);
  
  if (!result || result === '0x') {
    throw new Error('Token URI not found');
  }

  // Decode hex string
  const str = result.startsWith('0x') ? result.slice(2) : result;
  if (str.length < 128) throw new Error('Invalid token URI encoding');
  const length = parseInt(str.slice(64, 128), 16);
  const encoded = str.slice(128, 128 + length * 2);
  if (!encoded) throw new Error('Invalid token URI encoding');
  return Buffer.from(encoded, 'hex').toString('utf8');
}

export async function getOwnerOf(chainKey: string, contract: string, tokenId: number): Promise<string> {
  const tokenIdHex = tokenId.toString(16).padStart(64, '0');
  const data = `0x6352211e${tokenIdHex}`;
  const result = await rpcClient.call(chainKey, contract, data);
  
  if (!result || result === '0x') {
    throw new Error('Owner not found');
  }

  const hex = result.startsWith('0x') ? result.slice(2) : result;
  if (hex.length < 64) throw new Error('Owner not found');
  return '0x' + hex.slice(24, 64);
}
