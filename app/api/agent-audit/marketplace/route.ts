/**
 * GET /api/agent-audit/marketplace?agent={name}
 *
 * Returns the marketplace activity profile for an agent.
 * Includes: listing status, hire/sale history, burn attestations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorMarketplaceActivity } from '@/app/services/marketplace-monitor';

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent')?.toLowerCase().trim();
  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  const profile = await monitorMarketplaceActivity(agent);

  return NextResponse.json(profile, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
