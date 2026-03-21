/**
 * Agent email resolution logic.
 * Format: [name]_@nftmail.box  (underscore suffix = agent account)
 *
 * Resolution chain:
 *   email → Safe address (NFTmail KV)
 *         → agentId (ERC-8004 on-chain ownerOf)
 *         → alignment score (KV)
 */

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

// ERC-8004 registry contracts
export const ERC8004_CONTRACTS = {
  gnosis: {
    address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpcs:    ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com'],
    chain:   'Gnosis',
    chainId: 100,
  },
  basesepolia: {
    address: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    rpcs:    ['https://base-sepolia-rpc.publicnode.com', 'https://sepolia.base.org'],
    chain:   'Base Sepolia',
    chainId: 84532,
  },
  basemainnet: {
    address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpcs:    ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
    chain:   'Base',
    chainId: 8453,
  },
} as const;

export type ResolutionStatus = 'ok' | 'not_found' | 'invalid_format' | 'error';

export interface AgentResolution {
  status:       ResolutionStatus;
  email?:       string;
  label?:       string;
  safeAddress?: string;
  agentId?:     number;
  network?:     string;
  chainId?:     number;
  // Per-chain ERC-8004 registrations
  erc8004Gnosis?:      Erc8004Match | null;
  erc8004Base?:        { agentId: number; chainId: number } | Erc8004Match | null;
  erc8004BaseSepolia?: { agentId: number; chainId: number } | Erc8004Match | null;
  alignmentScore?: number | null;
  alignmentLevel?: 'green' | 'amber' | 'red' | null;
  badges?:      string[];
  error?:       string;
  resolvedAt:   number;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateAgentEmail(email: string): { valid: boolean; label?: string; error?: string } {
  const trimmed = email.trim().toLowerCase();
  // Must match [name]_@nftmail.box
  const match = trimmed.match(/^([a-z0-9][a-z0-9._-]*)_@nftmail\.box$/);
  if (!match) {
    if (trimmed.endsWith('@nftmail.box') && !trimmed.includes('_@')) {
      return { valid: false, error: 'Not an agent email — agent emails require underscore suffix: [name]_@nftmail.box' };
    }
    return { valid: false, error: 'Invalid format — agent emails must be [name]_@nftmail.box' };
  }
  return { valid: true, label: match[1] };
}

// ── KV helpers ───────────────────────────────────────────────────────────────

async function kvGet(key: string): Promise<unknown> {
  try {
    const res  = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'kvGet', key }),
      signal:  AbortSignal.timeout(6000),
    });
    const data = await res.json() as { value?: string };
    return data?.value ? JSON.parse(data.value) : null;
  } catch {
    return null;
  }
}

// ── Step 1: worker resolveAddress → Safe + onChainOwner ─────────────────────

export interface GhostAgentLookupResult {
  exists: boolean;
  onChainOwner: string | null;
  safe: string | null;
  mintedTokenId: number | null;
  originNft: string | null;
  accountTier: string;
  tld: string | null;
  // multi-chain ERC-8004 (returned by worker resolveAddress)
  erc8004AgentId?: number | null;
  erc8004ChainId?: number | null;
  erc8004Base?:        { agentId: number; chainId: number } | null;
  erc8004BaseSepolia?: { agentId: number; chainId: number } | null;
}

export async function lookupAgentByEmail(label: string): Promise<GhostAgentLookupResult | null> {
  try {
    const res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'resolveAddress', name: `${label}_` }),
      signal:  AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as GhostAgentLookupResult & { exists?: boolean; name?: string; stream?: string };
    if (!data.exists) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Step 2: ERC-8004 ownerOf scan → agentId ──────────────────────────────────

