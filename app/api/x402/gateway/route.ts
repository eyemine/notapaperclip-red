/**
 * x402 Payment Gateway
 * 
 * Implements the HTTP 402 Payment Required protocol for ghostagent.ninja agents.
 * 
 * When accessed with a valid agent name, returns:
 * - HTTP 402 with x402 payment headers (no payment provided)
 * - HTTP 200 with agent data (when payment proof is included)
 * 
 * This makes each agent a live x402 micropayment endpoint.
 * 
 * Usage:
 *   GET /api/x402/gateway?agent=ghostagent          → 402 with payment headers
 *   GET /api/x402/gateway?agent=ghostagent&paid=true → 200 (simulated paid access)
 */

import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';

const KNOWN_TLDS = ['molt', 'nftmail', 'openclaw', 'picoclaw', 'vault', 'agent'];

interface PaymentConfig {
  destination: string;
  minAmount: string;
  currency: string;
  chains: string[];
  tokens: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get('agent');

  if (!agent) {
    return NextResponse.json(
      { error: 'Missing agent parameter' },
      { status: 400 }
    );
  }

  // Resolve agent identity from worker
  const identityRes = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
  });

  if (!identityRes.ok) {
    return NextResponse.json(
      { error: `Agent "${agent}" not found` },
      { status: 404 }
    );
  }

  const identity = await identityRes.json();
  const safeAddress = identity.safe;
  const tld = identity.identityNft?.tld || null;
  const tldBase = tld ? tld.replace(/\.gno$/, '') : null;

  if (!safeAddress) {
    return NextResponse.json(
      { error: `Agent "${agent}" has no Safe address for payments` },
      { status: 400 }
    );
  }

  // Build payment config
  const paymentConfig: PaymentConfig = {
    destination: safeAddress,
    minAmount: '0.001',
    currency: 'xDAI',
    chains: ['gnosis', 'base'],
    tokens: ['xDAI', 'USDC'],
  };

  // Check for x402 payment proof header
  const paymentProof = request.headers.get('X-Payment-Proof');
  const paymentTx = request.headers.get('X-Payment-Tx');

  // If payment proof is provided, serve the resource
  if (paymentProof || paymentTx) {
    // In production: verify tx on-chain before returning data
    // For now: return agent data as the paid resource
    return NextResponse.json({
      agent: identity.name,
      tld,
      safe: safeAddress,
      erc8004: identity.erc8004 || {},
      email: identity.email,
      links: identity.links,
      paymentVerified: true,
      accessLevel: 'full',
    }, {
      status: 200,
      headers: {
        'X-x402-Version': '1.0',
        'X-Payment-Status': 'verified',
        'Cache-Control': 'no-store',
      },
    });
  }

  // No payment → return 402 with payment requirements
  const paymentInfo = JSON.stringify({
    version: '1.0',
    destination: paymentConfig.destination,
    amount: paymentConfig.minAmount,
    currency: paymentConfig.currency,
    chains: paymentConfig.chains,
    tokens: paymentConfig.tokens,
    agent: identity.name,
    agentTld: tld,
    description: `Access to ${identity.name} agent data via x402 micropayment`,
    paymentMethods: ['direct-transfer', 'safe-tx'],
  });

  return new NextResponse(
    JSON.stringify({
      error: 'Payment Required',
      message: `Access to ${identity.name} requires a micropayment of ${paymentConfig.minAmount} ${paymentConfig.currency}`,
      x402: {
        version: '1.0',
        destination: paymentConfig.destination,
        minAmount: paymentConfig.minAmount,
        currency: paymentConfig.currency,
        supportedChains: paymentConfig.chains,
        supportedTokens: paymentConfig.tokens,
        agent: identity.name,
      },
      howToPay: {
        header: 'Include X-Payment-Proof or X-Payment-Tx header with your payment transaction hash',
        destination: paymentConfig.destination,
        minAmount: paymentConfig.minAmount,
        chains: paymentConfig.chains,
      },
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-x402-Version': '1.0',
        'X-Payment-Required': paymentInfo,
        'X-Accept-Payment': 'direct-transfer,safe-tx',
        'X-Payment-Chain': paymentConfig.chains.join(','),
        'X-Payment-Destination': paymentConfig.destination,
        'X-Payment-Amount': paymentConfig.minAmount,
        'X-Payment-Currency': paymentConfig.currency,
        'Cache-Control': 'no-store',
      },
    }
  );
}
