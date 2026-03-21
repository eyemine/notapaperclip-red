/**
 * GET /api/erc8004/tx?hash=0x...
 *
 * Fetches a transaction receipt from the ERC-8004 registry chain and decodes
 * any AgentRegistered / MetadataUpdated events.
 * Tries Gnosis, Base, and Base Sepolia in parallel.
 */

import { NextRequest, NextResponse } from 'next/server';

const CHAINS = [
  {
    key:      'gnosis',
    chain:    'Gnosis',
    chainId:  100,
    rpcs:     ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com'],
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    explorer: 'https://gnosisscan.io/tx/',
  },
  {
    key:      'base',
    chain:    'Base',
    chainId:  8453,
    rpcs:     ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    explorer: 'https://basescan.org/tx/',
  },
  {
    key:      'basesepolia',
    chain:    'Base Sepolia',
    chainId:  84532,
    rpcs:     ['https://base-sepolia-rpc.publicnode.com', 'https://sepolia.base.org'],
    registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    explorer: 'https://sepolia.basescan.org/tx/',
  },
];

// keccak256 of Transfer(address,address,uint256) — used by ERC-721 mints
const TRANSFER_SIG  = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// keccak256 of Approval(address,address,uint256) — used for metadata updates
const APPROVAL_SIG  = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

async function rpcFetch(rpcs: string[], body: object): Promise<unknown> {
  let last: unknown;
  for (const rpc of rpcs) {
    try {
      const res  = await fetch(rpc, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(6000),
      });
      const data = await res.json() as { result?: unknown; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

interface TxReceipt {
  status:          string;
  blockNumber:     string;
  from:            string;
  to:              string;
  gasUsed:         string;
  transactionHash: string;
  logs: Array<{
    address: string;
    topics:  string[];
    data:    string;
    logIndex: string;
  }>;
}

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('hash')?.toLowerCase();
  if (!hash || !/^0x[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'Invalid or missing tx hash (must be 0x + 64 hex chars)' }, { status: 400 });
  }

  // Try all chains in parallel — receipt will be null on chains where tx doesn't exist
  const results = await Promise.allSettled(
    CHAINS.map(async (cfg) => {
      const receipt = await rpcFetch(cfg.rpcs, {
        jsonrpc: '2.0', id: 1,
        method:  'eth_getTransactionReceipt',
        params:  [hash],
      }) as TxReceipt | null;

      if (!receipt) return null;

      // Decode registry logs
      const registryLogs = receipt.logs.filter(
        l => l.address.toLowerCase() === cfg.registry.toLowerCase()
      );

      const events = registryLogs.map(log => {
        const topic0   = log.topics[0] ?? '';
        const isTransfer = topic0 === TRANSFER_SIG;
        const isApproval = topic0 === APPROVAL_SIG;
        const agentId  = log.topics[3]
          ? parseInt(log.topics[3], 16)
          : log.topics[1] ? parseInt(log.topics[1], 16) : null;
        const from     = log.topics[1] ? `0x${log.topics[1].slice(-40)}` : null;
        const to       = log.topics[2] ? `0x${log.topics[2].slice(-40)}` : null;
        const isMint   = from === '0x0000000000000000000000000000000000000000';

        return {
          eventType: isTransfer
            ? (isMint ? 'AgentRegistered (Mint)' : 'AgentTransferred')
            : isApproval ? 'MetadataUpdated'
            : `UnknownEvent(${topic0.slice(0, 10)}…)`,
          agentId,
          from,
          to,
          logIndex: parseInt(log.logIndex, 16),
        };
      });

      return {
        found:       true,
        chain:       cfg.chain,
        chainId:     cfg.chainId,
        explorerUrl: `${cfg.explorer}${hash}`,
        registry:    cfg.registry,
        txHash:      hash,
        status:      receipt.status === '0x1' ? 'success' : 'failed',
        block:       parseInt(receipt.blockNumber, 16),
        from:        receipt.from,
        gasUsed:     parseInt(receipt.gasUsed, 16),
        events,
      };
    })
  );

  // Return the first chain that found the tx
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      return NextResponse.json(r.value, {
        headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  return NextResponse.json(
    { error: 'Transaction not found on Gnosis, Base, or Base Sepolia', txHash: hash },
    { status: 404 }
  );
}
