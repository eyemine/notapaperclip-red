/**
 * GET /api/agent-audit/spend?agent={name}
 *
 * Returns the AgentCash + Safe spending profile for an agent.
 * Standalone endpoint for spend-specific monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorAgentSpending } from '@/app/services/agentcash-monitor';

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent')?.toLowerCase().trim();
  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  const profile = await monitorAgentSpending(agent);

  return NextResponse.json(profile, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
