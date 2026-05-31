/**
 * Unified agent metadata service
 * Consolidates data sources and provides single source of truth
 */

import { CHAINS } from './chains';
import { resolveBinding, type Erc8048Binding } from './erc8048';
import { getTokenUri, getOwnerOf } from './rpc';
import { 
  validateAgentMetadata, 
  validateErc8004Card, 
  validateOnChainData,
  validateWorkerResponse,
  ValidationResult 
} from './validation';
import { cache, generateCacheKey } from './cache';
import { monitoring } from './monitoring';

interface AgentMetadata {
  name: string;
  description: string;
  image?: string;
  skills?: string[];
  services?: string[];
  links?: {
    a2aCard?: string;
    agentCard?: string;
    profile?: string;
  };
  x402Support?: boolean;
  mcpServers?: Array<{
    name: string;
    endpoint: string;
    capabilities: string[];
  }>;
}

interface Erc8004Card {
  agentId: number;
  chain: string;
  registry: string;
  agentURI: string | null;
  owner: string | null;
  name: string | null;
  description: string | null;
  image: string | null;
  services: string[] | null;
  skills: string[] | null;
  a2aEndpoint: string | null;
  x402Support: boolean | null;
  explorerUrl: string;
  binding: Erc8048Binding | null;
  pairedAgent: {
    name: string;
    chain: string;
    agentId: number;
  } | null;
}

interface PairedAgent {
  name: string;
  chain: string;
  agentId: number;
  safeAddress?: string;
}

class AgentService {
  private readonly WORKER_URL = 'https://nftmail-email-worker.richard-159.workers.dev';
  private readonly NORMIES_API = 'https://api.normies.art/agents/metadata';

  /**
   * Get ERC-8004 agent card with enhanced data fetching
   */
  async getErc8004Card(chainKey: string, agentId: number): Promise<Erc8004Card | null> {
    return monitoring.measure(
      'getErc8004Card',
      async () => {
        const cacheKey = generateCacheKey('erc8004_card', { chain: chainKey, agentId });
        const cached = cache.get<Erc8004Card>(cacheKey);
        if (cached) return cached;

        try {
          const chain = CHAINS[chainKey];
          if (!chain) {
            throw new Error(`Unknown chain: ${chainKey}`);
          }

          // Batch fetch owner and tokenURI
          const [owner, tokenUri] = await Promise.all([
            getOwnerOf(chainKey, chain.registry, agentId).catch(() => null),
            getTokenUri(chainKey, chain.registry, agentId).catch(() => null)
          ]);

          if (!owner || !tokenUri) {
            return null;
          }

      // Fetch metadata, normies data, and paired agent in parallel (all independent)
      const [metadataResult, normiesResult, pairedAgentResult] = await Promise.allSettled([
        fetch(tokenUri, { signal: AbortSignal.timeout(5000) })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data) return null;
            const v = validateAgentMetadata(data);
            return v.isValid ? v.data : null;
          })
          .catch(() => null),
        (chainKey === 'ethereum' || chainKey === 'base')
          ? fetch(`${this.NORMIES_API}/${agentId}`, { signal: AbortSignal.timeout(3000) })
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null),
        this.getPairedAgent(owner, chainKey, agentId),
      ]);

      const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : null;
      const normiesData = normiesResult.status === 'fulfilled' ? normiesResult.value : null;
      const pairedAgent = pairedAgentResult.status === 'fulfilled' ? pairedAgentResult.value : null;

      // Check for ERC-8048 agent-binding (depends on metadata, but fast if absent)
      const binding = await resolveBinding(chainKey, agentId, (metadata as any)?.['agent-binding'] ?? undefined);

      // Build card with enhanced data
      const card: Erc8004Card = {
        agentId,
        chain: chainKey,
        registry: chain.registry,
        agentURI: tokenUri,
        owner,
        name: metadata?.name || normiesData?.name || null,
        description: metadata?.description || normiesData?.description || null,
        image: metadata?.image || normiesData?.image || null,
        services: metadata?.services || normiesData?.services || null,
        skills: metadata?.skills || normiesData?.skills || null,
        a2aEndpoint: metadata?.links?.a2aCard || normiesData?.a2a_endpoint || null,
        x402Support: metadata?.x402Support ?? normiesData?.x402_support ?? null,
        explorerUrl: `${chain.explorer}/address/${chain.registry}`,
        binding,
        pairedAgent
      };

