/**
 * GET /api/erc8004/agent?id=3203&chain=gnosis
 *
 * Resolves on-chain identity for ANY ERC-8004 agentId on any supported chain.
 * Works for GhostAgents, Olas agents, and any other ERC-8004 registrant.
 *
 * Returns: owner, tokenURI, resolved metadata (name, description, image), explorer link.
 */

import { NextRequest, NextResponse } from 'next/server';

const CHAINS: Record<string, { label: string; chainId: number; registry: string; rpc: string; explorer: string }> = {
  gnosis: {
    label:    'Gnosis',
    chainId:  100,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc:      'https://rpc.gnosischain.com',
    explorer: 'https://gnosisscan.io',
  },
  base: {
    label:    'Base',
    chainId:  8453,
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    rpc:      'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  baseSepolia: {
    label:    'Base Sepolia',
    chainId:  84532,
    registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    rpc:      'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
};

function pad32(hex: string) {
  return hex.replace('0x', '').padStart(64, '0');
}

async function ethCall(rpc: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    });
    const json = await res.json() as { result?: string; error?: unknown };
    return json.result && json.result !== '0x' ? json.result : null;
  } catch {
    return null;
  }
}

function decodeAddress(hex: string): string {
  return '0x' + hex.replace('0x', '').slice(-40);
}

function decodeString(hex: string): string {
  try {
    const buf = Buffer.from(hex.replace('0x', ''), 'hex');
    const offset = parseInt(buf.slice(0, 32).toString('hex'), 16);
    const length = parseInt(buf.slice(offset, offset + 32).toString('hex'), 16);
    return buf.slice(offset + 32, offset + 32 + length).toString('utf8');
  } catch {
    return '';
  }
}

function resolveIpfsUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.lighthouse.storage/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

async function fetchMetadata(uri: string): Promise<Record<string, unknown> | null> {
  try {
    const url = resolveIpfsUrl(uri);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get('id')?.trim();
  const chainKey = req.nextUrl.searchParams.get('chain')?.trim() ?? 'gnosis';

  if (!idParam || !/^\d+$/.test(idParam)) {
    return NextResponse.json({ error: 'Missing or invalid id (must be a number)' }, { status: 400 });
  }

  const chain = CHAINS[chainKey] ?? CHAINS.gnosis;
  const agentId = parseInt(idParam, 10);
  const tokenIdHex = pad32(agentId.toString(16));

  // ownerOf(uint256)
  const ownerRaw = await ethCall(chain.rpc, chain.registry, `0x6352211e${tokenIdHex}`);
  if (!ownerRaw) {
    return NextResponse.json({
      found:    false,
      agentId,
      chain:    chain.label,
      chainId:  chain.chainId,
      error:    `Agent #${agentId} not found on ${chain.label}`,
    }, { status: 404 });
  }

  const owner = decodeAddress(ownerRaw);

  // tokenURI(uint256)
  const tokenUriRaw = await ethCall(chain.rpc, chain.registry, `0xc87b56dd${tokenIdHex}`);
  const tokenUri = tokenUriRaw ? decodeString(tokenUriRaw) : null;

  // Resolve metadata from tokenURI if available
  let metadata: Record<string, unknown> | null = null;
  if (tokenUri) {
    metadata = await fetchMetadata(tokenUri);
  }

  // Detect ecosystem from tokenURI
  let ecosystem: 'ghostagent' | 'olas' | 'unknown' = 'unknown';
  if (tokenUri) {
    if (tokenUri.includes('olas') || tokenUri.includes('autonolas')) ecosystem = 'olas';
    else if (tokenUri.includes('lighthouse') || tokenUri.includes('ghostagent') || tokenUri.includes('ipfs')) ecosystem = 'ghostagent';
  }

  return NextResponse.json({
    found:       true,
    agentId,
    chain:       chain.label,
    chainId:     chain.chainId,
    registry:    chain.registry,
    owner,
    tokenUri,
    tokenUriResolved: tokenUri ? resolveIpfsUrl(tokenUri) : null,
    metadata,
    ecosystem,
    explorerNft: `${chain.explorer}/nft/${chain.registry}/${agentId}`,
    explorerOwner: `${chain.explorer}/address/${owner}`,
  });
}
