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
import { createPublicClient, http, keccak256, toBytes, type Address } from 'viem';
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
 * Project-neutral dictionary of ERC-8048 keys to probe.
 * Because `MetadataSet(tokenId, string indexed key, bytes value)` indexes the
 * key as a hash, the plaintext key cannot be recovered from logs alone — so we
 * match log key-hashes against this candidate set. Add any project's keys here
 * and they surface automatically across every token, with no project coupling.
 */
const ERC8048_CANDIDATE_KEYS: string[] = [
  // Story Protocol / Confidential Data Rails (Sovereign IP)
  'story[ip_id]', 'story[license_id]', 'cdr[vault_id]',
  // Agent endpoints / skills
  'endpoint[a2a]', 'endpoint[mcp]', 'skills/primary', 'skills/tools', 'agent-binding',
  // Common metadata conventions
  'name', 'description', 'image', 'avatar', 'url', 'version', 'schema', 'license', 'royalty',
];

/** True when decoded bytes are entirely printable UTF-8 (no control/NUL bytes). */
function looksPrintable(hex: string): boolean {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!raw) return false;
  const bytes = raw.match(/.{1,2}/g)!.map(b => parseInt(b, 16));
  return bytes.every(b => b >= 0x20 && b <= 0x7e);
}

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

interface AuditEntry {
  key: string;
  valueHex: string;
  valueText: string | null;
  verified: boolean;
  setAtBlock: number | null;
  setAt: number | null;
  operator: string | null;
  txHash: string | null;
}

/**
 * Neutral on-chain audit of every recognised ERC-8048 key set on a tokenId.
 * Sweeps MetadataSet logs (filtered by tokenId) for provenance, then reads the
 * current value of each matched key for verification. No project assumptions.
 */
async function auditTokenMetadata(tokenId: number): Promise<AuditEntry[]> {
  // Map each candidate key to its indexed-string topic hash.
  const keyByHash = new Map<string, string>();
  for (const key of ERC8048_CANDIDATE_KEYS) {
    keyByHash.set(keccak256(toBytes(key)).toLowerCase(), key);
  }

  // Latest MetadataSet log per key (provenance: block + tx).
  const provenance = new Map<string, { blockNumber: bigint; txHash: string }>();
  try {
    const logs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: METADATA_SET_ABI[0],
      args: { tokenId: BigInt(tokenId) },
      fromBlock: 45000000n,
      toBlock: 'latest',
    });
    for (const log of logs) {
      const keyHash = String(log.args.key).toLowerCase();
      const key = keyByHash.get(keyHash);
      if (!key) continue;
      const prev = provenance.get(key);
      if (!prev || log.blockNumber > prev.blockNumber) {
        provenance.set(key, { blockNumber: log.blockNumber, txHash: log.transactionHash });
      }
    }
  } catch {
    // Logs unavailable — fall back to value-only verification below.
  }

  // Resolve unique block timestamps + tx senders for matched keys.
  const blockTs = new Map<string, number>();
  const txFrom = new Map<string, string>();
  await Promise.all(
    Array.from(provenance.values()).map(async ({ blockNumber, txHash }) => {
      try {
        if (!blockTs.has(blockNumber.toString())) {
          const block = await client.getBlock({ blockNumber });
          blockTs.set(blockNumber.toString(), Number(block.timestamp));
        }
      } catch { /* non-fatal */ }
      try {
        if (!txFrom.has(txHash)) {
          const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
          txFrom.set(txHash, tx.from);
        }
      } catch { /* non-fatal */ }
    })
  );

  // Read the current value of every candidate key for verification.
  const entries = await Promise.all(
    ERC8048_CANDIDATE_KEYS.map(async (key): Promise<AuditEntry | null> => {
      let valueHex = '0x';
      try {
        valueHex = (await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'metadata',
          args: [BigInt(tokenId), key],
        })) as string;
      } catch { /* missing key */ }

      const prov = provenance.get(key);
      const verified = !!valueHex && valueHex !== '0x';
      if (!verified && !prov) return null;

      return {
        key,
        valueHex: valueHex || '0x',
        valueText: verified && looksPrintable(valueHex) ? decodeStringValue(valueHex) : null,
        verified,
        setAtBlock: prov ? Number(prov.blockNumber) : null,
        setAt: prov ? (blockTs.get(prov.blockNumber.toString()) ?? null) : null,
        operator: prov ? (txFrom.get(prov.txHash) ?? null) : null,
        txHash: prov?.txHash ?? null,
      };
    })
  );

  return entries.filter((e): e is AuditEntry => e !== null);
}

interface SearchRequest {
  mode: 'byAgentId' | 'byBinding' | 'byKey' | 'auditTokenId';
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
  audit?: {
    tokenId: number;
    registry: string;
    chain: string;
    explorer: string;
    entries: AuditEntry[];
  };
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchRequest;
    const { mode } = body;

    if (mode === 'auditTokenId' && (body.tokenId != null || body.agentId != null)) {
      // Neutral registry sweep: audit every recognised ERC-8048 key on a token.
      const tokenId = Number(body.tokenId ?? body.agentId);
      const entries = await auditTokenMetadata(tokenId);
      return NextResponse.json<SearchResponse>({
        success: true,
        audit: {
          tokenId,
          registry: REGISTRY_ADDRESS,
          chain: 'gnosis',
          explorer: 'https://gnosisscan.io',
          entries,
        },
      });
    }

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
