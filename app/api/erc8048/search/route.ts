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
      // Search by key/value - requires indexer, not implemented yet
      return NextResponse.json<SearchResponse>({
        success: false,
        error: 'Key/value search requires indexer support - not yet implemented',
      });
    }

    if (mode === 'byBinding') {
      // Search by binding contract/tokenId - requires indexer, not implemented yet
      return NextResponse.json<SearchResponse>({
        success: false,
        error: 'Binding search requires indexer support - not yet implemented',
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
