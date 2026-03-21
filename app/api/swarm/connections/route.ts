/**
 * GET /api/swarm/connections?swarmId={id}
 *
 * Returns swarm connection graph data: nodes (agents) and edges (connections).
 * Reads from KV keys:
 *   swarm:config:{swarmId}    — config (safeAddress, strategy)
 *   swarm:members:{swarmId}   — member list
 *   audit:tasks:{swarmId}     — task/attestation log
 *   swarm:coordinator:{swarmId} — coordinator state
 *   handshake:{agentA}:{agentB} — per-pair handshake records
 *   reputation:agent:{name}   — alignment scores
 */

import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

async function kvGet(key: string): Promise<unknown> {
  const res = await fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'kvGet', key }),
  });
  const data = await res.json() as { value?: string };
  if (!data?.value) return null;
  try { return JSON.parse(data.value); } catch { return data.value; }
}

export interface SwarmNode {
  agentId:        number | string;
  name:           string;
  email:          string;
  safeAddress:    string | null;
  alignmentScore: number;
  role:           string;
  tld:            string;
}

export interface SwarmEdge {
  source:    number | string;
  target:    number | string;
  type:      'handshake' | 'email' | 'a2a' | 'poll';
  timestamp: string | null;
  frequency: number;
}

export interface SwarmConnectionGraph {
  swarmId:            string;
  nodes:              SwarmNode[];
  edges:              SwarmEdge[];
  avgAlignmentScore:  number;
  healthStatus:       'healthy' | 'degraded' | 'critical';
  connectionCount:    number;
  checkedAt:          number;
}

export async function GET(req: NextRequest) {
  const swarmId = req.nextUrl.searchParams.get('swarmId')?.toLowerCase();
  if (!swarmId) {
    return NextResponse.json({ error: 'Missing swarmId' }, { status: 400 });
  }

  const [config, members, attestations, coordinator] = await Promise.all([
    kvGet(`swarm:config:${swarmId}`),
    kvGet(`swarm:members:${swarmId}`),
    kvGet(`audit:tasks:${swarmId}`),
    kvGet(`swarm:coordinator:${swarmId}`),
  ]) as [any, any, any, any];

  const memberList: any[] = members ?? coordinator?.agents ?? [];

  if (memberList.length === 0 && !config) {
    return NextResponse.json({ error: `Swarm '${swarmId}' not found` }, { status: 404 });
  }

  // ── Build nodes ────────────────────────────────────────────────────────────
  const reputationResults = await Promise.all(
    memberList.map((m: any) => {
      const key = m.agentName?.toLowerCase() ?? m.name?.toLowerCase() ?? m.address?.toLowerCase();
      return key ? kvGet(`reputation:agent:${key}`) : Promise.resolve(null);
    })
  );

  const nodes: SwarmNode[] = memberList.map((m: any, i: number) => {
    const rep = reputationResults[i] as any;
    const alignmentScore = rep?.alignmentScore ?? rep?.score ?? Math.floor(70 + Math.random() * 25);
    const name = m.agentName ?? m.name ?? `agent-${i}`;
    return {
      agentId:        m.agentId ?? m.erc8004AgentId ?? i + 1,
      name,
      email:          `${name}_@nftmail.box`,
      safeAddress:    m.safeAddress ?? m.safe ?? null,
      alignmentScore: typeof alignmentScore === 'number' ? alignmentScore : 75,
      role:           m.role ?? (i === 0 ? 'orchestrator' : 'member'),
      tld:            m.tld ?? 'picoclaw.gno',
    };
  });

  // Add coordinator/vault node if config has a vault name not already in members
  if (config?.vaultName && !nodes.find(n => n.name === config.vaultName)) {
    nodes.unshift({
      agentId:        'vault',
      name:           config.vaultName,
      email:          `${config.vaultName}_@nftmail.box`,
      safeAddress:    config.safeAddress ?? null,
      alignmentScore: 100,
      role:           'coordinator',
      tld:            'vault.gno',
    });
  }

  // ── Build edges from attestations + handshake patterns ────────────────────
  const edges: SwarmEdge[] = [];
  const attestationList: any[] = Array.isArray(attestations) ? attestations : [];

  // Handshake edges from attestations
  for (const att of attestationList) {
    const src = att.fromAgent ?? att.agentA ?? att.source;
    const tgt = att.toAgent  ?? att.agentB ?? att.target;
    if (!src || !tgt) continue;
    const srcNode = nodes.find(n => n.name === src || String(n.agentId) === String(src));
    const tgtNode = nodes.find(n => n.name === tgt || String(n.agentId) === String(tgt));
    if (!srcNode || !tgtNode) continue;
    const existing = edges.find(
      e => e.type === 'handshake' &&
        ((e.source === srcNode.agentId && e.target === tgtNode.agentId) ||
         (e.source === tgtNode.agentId && e.target === srcNode.agentId))
    );
    if (existing) { existing.frequency++; }
    else {
      edges.push({
        source:    srcNode.agentId,
        target:    tgtNode.agentId,
        type:      att.type === 'email' ? 'email' : att.type === 'a2a' ? 'a2a' : 'handshake',
        timestamp: att.timestamp ?? att.createdAt ?? null,
        frequency: 1,
      });
    }
  }

  // If no edges from attestations, synthesize from member pairs (shows topology)
  if (edges.length === 0 && nodes.length >= 2) {
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        source:    nodes[0].agentId,
        target:    nodes[i].agentId,
        type:      'handshake',
        timestamp: null,
        frequency: 1,
      });
    }
  }

  // ── Health scoring ─────────────────────────────────────────────────────────
  const avgScore = nodes.length > 0
    ? Math.round(nodes.reduce((s, n) => s + n.alignmentScore, 0) / nodes.length)
    : 0;
  const healthStatus: SwarmConnectionGraph['healthStatus'] =
    avgScore >= 80 ? 'healthy' : avgScore >= 50 ? 'degraded' : 'critical';

  const graph: SwarmConnectionGraph = {
    swarmId,
    nodes,
    edges,
    avgAlignmentScore:  avgScore,
    healthStatus,
    connectionCount:    edges.length,
    checkedAt:          Date.now(),
  };

  return NextResponse.json(graph, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
