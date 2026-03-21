/**
 * GET /api/erc8004/resolve?chain=gnosis&agentId=3199
 *
 * Resolves an ERC-8004 agentId to its agentURI by calling tokenURI()
 * on the Identity Registry contract via public RPC.
 *
 * Also accepts 8004agents.ai URLs:
 *   ?url=https://8004agents.ai/base/agent/19731
 */

import { NextRequest, NextResponse } from 'next/server';

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Only chains where 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 is confirmed deployed
const CHAINS: Record<string, { name: string; rpc: string; chainId: number }> = {
  gnosis:         { name: 'Gnosis',        rpc: 'https://rpc.gnosischain.com',                    chainId: 100      },
  base:           { name: 'Base',          rpc: 'https://mainnet.base.org',                       chainId: 8453     },
  'base-sepolia': { name: 'Base Sepolia',  rpc: 'https://sepolia.base.org',                       chainId: 84532    },
  ethereum:       { name: 'Ethereum',      rpc: 'https://eth.llamarpc.com',                       chainId: 1        },
  bnb:            { name: 'BNB Chain',     rpc: 'https://bsc-dataseed.binance.org',                chainId: 56       },
  arbitrum:       { name: 'Arbitrum',      rpc: 'https://arb1.arbitrum.io/rpc',                   chainId: 42161    },
  avalanche:      { name: 'Avalanche',     rpc: 'https://api.avax.network/ext/bc/C/rpc',          chainId: 43114    },
  linea:          { name: 'Linea',         rpc: 'https://rpc.linea.build',                        chainId: 59144    },
  sepolia:        { name: 'Sepolia',       rpc: 'https://ethereum-sepolia-rpc.publicnode.com',    chainId: 11155111 },
  // polygon: NOT deployed · monad: testnet only (no stable public RPC)
};

// 8004agents.ai URL pattern: /{chain}/agent/{agentId}
const EXPLORER_PATTERN = /8004agents\.ai\/([^/]+)\/agent\/(\d+)/;

// Minimal ABI encode for tokenURI(uint256)
function encodeTokenURICall(agentId: number): string {
  // Function selector: keccak256("tokenURI(uint256)") = 0xc87b56dd
  const selector = 'c87b56dd';
  const paddedId = agentId.toString(16).padStart(64, '0');
  return `0x${selector}${paddedId}`;
}

// Decode ABI-encoded string return value
function decodeStringReturn(hex: string): string {
  // Strip 0x
  const data = hex.startsWith('0x') ? hex.slice(2) : hex;
  // offset (32 bytes) + length (32 bytes) + data
  if (data.length < 128) return '';
  const lengthHex = data.slice(64, 128);
  const length = parseInt(lengthHex, 16);
  if (length === 0) return '';
  const strHex = data.slice(128, 128 + length * 2);
  return Buffer.from(strHex, 'hex').toString('utf8');
}

async function callTokenURI(rpcUrl: string, agentId: number): Promise<string | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: REGISTRY, data: encodeTokenURICall(agentId) }, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { result?: string; error?: { message: string } };
    if (json.error || !json.result || json.result === '0x') return null;
    return decodeStringReturn(json.result);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  let chainKey = req.nextUrl.searchParams.get('chain')?.toLowerCase().trim() ?? '';
  let agentIdStr = req.nextUrl.searchParams.get('agentId')?.trim() ?? '';

  // Parse 8004agents.ai URL if provided
  const explorerUrl = req.nextUrl.searchParams.get('url')?.trim();
  if (explorerUrl) {
    const match = EXPLORER_PATTERN.exec(explorerUrl);
    if (!match) {
      return NextResponse.json({ error: 'Could not parse 8004agents.ai URL — expected format: /{chain}/agent/{agentId}' }, { status: 400 });
    }
    chainKey   = match[1].toLowerCase();
    agentIdStr = match[2];
  }

  if (!chainKey) return NextResponse.json({ error: 'Missing chain parameter' }, { status: 400 });
  if (!agentIdStr) return NextResponse.json({ error: 'Missing agentId parameter' }, { status: 400 });

  const chain = CHAINS[chainKey];
  if (!chain) {
    return NextResponse.json({
      error: `Unknown chain "${chainKey}". Supported: ${Object.keys(CHAINS).join(', ')}`,
    }, { status: 400 });
  }

  const agentId = parseInt(agentIdStr, 10);
  if (isNaN(agentId) || agentId <= 0) {
    return NextResponse.json({ error: 'Invalid agentId — must be a positive integer' }, { status: 400 });
  }

  const agentURI = await callTokenURI(chain.rpc, agentId);

  if (!agentURI) {
    return NextResponse.json({
      error: `Agent #${agentId} not found on ${chain.name} — no tokenURI returned from registry`,
    }, { status: 404 });
  }

  // Handle inline data URIs: data:application/json;base64,<b64>
  if (agentURI.startsWith('data:')) {
    try {
      const b64 = agentURI.split(',')[1];
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
      return NextResponse.json({
        agentId,
        chain:      chainKey,
        chainId:    chain.chainId,
        chainName:  chain.name,
        registry:   REGISTRY,
        agentURI,
        inlineCard: json,
        explorerUrl: `https://8004agents.ai/${chainKey}/agent/${agentId}`,
      });
    } catch {
      return NextResponse.json({ error: 'Failed to decode inline data URI card' }, { status: 422 });
    }
  }

  return NextResponse.json({
    agentId,
    chain:    chainKey,
    chainId:  chain.chainId,
    chainName: chain.name,
    registry: REGISTRY,
    agentURI,
    explorerUrl: `https://8004agents.ai/${chainKey}/agent/${agentId}`,
  });
}
