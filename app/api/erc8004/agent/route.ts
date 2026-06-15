/**
 * GET /api/erc8004/agent?id=3203&chain=gnosis
 *
 * Resolves on-chain identity for ANY ERC-8004 agentId on any supported chain.
 * Works for GhostAgents, Olas agents, and any other ERC-8004 registrant.
 *
 * Returns: owner, tokenURI, resolved metadata (name, description, image), explorer link.
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentService } from '@/lib/agent-service';
import { CHAINS } from '@/lib/chains';
import { validateErc8004Card } from '@/lib/validation';

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

  const agentId = parseInt(idParam, 10);
  const chain = CHAINS[chainKey];

  if (!chain) {
    return NextResponse.json({ error: `Invalid chain: ${chainKey}` }, { status: 400 });
  }

  try {
    // Use the unified agent service
    const card = await agentService.getErc8004Card(chainKey, agentId);
    
    if (!card) {
      return NextResponse.json({
        found: false,
        agentId,
        chain: chain.label,
        chainId: chain.chainId,
        error: `Agent #${agentId} not found on ${chain.label}`,
      }, { status: 404 });
    }

    // Validate the card before returning
    const validation = validateErc8004Card(card);
    if (!validation.isValid) {
      return NextResponse.json({
        found: false,
        agentId,
        chain: chain.label,
        chainId: chain.chainId,
        error: `Invalid agent data: ${validation.errors.join(', ')}`,
      }, { status: 500 });
    }

    // Detect ecosystem from tokenURI
    let ecosystem: 'ghostagent' | 'olas' | 'unknown' = 'unknown';
    if (card.agentURI) {
      if (card.agentURI.includes('olas') || card.agentURI.includes('autonolas')) ecosystem = 'olas';
      else if (card.agentURI.includes('lighthouse') || card.agentURI.includes('ghostagent') || card.agentURI.includes('ipfs')) ecosystem = 'ghostagent';
    }

    return NextResponse.json({
      found: true,
      agentId,
      chain: chain.label,
      chainId: chain.chainId,
      registry: chain.registry,
      owner: card.owner,
      tokenUri: card.agentURI,
      tokenUriResolved: card.agentURI ? resolveIpfsUrl(card.agentURI) : null,
      metadata: {
        name: card.name,
        description: card.description,
        image: card.image,
        skills: card.skills,
        services: card.services,
        a2aEndpoint: card.a2aEndpoint,
        x402Support: card.x402Support,
      },
      ecosystem,
      explorerNft: `${chain.explorer}/nft/${chain.registry}/${agentId}`,
      explorerOwner: `${chain.explorer}/address/${card.owner}`,
      pairedAgent: card.pairedAgent,
    });
  } catch (error) {
    console.error(`Error fetching ERC-8004 agent ${agentId} on ${chainKey}:`, error);
    return NextResponse.json({
      found: false,
      agentId,
      chain: chain.label,
      chainId: chain.chainId,
      error: 'Failed to fetch agent data',
    }, { status: 500 });
  }
}
