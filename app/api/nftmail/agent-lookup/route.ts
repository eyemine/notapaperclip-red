/**
 * GET /api/nftmail/agent-lookup?email=ghostagent_@nftmail.box
 *
 * Step 1 of agent email resolution:
 * Validates underscore-suffix format then looks up Safe address from NFTmail KV.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentEmail, lookupAgentByEmail } from '@/app/lib/agent-email-resolution';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  }

  const validation = validateAgentEmail(email);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error, valid: false }, { status: 400 });
  }

  const label = validation.label!;
  const agentData = await lookupAgentByEmail(label);

  if (!agentData) {
    return NextResponse.json({
      registered: false,
      email,
      label,
      error: `Agent ${label}_@nftmail.box is not registered`,
    }, { status: 404 });
  }

  return NextResponse.json({
    registered:   true,
    email,
    label,
    safeAddress:  agentData.safe ?? agentData.onChainOwner,
    originNft:    agentData.originNft,
    accountTier:  agentData.accountTier,
    checkedAt:    Date.now(),
  });
}
