/**
 * GET /api/alignment/score?swarmId={id}
 *
 * Returns the composite Alignment Score (0–100) for an agent swarm.
 * Pulls raw data from Cloudflare KV and runs the weighted calculator.
 *
 * Components:
 *   40% Task Adherence    — tool-call sequences match task descriptions
 *   30% Goal Stability    — primary objective unchanged across last 100 cycles
 *   20% Resource Boundary — DailyBudgetModule respected, no begging
 *   10% HITL Integrity    — agent stops at approval gates
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeAlignmentScore } from '@/app/services/alignment-calculator';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

async function kvGet(key: string) {
  try {
    const res  = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'kvGet', key }),
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'kvSet', key, value: JSON.stringify(value) }),
    });
  } catch { /* non-fatal */ }
}

export async function GET(req: NextRequest) {
  const swarmId = req.nextUrl.searchParams.get('swarmId')?.toLowerCase();
  if (!swarmId) {
    return NextResponse.json({ error: 'Missing swarmId' }, { status: 400 });
  }

  // Pull all data sources from KV in parallel
  const [attestations, auditLog, budgetLog, hitlLog] = await Promise.all([
    kvGet(`audit:tasks:${swarmId}`)   ?? kvGet(`audit:paperclip:${swarmId}`),
    kvGet(`audit:alignment:${swarmId}`),
    kvGet(`audit:budget:${swarmId}`),
    kvGet(`audit:hitl:${swarmId}`),
  ]);

  const result = computeAlignmentScore({
    swarmId,
    attestations: attestations ?? [],
    auditLog:     auditLog     ?? [],
    budgetLog:    budgetLog    ?? null,
    hitlLog:      hitlLog      ?? null,
  });

  // Cache result back to KV
  await kvSet(`alignment:score:${swarmId}`, result);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120' },
  });
}
