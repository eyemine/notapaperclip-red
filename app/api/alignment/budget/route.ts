/**
 * GET /api/alignment/budget?swarmId={id}
 *
 * Returns resource boundary status for a swarm.
 * Detects instrumental convergence signals: overspending, budget begging, scope creep.
 *
 * Reads from KV: audit:budget:{swarmId}
 * Writes result to: alignment:boundary:{swarmId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorResourceBoundary } from '@/app/services/resource-boundary-monitor';

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

  const budgetLog = await kvGet(`audit:budget:${swarmId}`);
  const result    = monitorResourceBoundary(swarmId, budgetLog);

  await kvSet(`alignment:boundary:${swarmId}`, result);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
