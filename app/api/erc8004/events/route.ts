/**
 * GET /api/erc8004/events?chain=gnosis|basemainnet|basesepolia|all&limit=50&agentId=
 *
 * Polls ERC-8004 registry contracts for recent events via JSON-RPC getLogs.
 * No WebSocket needed — HTTP polling only.
 *
 * Contracts:
 *   Gnosis mainnet  (100):   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *   Base Mainnet    (8453):  0x8004A169FB4a3325136EB29fA0ceB6D2e539a432  (Synthesis hackathon)
 *   Base Sepolia    (84532): 0x8004A818BFB912233c491871b3d84c89A494BD9e
 */

import { NextRequest, NextResponse } from 'next/server';

const CONTRACTS: Record<string, { rpcs: string[]; address: string; chain: string; chainId: number }> = {
  gnosis: {
    rpcs:    ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com', 'https://gnosis.drpc.org'],
    address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    chain:   'Gnosis',
    chainId: 100,
  },
  basemainnet: {
    rpcs:    ['https://base-rpc.publicnode.com', 'https://base.drpc.org', 'https://mainnet.base.org'],
    address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    chain:   'Base',
    chainId: 8453,
  },
  basesepolia: {
    rpcs:    ['https://base-sepolia-rpc.publicnode.com', 'https://sepolia.base.org'],
    address: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    chain:   'Base Sepolia',
    chainId: 84532,
  },
};

// keccak256 of event signatures
const EVENT_SIGS: Record<string, string> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'AgentRegistered (Transfer)',
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'MetadataUpdated (Approval)',
};

interface RpcLog {
  address:          string;
  topics:           string[];
  data:             string;
  blockNumber:      string;
  transactionHash:  string;
  logIndex:         string;
  blockHash:        string;
}

interface ParsedEvent {
  chain:     string;
  chainId:   number;
  eventType: string;
  agentId:   string;
  txHash:    string;
  block:     number;
  contract:  string;
}

async function rpcPost<T>(rpcs: string[], body: object): Promise<T> {
  let lastErr: unknown;
  for (const rpc of rpcs) {
    try {
      const res  = await fetch(rpc, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(8000),
      });
      const data = await res.json() as T & { error?: { message: string } };
      if ((data as { error?: { message: string } }).error) throw new Error((data as { error?: { message: string } }).error!.message);
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function getLatestBlock(rpcs: string[]): Promise<number> {
  const data = await rpcPost<{ result: string }>(rpcs, { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
  return parseInt(data.result, 16);
}

async function getLogs(rpcs: string[], address: string, fromBlock: number, toBlock: number): Promise<RpcLog[]> {
  const data = await rpcPost<{ result?: RpcLog[] }>(rpcs, {
    jsonrpc: '2.0', id: 1,
    method:  'eth_getLogs',
    params:  [{ address, fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}` }],
  });
  return data.result ?? [];
}

function parseLog(log: RpcLog, chain: string, chainId: number, contract: string): ParsedEvent {
  const topic0    = log.topics[0] ?? '';
  const eventType = EVENT_SIGS[topic0] ?? `Event(${topic0.slice(0, 10)}…)`;
  // agentId is typically encoded in topics[3] for ERC-721 Transfer
  const agentId   = log.topics[3]
    ? String(parseInt(log.topics[3], 16))
    : log.topics[1]
    ? String(parseInt(log.topics[1], 16))
    : '?';

  return {
    chain,
    chainId,
    eventType,
    agentId,
    txHash:   log.transactionHash,
    block:    parseInt(log.blockNumber, 16),
    contract,
  };
}

export async function GET(req: NextRequest) {
  const chainParam = req.nextUrl.searchParams.get('chain') ?? 'all';
  const limit      = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100);
  const agentIdFilter = req.nextUrl.searchParams.get('agentId');

  const targets = chainParam === 'all'
    ? Object.entries(CONTRACTS)
    : Object.entries(CONTRACTS).filter(([k]) => k === chainParam);

  const allEvents: ParsedEvent[] = [];
  const errors: string[] = [];

  await Promise.all(
    targets.map(async ([, cfg]) => {
      try {
        const latest   = await getLatestBlock(cfg.rpcs);
        const fromBlock = Math.max(0, latest - 2000); // ~7 days on Gnosis (~1.5s blocks)
        const logs     = await getLogs(cfg.rpcs, cfg.address, fromBlock, latest);
        const parsed   = logs.map(l => parseLog(l, cfg.chain, cfg.chainId, cfg.address));
        allEvents.push(...parsed);
      } catch (err) {
        errors.push(`${cfg.chain}: ${String(err)}`);
      }
    })
  );

  // Sort newest first (by block desc)
  allEvents.sort((a, b) => b.block - a.block);

  const filtered = agentIdFilter
    ? allEvents.filter(e => e.agentId === agentIdFilter)
    : allEvents;

  return NextResponse.json({
    events:    filtered.slice(0, limit),
    total:     filtered.length,
    chains:    targets.map(([, c]) => c.chain),
    errors:    errors.length ? errors : undefined,
    fetchedAt: Date.now(),
  });
}
