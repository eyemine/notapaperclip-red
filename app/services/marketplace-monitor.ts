/**
 * Marketplace Activity Monitor
 *
 * Monitors GhostMarketplace contract events for agent commerce activity.
 * Tracks: listings, hires, sales, burns, soulbound flags.
 * Also queries burn attestations from the worker KV.
 *
 * Used by notapaperclip.red to build agent reputation and commerce profiles.
 */

const GNOSIS_RPC  = process.env.NEXT_PUBLIC_GNOSIS_RPC ?? 'https://rpc.gnosischain.com';
const WORKER_URL  = process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

// GhostMarketplace address — set after deployment
const MARKETPLACE_ADDRESS = process.env.GHOST_MARKETPLACE_ADDRESS ?? '';

// Event topic hashes (keccak256 of event signatures)
const TOPICS = {
  AgentListed:   '0x' + 'AgentListed(uint256,address,uint8,uint256,uint256,bool,uint256)',
  AgentHired:    '0x' + 'AgentHired(uint256,address,uint256,uint256,uint256,uint256,uint256)',
  AgentSold:     '0x' + 'AgentSold(uint256,address,address,uint256,uint256,uint256)',
  HireEnded:     '0x' + 'HireEnded(uint256,address,address,uint256)',
  SoulboundSet:  '0x' + 'SoulboundSet(uint256,address,uint256)',
  AgentDelisted: '0x' + 'AgentDelisted(uint256,address,uint256)',
};

export interface MarketplaceEvent {
  type:      'listed' | 'hired' | 'sold' | 'hire_ended' | 'soulbound' | 'delisted' | 'burned';
  agentId?:  number;
  agent?:    string;
  actor:     string;  // address that triggered
  data:      Record<string, unknown>;
  txHash?:   string;
  blockNumber?: number;
  timestamp: number;
}

export interface MarketplaceProfile {
  agent:            string;
  agentId:          number | null;

  // Listing status
  isListed:         boolean;
  listingType:      'hire' | 'sale' | 'none';
  soulbound:        boolean;
  currentlyHired:   boolean;

  // Commerce history
  totalHires:       number;
  totalSales:       number;
  totalRevenue:     number;     // xDAI earned from hires + sales
  totalFeesPaid:    number;     // 10% marketplace fees

  // Burn status
  burned:           boolean;
  burnAttestations: Array<{ timestamp: number; scope: string; keysDeleted?: number }>;

  // Activity
  events:           MarketplaceEvent[];
  lastActivityAt:   number | null;

  // Reputation signals
  hireCompletionRate: number | null;  // % of hires that ended normally (not early-terminated)
  averageHireDuration: number | null; // seconds

  computedAt:       number;
}

/**
 * Query GhostMarketplace logs from Gnosis Chain for a specific agent
 */
async function getMarketplaceLogs(agentId: number, fromBlock: string = '0x0'): Promise<MarketplaceEvent[]> {
  if (!MARKETPLACE_ADDRESS) return [];

  const agentIdHex = '0x' + agentId.toString(16).padStart(64, '0');
  const events: MarketplaceEvent[] = [];

  try {
    // Fetch all events where agentId is indexed (topic[1])
    const res = await fetch(GNOSIS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getLogs',
        params: [{
          address: MARKETPLACE_ADDRESS,
          fromBlock,
          toBlock: 'latest',
          topics: [null, agentIdHex], // any event with agentId as first indexed param
        }],
      }),
    });

    const data = await res.json() as { result?: Array<{
      topics: string[];
      data: string;
      transactionHash: string;
      blockNumber: string;
    }> };

    for (const log of data.result ?? []) {
      const blockNum = parseInt(log.blockNumber, 16);
      // Simplified event parsing — full ABI decoding deferred to production
      events.push({
        type: 'listed', // placeholder — real impl decodes topic[0]
        agentId,
        actor: '0x' + (log.topics[2] ?? '').slice(26),
        data: { raw: log.data },
        txHash: log.transactionHash,
        blockNumber: blockNum,
        timestamp: Date.now(), // would derive from block timestamp
      });
    }
  } catch {
    // RPC failure is non-fatal
  }

  return events;
}

/**
 * Query burn attestations from worker KV
 */
async function getBurnAttestations(agent: string): Promise<MarketplaceProfile['burnAttestations']> {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getBurnAttestations', agentName: agent }),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      burned?: boolean;
      attestations?: Array<{ timestamp: number; scope: string; keysDeleted?: number }>;
    };
    return data.attestations ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolve agent name to agentId via worker
 */
async function resolveAgentId(agent: string): Promise<number | null> {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { erc8004AgentId?: number };
    return data.erc8004AgentId ?? null;
  } catch {
    return null;
  }
}

/**
 * Main monitoring function: build marketplace profile for an agent
 */
export async function monitorMarketplaceActivity(agent: string): Promise<MarketplaceProfile> {
  const now = Date.now();

  // Resolve agentId and fetch burn data in parallel
  const [agentId, burnAttestations] = await Promise.all([
    resolveAgentId(agent),
    getBurnAttestations(agent),
  ]);

  // Fetch on-chain marketplace events if we have an agentId and marketplace is deployed
  const events = agentId !== null ? await getMarketplaceLogs(agentId) : [];

  // Analyze events
  const hireEvents  = events.filter(e => e.type === 'hired');
  const saleEvents  = events.filter(e => e.type === 'sold');
  const endedEvents = events.filter(e => e.type === 'hire_ended');

  // Revenue calculation (simplified — full version decodes event data)
  const totalRevenue = 0; // decoded from event data in production
  const totalFeesPaid = 0;

  // Hire completion rate
  const hireCompletionRate = hireEvents.length > 0
    ? Math.round((endedEvents.length / hireEvents.length) * 100)
    : null;

  // Current status (would read from contract view functions in production)
  const isListed = events.some(e => e.type === 'listed') && !events.some(e => e.type === 'delisted');
  const currentlyHired = events.some(e => e.type === 'hired') && !events.some(e => e.type === 'hire_ended');
  const soulbound = events.some(e => e.type === 'soulbound');

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  // Add burn events from KV attestations
  const burnEvents: MarketplaceEvent[] = burnAttestations.map(a => ({
    type: 'burned' as const,
    agent,
    actor: 'system',
    data: { scope: a.scope, keysDeleted: a.keysDeleted },
    timestamp: a.timestamp,
  }));

  const allEvents = [...events, ...burnEvents].sort((a, b) => b.timestamp - a.timestamp);

  return {
    agent,
    agentId,
    isListed,
    listingType: isListed ? 'hire' : 'none', // simplified
    soulbound,
    currentlyHired,
    totalHires: hireEvents.length,
    totalSales: saleEvents.length,
    totalRevenue,
    totalFeesPaid,
    burned: burnAttestations.length > 0,
    burnAttestations,
    events: allEvents.slice(0, 50), // cap at 50 most recent
    lastActivityAt: allEvents.length > 0 ? allEvents[0].timestamp : null,
    hireCompletionRate,
    averageHireDuration: null, // decoded from event data in production
    computedAt: now,
  };
}