async function rpcCall<T>(rpcs: readonly string[], body: object): Promise<T> {
  let lastErr: unknown;
  for (const rpc of rpcs) {
    try {
      const res  = await fetch(rpc, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(6000),
      });
      const data = await res.json() as T & { error?: { message: string } };
      if ((data as { error?: unknown }).error) throw new Error(String((data as { error?: unknown }).error));
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function ownerOf(rpcs: readonly string[], contract: string, tokenId: number): Promise<string | null> {
  try {
    // ownerOf(uint256) selector = 0x6352211e
    const data = `0x6352211e${tokenId.toString(16).padStart(64, '0')}`;
    const res  = await rpcCall<{ result?: string }>(rpcs, {
      jsonrpc: '2.0', id: 1,
      method:  'eth_call',
      params:  [{ to: contract, data }, 'latest'],
    });
    if (!res.result || res.result === '0x') return null;
    return `0x${res.result.slice(-40)}`;
  } catch {
    return null;
  }
}

async function totalSupply(rpcs: readonly string[], contract: string): Promise<number> {
  try {
    const res = await rpcCall<{ result?: string }>(rpcs, {
      jsonrpc: '2.0', id: 1,
      method:  'eth_call',
      params:  [{ to: contract, data: '0x18160ddd' }, 'latest'],
    });
    if (!res.result || res.result === '0x') return 0;
    return parseInt(res.result, 16);
  } catch {
    return 0;
  }
}

export interface Erc8004Match {
  agentId: number;
  network: string;
  chainId: number;
  contract: string;
}

export async function lookupAgentIdBySafe(safeAddress: string): Promise<Erc8004Match | null> {
  const normalized = safeAddress.toLowerCase();

  for (const [, cfg] of Object.entries(ERC8004_CONTRACTS)) {
    try {
      const supply = await totalSupply(cfg.rpcs, cfg.address);
      if (supply === 0) continue;
      // Scan from token 1 up to supply (ERC-721 sequential mint)
      const limit = Math.min(supply, 5000);
      // Check in batches of 10 concurrent calls
      const BATCH = 10;
      for (let i = 1; i <= limit; i += BATCH) {
        const ids = Array.from({ length: Math.min(BATCH, limit - i + 1) }, (_, k) => i + k);
        const owners = await Promise.all(ids.map(id => ownerOf(cfg.rpcs, cfg.address, id)));
        for (let j = 0; j < ids.length; j++) {
          if (owners[j]?.toLowerCase() === normalized) {
            return { agentId: ids[j], network: cfg.chain, chainId: cfg.chainId, contract: cfg.address };
          }
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ── Step 3: Alignment score from KV ──────────────────────────────────────────

export async function lookupAlignmentScore(agentId: number): Promise<{ score: number | null; level: 'green' | 'amber' | 'red' | null }> {
  const raw = await kvGet(`alignment:agent:${agentId}`) as Record<string, unknown> | null;
  if (raw?.score !== undefined && typeof raw.score === 'number') {
    const score = raw.score as number;
    const level = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
    return { score, level };
  }
  return { score: null, level: null };
}

// ── Full resolution pipeline ──────────────────────────────────────────────────

export async function resolveAgentEmail(email: string): Promise<AgentResolution> {
  const validation = validateAgentEmail(email);
  if (!validation.valid || !validation.label) {
    return { status: 'invalid_format', error: validation.error, resolvedAt: Date.now() };
  }

  const label = validation.label;

  // Step 1 — resolve via ghostagent.ninja (uses resolveAddress worker action)
  const agentData = await lookupAgentByEmail(label);
  if (!agentData) {
    return {
      status: 'not_found',
      email,
      label,
      error: `Agent ${label}_@nftmail.box not found in registry`,
      resolvedAt: Date.now(),
    };
  }

  // Prefer Safe address, fall back to onChainOwner EOA
  const safeAddress = agentData.safe ?? agentData.onChainOwner ?? undefined;

  // Step 2 — ERC-8004 agentId: prefer KV data from worker (fast), fall back to on-chain scan
  let erc8004: Erc8004Match | null = null;
  if (agentData.erc8004AgentId != null && agentData.erc8004ChainId != null) {
    // Worker already resolved from KV — use primary chain
    erc8004 = {
      agentId:  agentData.erc8004AgentId,
      network:  agentData.erc8004ChainId === 8453 ? 'Base' : 'Gnosis',
      chainId:  agentData.erc8004ChainId,
      contract: agentData.erc8004ChainId === 8453
        ? ERC8004_CONTRACTS.basemainnet.address
        : ERC8004_CONTRACTS.gnosis.address,
    };
  } else {
    // Fall back to on-chain scan
    const ownerToScan = agentData.safe ?? agentData.onChainOwner;
    erc8004 = ownerToScan ? await lookupAgentIdBySafe(ownerToScan) : null;
  }

  // Step 3 — Alignment score
  const alignment = erc8004 ? await lookupAlignmentScore(erc8004.agentId) : { score: null, level: null };

  // Assemble badges
  const TIER_LABEL: Record<string, string> = { basic: 'Larva', lite: 'Pupa', premium: 'Imago', ghost: 'Ghost' };
  const tierDisplay = TIER_LABEL[agentData.accountTier] ?? agentData.accountTier;
  const badges: string[] = [`NFTmail Registered (${tierDisplay})`];
  if (agentData.originNft) badges.push(agentData.originNft);
  if (erc8004) badges.push(`ERC-8004 #${erc8004.agentId} (${erc8004.network})`);
  if (agentData.erc8004Base?.agentId)        badges.push(`ERC-8004 #${agentData.erc8004Base.agentId} (Base)`);
  if (agentData.erc8004BaseSepolia?.agentId) badges.push(`ERC-8004 #${agentData.erc8004BaseSepolia.agentId} (Base Sepolia)`);
  if (alignment.level === 'green') badges.push('Alignment ✓');
  else if (alignment.level === 'amber') badges.push('Alignment ⚠');

  return {
    status:          'ok',
    email,
    label,
    safeAddress,
    agentId:         erc8004?.agentId,
    network:         erc8004?.network,
    chainId:         erc8004?.chainId,
    // All registered chains
    erc8004Gnosis:      erc8004?.chainId === 100   ? erc8004 : null,
    erc8004Base:        agentData.erc8004Base        ?? (erc8004?.chainId === 8453   ? erc8004 : null),
    erc8004BaseSepolia: agentData.erc8004BaseSepolia ?? (erc8004?.chainId === 84532  ? erc8004 : null),
    alignmentScore:  alignment.score,
    alignmentLevel:  alignment.level,
    badges,
    resolvedAt:      Date.now(),
  };
}
