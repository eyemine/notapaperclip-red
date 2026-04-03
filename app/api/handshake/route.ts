/**
 * POST /api/handshake   — server-side proxy to ghostagent.ninja/api/handshake
 * GET  /api/handshake   — proxy for erc8004/register lookups
 *
 * Avoids CORS entirely: the browser calls same-origin /api/handshake,
 * this route forwards server-side to ghostagent.ninja.
 */

import { NextRequest, NextResponse } from 'next/server';

const GHOSTAGENT_HANDSHAKE = 'https://ghostagent.ninja/api/handshake';
const GHOSTAGENT_LOOKUP    = 'https://ghostagent.ninja/api/erc8004/register';
const WORKER_URL           = process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const upstream = await fetch(GHOSTAGENT_HANDSHAKE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Upstream error: ${String(e)}` }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent');
  if (!agent) {
    return NextResponse.json({ ok: false, error: 'Missing agent param' }, { status: 400 });
  }

  // ── Primary: ghostagent.ninja lookup ─────────────────────────────────────
  try {
    const upstream = await fetch(
      `${GHOSTAGENT_LOOKUP}?agent=${encodeURIComponent(agent)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (upstream.ok) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch { /* fall through to worker fallback */ }

  // ── Fallback: Cloudflare KV worker ───────────────────────────────────────
  try {
    const wRes  = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
      signal:  AbortSignal.timeout(10000),
    });
    const wData = await wRes.json() as {
      name?: string;
      erc8004?: { gnosis?: { agentId?: number }; base?: { agentId?: number } };
    };
    const agentId = wData?.erc8004?.gnosis?.agentId ?? wData?.erc8004?.base?.agentId ?? null;
    if (agentId != null) {
      return NextResponse.json({ registered: true, erc8004AgentId: agentId, source: 'worker-kv' });
    }
    return NextResponse.json({ registered: false, erc8004AgentId: null, source: 'worker-kv' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `All upstreams failed: ${String(e)}` }, { status: 502 });
  }
}
