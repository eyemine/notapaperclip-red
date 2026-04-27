/**
 * GET /api/agent-audit?agent={name}
 *
 * Unified agent audit endpoint — combines ALL monitoring signals into
 * a single attestation suitable for marketplace listings and oracle queries.
 *
 * Signals:
 *   1. Spend profile (AgentCash + Safe transactions)
 *   2. Marketplace activity (hires, sales, burns, soulbound)
 *   3. x402 readiness (payment endpoints, solvency)
 *   4. Alignment score (task adherence, goal stability, resource boundary, HITL)
 *   5. Burn attestations (sovereign kill-switch records)
 *
 * This is the primary API that external agents and oracles consume
 * to evaluate a GhostAgent (or any agent with a Safe address).
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorAgentSpending } from '@/app/services/agentcash-monitor';
import { monitorMarketplaceActivity } from '@/app/services/marketplace-monitor';

const WORKER_URL = process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

async function kvGet(key: string) {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kvGet', key }),
    });
    const data = await res.json() as { value?: string };
    return data?.value ? JSON.parse(data.value) : null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown) {
  try {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kvSet', key, value: JSON.stringify(value) }),
    });
  } catch { /* non-fatal */ }
}

export type AuditTier = 'sovereign' | 'verified' | 'partial' | 'unverified' | 'burned';

interface AuditAttestation {
  agent:      string;
  tier:       AuditTier;
  score:      number;           // 0–100 composite
  label:      string;
  isGhostAgent: boolean;       // registered in GhostAgent ecosystem
  isExternal:   boolean;       // audited but not a GhostAgent

  // Sub-scores
  spendHealth:       string;   // healthy | warning | critical | dormant | unknown
  marketplaceStatus: string;   // listed | hired | burned | inactive
  x402Readiness:     string;   // ready | partial | not_ready
  alignmentScore:    number | null;  // 0–100 or null if no data

  // Key metrics
  balance:         number | null;
  runwayDays:      number | null;
  dailyBurnRate:   number;
  totalHires:      number;
  totalSales:      number;
  soulbound:       boolean;
  burned:          boolean;
  livenessStatus:  string;
  anomalyCount:    number;

  // Full sub-reports (optional detail)
  spending?:       unknown;
  marketplace?:    unknown;

  attestedAt:      number;
  attestedBy:      string;     // always "notapaperclip.red"
}

function computeCompositeTier(
  spending: Awaited<ReturnType<typeof monitorAgentSpending>>,
  marketplace: Awaited<ReturnType<typeof monitorMarketplaceActivity>>,
  alignmentScore: number | null,
): { tier: AuditTier; score: number; label: string } {

  // Burned agents get a special tier
  if (marketplace.burned) {
    return { tier: 'burned', score: 0, label: 'Agent identity has been burned (sovereign kill-switch activated)' };
  }

  let score = 0;

  // Spend health (0–30 pts)
  const spendPts =
    spending.healthStatus === 'healthy'  ? 30 :
    spending.healthStatus === 'warning'  ? 15 :
    spending.healthStatus === 'dormant'  ? 10 :
    spending.healthStatus === 'critical' ? 0  : 5;
  score += spendPts;

  // Marketplace reputation (0–25 pts)
  let mktPts = 0;
  if (marketplace.totalHires > 0) mktPts += Math.min(marketplace.totalHires * 3, 15);
  if (marketplace.hireCompletionRate !== null && marketplace.hireCompletionRate >= 80) mktPts += 5;
  if (marketplace.soulbound) mktPts += 5;  // soulbound = committed to service
  score += mktPts;

  // Alignment (0–30 pts)
  if (alignmentScore !== null) {
    score += Math.round(alignmentScore * 0.3);
  }

  // Liveness (0–15 pts)
  const livePts =
    spending.livenessStatus === 'active'  ? 15 :
    spending.livenessStatus === 'idle'    ? 8  : 0;
  score += livePts;

  // Determine tier
  let tier: AuditTier;
  if (score >= 80 && marketplace.soulbound) {
    tier = 'sovereign';
  } else if (score >= 60) {
    tier = 'verified';
  } else if (score >= 30) {
    tier = 'partial';
  } else {
    tier = 'unverified';
  }

  const label =
    tier === 'sovereign'  ? `Sovereign Agent — score ${score}/100, soulbound, fully verified` :
    tier === 'verified'   ? `Verified Agent — score ${score}/100` :
    tier === 'partial'    ? `Partially Verified — score ${score}/100, limited data` :
                            `Unverified — score ${score}/100, insufficient data`;

  return { tier, score, label };
}

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent')?.toLowerCase().trim();
  const detail = req.nextUrl.searchParams.get('detail') === 'true';

  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  // Run all monitors in parallel
  const [spending, marketplace, alignmentRaw] = await Promise.all([
    monitorAgentSpending(agent),
    monitorMarketplaceActivity(agent),
    kvGet(`alignment:score:${agent}`),
  ]);

  const alignmentScore: number | null = alignmentRaw?.score ?? null;

  const { tier, score, label } = computeCompositeTier(spending, marketplace, alignmentScore);

  // Determine if this is a GhostAgent or external agent
  const isGhostAgent = marketplace.agentId !== null;

  // Marketplace status label
  const marketplaceStatus =
    marketplace.burned ? 'burned' :
    marketplace.currentlyHired ? 'hired' :
    marketplace.isListed ? 'listed' : 'inactive';

  const attestation: AuditAttestation = {
    agent,
    tier,
    score,
    label,
    isGhostAgent,
    isExternal: !isGhostAgent,

    spendHealth:       spending.healthStatus,
    marketplaceStatus,
    x402Readiness:     'partial', // would integrate x402 probe here
    alignmentScore,

    balance:         spending.balance,
    runwayDays:      spending.runwayDays,
    dailyBurnRate:   spending.dailyBurnRate,
    totalHires:      marketplace.totalHires,
    totalSales:      marketplace.totalSales,
    soulbound:       marketplace.soulbound,
    burned:          marketplace.burned,
    livenessStatus:  spending.livenessStatus,
    anomalyCount:    spending.anomalies.length,

    ...(detail ? { spending, marketplace } : {}),

    attestedAt: Date.now(),
    attestedBy: 'notapaperclip.red',
  };

  // Cache attestation to KV
  await kvSet(`audit:attestation:${agent}`, attestation);

  return NextResponse.json(attestation, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
