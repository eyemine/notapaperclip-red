/**
 * GET /api/verify/swarm?swarmId=ghost-alpha
 * GET /api/verify/swarm?proofHash=0xabc…
 *
 * Alignment watchdog for AI agent swarms.
 * Checks whether agents are staying on-task or going rogue (paperclip maximiser risk).
 * Reads task attestations, swarm membership, and ERC-8004 reputation from Cloudflare KV.
 *
 * KV key schema:
 *   swarm:config:{swarmId}       — swarm configuration
 *   swarm:members:{swarmId}      — active member list
 *   audit:tasks:{swarmId}        — task attestation log (primary)
 *   audit:paperclip:{swarmId}    — legacy key (kept for backward compat)
 *   swarm:coordinator:{swarmId}  — coordinator state
 *   reputation:agent:{agentName} — ERC-8004 reputation history
 *   attestation:{proofHash}      — single proof record (primary)
 *   paperclip:attestation:{hash} — legacy proof key (kept for backward compat)
 */

import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://nftmail-email-worker.richard-159.workers.dev';

async function kvGet(key: string) {
  const res = await fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'kvGet', key }),
  });
  const data = await res.json() as { value?: string };
  return data?.value ? JSON.parse(data.value) : null;
}

export async function GET(req: NextRequest) {
  // ── Single proof hash lookup ───────────────────────────────────────────────
  const proofHash = req.nextUrl.searchParams.get('proofHash')?.toLowerCase();
  if (proofHash) {
    // Try primary key first, fall back to legacy
    const record = await kvGet(`attestation:${proofHash}`) ?? await kvGet(`paperclip:attestation:${proofHash}`);
    if (!record) {
      return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
    }
    return NextResponse.json(record);
  }

  // ── Swarm ID lookup ────────────────────────────────────────────────────────
  const swarmId = req.nextUrl.searchParams.get('swarmId')?.toLowerCase();
  if (!swarmId) {
    return NextResponse.json({ error: 'Missing swarmId or proofHash' }, { status: 400 });
  }

  const [config, members, attestationsPrimary, attestationsLegacy, coordinatorState] = await Promise.all([
    kvGet(`swarm:config:${swarmId}`),
    kvGet(`swarm:members:${swarmId}`),
    kvGet(`audit:tasks:${swarmId}`),
    kvGet(`audit:paperclip:${swarmId}`),
    kvGet(`swarm:coordinator:${swarmId}`),
  ]);
  // Merge both keys; primary takes precedence, legacy is fallback
  const attestations = attestationsPrimary ?? attestationsLegacy;

  const memberList: Array<{ address: string; agentName: string; joinedAt: number }> =
    members ?? coordinatorState?.agents ?? [];

  const reputationMap: Record<string, unknown> = {};
  await Promise.all(
    memberList.map(async (m) => {
      const key = m.agentName?.toLowerCase() ?? m.address?.toLowerCase();
      if (!key) return;
      reputationMap[key] = await kvGet(`reputation:agent:${key}`);
    })
  );

  const attestationList: Array<{ verified?: boolean; proofHash?: string }> = attestations ?? [];
  const verifiedAttestations = attestationList.filter(a => a.verified);
  const hasMinMembers        = memberList.length >= 2;
  const hasVerifiedProof     = attestationList.length > 0;
  const allMembersHaveRep    = memberList.length > 0 && memberList.every(m => {
    const key = m.agentName?.toLowerCase() ?? m.address?.toLowerCase();
    return !!reputationMap[key];
  });

  const verifiedSwarm = hasMinMembers && hasVerifiedProof;
  const fullyVerified = hasMinMembers && hasVerifiedProof && allMembersHaveRep;

  return NextResponse.json({
    swarmId,
    verified:       verifiedSwarm,
    fullyVerified,
    badge:          fullyVerified ? 'Verified Swarm ✓' : verifiedSwarm ? 'Swarm Active' : 'Unverified',
    criteria: { hasMinMembers, hasVerifiedProof, allMembersHaveRep },
    memberCount:    memberList.length,
    members:        memberList,
    attestations:   attestationList,
    verifiedProofs: verifiedAttestations.length,
    reputation:     reputationMap,
    config:         config ?? null,
    checkedAt:      Date.now(),
  });
}
