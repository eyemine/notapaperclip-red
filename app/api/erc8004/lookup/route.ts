/**
 * GET /api/erc8004/lookup?safe=0xb7e493e3...
 *
 * Step 2 of agent email resolution:
 * Scans ERC-8004 registries (Gnosis + Base) to find agentId owned by a Safe address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupAgentIdBySafe } from '@/app/lib/agent-email-resolution';

export async function GET(req: NextRequest) {
  const safe = req.nextUrl.searchParams.get('safe')?.trim().toLowerCase();
  if (!safe || !/^0x[a-f0-9]{40}$/.test(safe)) {
    return NextResponse.json({ error: 'Missing or invalid safe address' }, { status: 400 });
  }

  const match = await lookupAgentIdBySafe(safe);

  if (!match) {
    return NextResponse.json({
      registered: false,
      safeAddress: safe,
      error: 'No ERC-8004 agentId found for this Safe address',
    }, { status: 404 });
  }

  return NextResponse.json({
    registered:  true,
    safeAddress: safe,
    agentId:     match.agentId,
    network:     match.network,
    chainId:     match.chainId,
    contract:    match.contract,
    checkedAt:   Date.now(),
  });
}
