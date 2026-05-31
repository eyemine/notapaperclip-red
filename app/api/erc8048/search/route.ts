/**
 * POST /api/erc8048/search
 * 
 * Search ERC-8048 metadata on GhostAgentMetadataRegistry.
 * 
 * Query modes:
 * - byAgentId: Fetch all metadata keys for a specific agentId (ERC-8004 tokenId)
 * - byBinding: Search for agents with specific agent-binding entries (Normie agent references)
 * - byKey: Search for agents with a specific metadata key/value pair
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { gnosis } from 'viem/chains';

const REGISTRY_ADDRESS = '0x0106341056a8790f4b924c380ed5B81B2a062bCE' as Address;

const REGISTRY_ABI = [
  {
    name: 'metadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
] as const;

const client = createPublicClient({
  chain: gnosis,
  transport: http(),
});

/**
 * Decode hex bytes to UTF-8 string
 */
function decodeStringValue(hex: string): string {
  try {
    const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (!raw) return '';
    const arr = new Uint8Array(raw.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    return new TextDecoder().decode(arr);
  } catch { return ''; }
}

/**
 * Fetch all known metadata keys for an agentId
 */
async function fetchAgentMetadata(agentId: number): Promise<Record<string, string>> {
  const knownKeys = [
    'endpoint[a2a]',
    'endpoint[mcp]',
    'skills/primary',
    'skills/tools',
    'agent-binding',
  ];

  const metadata: Record<string, string> = {};

  await Promise.all(
    knownKeys.map(async (key) => {
      try {
        const value = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'metadata',
          args: [BigInt(agentId), key],
        });
        if (value && value !== '0x') {
          metadata[key] = decodeStringValue(value as string);
        }
      } catch {
        // Skip missing keys
      }
    })
  );

  return metadata;
}

const METADATA_SET_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'string', name: 'key', type: 'string' },
      { indexed: false, internalType: 'bytes', name: 'value', type: 'bytes' },
    ],
    name: 'MetadataSet',
    type: 'event',
  },
] as const;

/**
 * Search for agents with a specific metadata key/value pair using getLogs
 */
async function searchByKeyValue(key: string, value: string): Promise<Array<{ agentId: number; metadata: Record<string, string> }>> {
  try {
    const logs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: METADATA_SET_ABI[0],
      fromBlock: 45000000n, // Approximate deployment block
      toBlock: 'latest',
    });

    const results: Array<{ agentId: number; metadata: Record<string, string> }> = [];

    for (const log of logs) {
      if (log.args.key === key) {
        const decodedValue = decodeStringValue(log.args.value as string);
        if (decodedValue === value) {
          // Fetch all metadata for this agent
          const metadata = await fetchAgentMetadata(Number(log.args.tokenId));
          results.push({ agentId: Number(log.args.tokenId), metadata });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Search for agents with agent-binding entries pointing to a specific contract/tokenId
 */
async function searchByBinding(bindingContract: string, tokenId: string): Promise<Array<{ agentId: number; metadata: Record<string, string> }>> {
  try {
    const logs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: METADATA_SET_ABI[0],
      fromBlock: 45000000n,
      toBlock: 'latest',
    });

    const results: Array<{ agentId: number; metadata: Record<string, string> }> = [];

    for (const log of logs) {
      if (log.args.key === 'agent-binding') {
        const bindingValue = decodeStringValue(log.args.value as string);
        // Check if binding matches the contract/tokenId
        if (bindingValue.includes(bindingContract.toLowerCase()) && bindingValue.includes(tokenId)) {
          const metadata = await fetchAgentMetadata(Number(log.args.tokenId));
          results.push({ agentId: Number(log.args.tokenId), metadata });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

interface SearchRequest {
  mode: 'byAgentId' | 'byBinding' | 'byKey';
  agentId?: number;
  bindingContract?: string;
  tokenId?: string;
  key?: string;
  value?: string;
}

interface SearchResponse {
  success: boolean;
  results?: Array<{
    agentId: number;
    metadata: Record<string, string>;
  }>;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchRequest;
    const { mode } = body;

    if (mode === 'byAgentId' && body.agentId) {
      // Fetch metadata for a specific agentId
      const metadata = await fetchAgentMetadata(body.agentId);
      return NextResponse.json<SearchResponse>({
        success: true,
        results: [{ agentId: body.agentId, metadata }],
      });
    }

    if (mode === 'byKey' && body.key && body.value) {
      // Search by key/value using direct RPC
      const results = await searchByKeyValue(body.key, body.value);
      return NextResponse.json<SearchResponse>({
        success: true,
        results,
      });
    }

    if (mode === 'byBinding' && body.bindingContract && body.tokenId) {
      // Search by binding contract/tokenId using direct RPC
      const results = await searchByBinding(body.bindingContract, body.tokenId);
      return NextResponse.json<SearchResponse>({
        success: true,
        results,
      });
    }

    return NextResponse.json<SearchResponse>({
      success: false,
      error: 'Invalid search mode or missing parameters',
    });
  } catch (err) {
    return NextResponse.json<SearchResponse>({
      success: false,
      error: String(err),
    });
  }
}
