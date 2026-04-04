import { NextRequest, NextResponse } from 'next/server';

interface FootprintResponse {
  agent: string;
  onChain: {
    safeAddress: string | null;
    balances: Array<{ token: string; amount: string }>;
  };
  exposure: {
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface RelationsResponse {
  networkSize: number;
}

interface X402Response {
  x402: {
    paymentEndpoints: Array<{
      supportsX402: boolean;
      methods: string[];
    }>;
    supportedChains: string[];
  };
  solvency: {
    solvent: boolean;
    balance: number | null;
    currency: string;
  };
  footprint: {
    score: number;
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const agent = searchParams.get('agent');
  const chain = searchParams.get('chain');

  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  const encoded = encodeURIComponent(agent);
  const chainParam = chain ? `&chain=${encodeURIComponent(chain)}` : '';

  const [footprint, relations, x402] = await Promise.all([
    getJson<FootprintResponse>(`${origin}/api/osint/footprint?agent=${encoded}${chainParam}`),
    getJson<RelationsResponse>(`${origin}/api/osint/relations?agent=${encoded}${chainParam}`),
    getJson<X402Response>(`${origin}/api/x402/probe?agent=${encoded}${chainParam}`),
  ]);

  if (!footprint) {
    return NextResponse.json({ error: 'Failed to resolve agent footprint' }, { status: 404 });
  }

  const hasSafe = !!footprint.onChain.safeAddress;
  const canReceive = hasSafe;
  const canSend = !!x402?.solvency?.solvent;
  const balance = x402?.solvency?.balance ?? 0;
  const currency = x402?.solvency?.currency || 'xDAI';
  const suggestedAmount = balance > 5 ? 0.01 : balance > 1 ? 0.005 : balance > 0.2 ? 0.001 : null;

  const endpointMethods = (x402?.x402?.paymentEndpoints || [])
    .filter((ep) => ep.supportsX402)
    .flatMap((ep) => ep.methods || []);

  const paymentMethods = Array.from(new Set([
    ...(hasSafe ? ['direct-transfer'] : []),
    ...endpointMethods,
  ]));

  const supportedChains = (x402?.x402?.supportedChains?.length || 0) > 0
    ? x402!.x402.supportedChains
    : (hasSafe ? ['gnosis'] : []);

  const actionableNow: string[] = [];
  if (canReceive && suggestedAmount) {
    actionableNow.push(`Send ${suggestedAmount} ${currency} to ${footprint.onChain.safeAddress}`);
  }
  if ((x402?.x402?.paymentEndpoints || []).some((ep) => ep.supportsX402)) {
    actionableNow.push('Use public x402 HTTP endpoint with payment headers');
  }
  if (!canReceive) {
    actionableNow.push('No Safe payment destination detected');
  }

  return NextResponse.json({
    agent: footprint.agent,
    summary: canReceive
      ? `Agent can receive payments now via ${hasSafe ? 'Safe direct-transfer' : 'public endpoint'} on ${supportedChains.join(', ') || 'unknown chains'}`
      : 'No active payment destination found yet',
    payments: {
      canReceive,
      canSend,
      walletAddress: footprint.onChain.safeAddress,
      currency,
      suggestedAmount,
      minRecommended: suggestedAmount ? Math.max(suggestedAmount / 5, 0.0005) : null,
      maxRecommended: suggestedAmount ? suggestedAmount * 10 : null,
      supportedChains,
      supportedTokens: ['xDAI', 'USDC'],
      paymentMethods,
      estimatedSettlementSeconds: 30,
      confidence: Math.min(95, Math.max(40, x402?.footprint?.score || 40)),
    },
    operations: {
      riskLevel: footprint.exposure.riskLevel,
      responseEstimateSeconds: (x402?.x402?.paymentEndpoints?.length || 0) > 0 ? 3 : 8,
      publicEndpoints: x402?.x402?.paymentEndpoints?.length || 0,
      networkConnections: relations?.networkSize || 0,
      actionableNow,
    },
  });
}
