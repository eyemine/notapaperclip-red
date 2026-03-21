/**
 * GET /api/agent-lookup?email=ghostagent_@nftmail.box
 *
 * Full 4-step agent email resolution pipeline:
 *   1. Validate underscore suffix format
 *   2. NFTmail KV → Safe address
 *   3. ERC-8004 on-chain scan → agentId
 *   4. KV → alignment score
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveAgentEmail } from '@/app/lib/agent-email-resolution';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter', status: 'error', resolvedAt: Date.now() }, { status: 400 });
  }

  const result = await resolveAgentEmail(email);

  const httpStatus =
    result.status === 'ok'             ? 200 :
    result.status === 'invalid_format' ? 400 :
    result.status === 'not_found'      ? 404 : 500;

  return NextResponse.json(result, { status: httpStatus });
}
