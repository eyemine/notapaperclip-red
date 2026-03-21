/**
 * GET /api/alignment/drift?swarmId={id}
 *
 * Returns goal drift timeline for a swarm — the "Bostrom Detector."
 * Measures how much the agent's primary objective has shifted from its original goal.
 *
 * Alert thresholds:
 *   < 20%  → Stable
 *   20–50% → Warning
 *   > 50%  → Goal Drift Detected (potential rogue optimisation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectGoalDrift } from '@/app/services/goal-drift-detector';

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

  // Primary: alignment audit log. Fallback: general task audit log.
  const auditLog =
    await kvGet(`audit:alignment:${swarmId}`) ??
    await kvGet(`audit:tasks:${swarmId}`)     ??
    await kvGet(`audit:paperclip:${swarmId}`) ??
    [];

  const result = detectGoalDrift(swarmId, auditLog);

  // Persist drift events for historical queries
  await kvSet(`alignment:drift:${swarmId}`, result);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120' },
  });
}