      // Validate the card
      const validation = validateErc8004Card(card);
      if (!validation.isValid) {
        console.warn(`Invalid ERC-8004 card for agent ${agentId}:`, validation.errors);
        return null;
      }

      cache.set(cacheKey, card, 60000); // Cache for 1 minute
          return card;

        } catch (error) {
          monitoring.logError(error as Error, 'getErc8004Card', 'medium', { chainKey, agentId });
          return null;
        }
      },
      { chainKey, agentId }
    );
  }

  /**
   * Get paired ecosystem agent for an ERC-8004 token
   * Only pairs if the agent's ERC-8004 registration matches exactly
   */
  private async getPairedAgent(
    owner: string, 
    chainKey: string, 
    agentId: number
  ): Promise<PairedAgent | null> {
    try {
      const response = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'listAgents', 
          safeAddress: owner 
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const validation = validateWorkerResponse(data);
      if (!validation.isValid) {
        return null;
      }

      // Look for exact match of chain and agentId
      for (const agent of validation.data!.agents || []) {
        if (agent.erc8004 && agent.erc8004[chainKey]) {
          const registration = agent.erc8004[chainKey];
          if (registration.agentId === agentId) {
            return {
              name: agent.name,
              chain: chainKey,
              agentId: registration.agentId,
              safeAddress: owner
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.warn(`Failed to get paired agent for ${owner}:`, error);
      return null;
    }
  }

  /**
   * Get comprehensive agent profile from all sources
   */
  async getAgentProfile(agentId: number, chainKey: string): Promise<{
    erc8004Card: Erc8004Card | null;
    workerProfile: any | null;
    onChainData: any | null;
  }> {
    const cacheKey = generateCacheKey('agent_profile', { agentId, chainKey });
    const cached = cache.get<{
      erc8004Card: Erc8004Card | null;
      workerProfile: any | null;
      onChainData: any | null;
    }>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch all data sources in parallel
      const [erc8004Card, workerProfile, onChainData] = await Promise.allSettled([
        this.getErc8004Card(chainKey, agentId),
        this.getWorkerProfile(agentId),
        this.getOnChainData(agentId, chainKey)
      ]);

      const result = {
        erc8004Card: erc8004Card.status === 'fulfilled' ? erc8004Card.value : null,
        workerProfile: workerProfile.status === 'fulfilled' ? workerProfile.value : null,
        onChainData: onChainData.status === 'fulfilled' ? onChainData.value : null
      };

      cache.set(cacheKey, result, 30000); // Cache for 30 seconds
      return result;

    } catch (error) {
      console.error(`Failed to get agent profile for ${agentId}:`, error);
      return {
        erc8004Card: null,
        workerProfile: null,
        onChainData: null
      };
    }
  }

  /**
   * Get worker profile for an agent
   */
  private async getWorkerProfile(agentId: number): Promise<any | null> {
    try {
      const response = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'getAgentProfile',
          agentId: agentId.toString()
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`Failed to get worker profile for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get on-chain data for an agent
   */
  private async getOnChainData(agentId: number, chainKey: string): Promise<any | null> {
    try {
      const chain = CHAINS[chainKey];
      if (!chain) return null;

      // This would typically include balance checks, transaction history, etc.
      // For now, return basic structure
      return {
        chain: chainKey,
        chainId: chain.chainId,
        agentId,
        balances: [],
        transactions: 0,
        lastActivity: null
      };
    } catch (error) {
      console.warn(`Failed to get on-chain data for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Search agents by name or partial match
   */
  async searchAgents(query: string, chainKey?: string): Promise<Array<{
    name: string;
    agentId: number;
    chain: string;
    description?: string;
    image?: string;
  }>> {
    const cacheKey = generateCacheKey('agent_search', { query, chain: chainKey || 'all' });
    const cached = cache.get<Array<{
      name: string;
      agentId: number;
      chain: string;
      description?: string;
      image?: string;
    }>>(cacheKey);
    if (cached) return cached;

    try {
      // This would integrate with a proper search index
      // For now, return empty results
      const results: Array<{
        name: string;
        agentId: number;
        chain: string;
        description?: string;
        image?: string;
      }> = [];

      cache.set(cacheKey, results, 60000); // Cache for 1 minute
      return results;
    } catch (error) {
      console.error(`Failed to search agents for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get service statistics for monitoring
   */
  getStats(): {
    cacheStats: any;
    timestamp: number;
  } {
    return {
      cacheStats: cache.getStats(),
      timestamp: Date.now()
    };
  }
}

// Singleton instance
export const agentService = new AgentService();
