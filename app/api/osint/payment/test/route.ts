import { NextRequest, NextResponse } from 'next/server';

interface X402Response {
  x402: {
    enabled: boolean;
    micropaymentReady: boolean;
    supportedChains: string[];
    paymentEndpoints: Array<{ url: string; supportsX402: boolean; methods: string[] }>;
  };
  solvency: {
    solvent: boolean;
    balance: number | null;
    currency: string;
    minimumRequired: number;
  };
  footprint: {
    score: number;
    readiness: 'ready' | 'partial' | 'not_ready';
  };
}

interface FootprintResponse {
  onChain: {
    safeAddress: string | null;
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
  const amountRaw = searchParams.get('amount') || '0.01';
  const chain = searchParams.get('chain');

  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount parameter' }, { status: 400 });
  }

  const encoded = encodeURIComponent(agent);
  const chainParam = chain ? `&chain=${encodeURIComponent(chain)}` : '';

  const [x402, footprint] = await Promise.all([
    getJson<X402Response>(`${origin}/api/x402/probe?agent=${encoded}${chainParam}`),
    getJson<FootprintResponse>(`${origin}/api/osint/footprint?agent=${encoded}${chainParam}`),
  ]);

  if (!x402 || !footprint) {
    return NextResponse.json({ error: 'Failed to resolve agent payment profile' }, { status: 404 });
  }

  const hasSafeDestination = !!footprint.onChain.safeAddress;
  const hasEndpointDestination = x402.x402.paymentEndpoints.some((ep) => ep.supportsX402);
  const hasDestination = hasSafeDestination || hasEndpointDestination;

  const balance = x402.solvency.balance || 0;
  const sufficientBalance = balance >= amount;

  let successProbability = 0;
  if (hasDestination) successProbability += 40;
  if (x402.x402.enabled) successProbability += 20;
  if (x402.x402.micropaymentReady) successProbability += 20;
  if (sufficientBalance) successProbability += 20;
  successProbability = Math.min(99, Math.max(5, successProbability));

  const recommendedMethod = hasSafeDestination
    ? 'direct-transfer'
    : hasEndpointDestination
      ? 'http-x402'
      : 'none';

  const supportedChains = x402.x402.supportedChains.length > 0
    ? x402.x402.supportedChains
    : (hasSafeDestination ? ['gnosis'] : []);

  const destinationAddress = hasSafeDestination ? footprint.onChain.safeAddress : null;

  const expectedFee = Math.max(0.00001, amount * 0.005); // heuristic: 0.5% floor

  return NextResponse.json({
    agent,
    test: {
      amount,
      currency: x402.solvency.currency,
      canAttemptNow: hasDestination,
      successProbability,
      recommendedMethod,
      expectedFee,
      estimatedSettlementSeconds: recommendedMethod === 'http-x402' ? 8 : 30,
      supportedChains,
      destinationAddress,
      paymentUrl: destinationAddress
        ? `gnosis:${destinationAddress}?value=${amount}`
        : null,
    },
    diagnostics: {
      hasSafeDestination,
      hasEndpointDestination,
      x402Enabled: x402.x402.enabled,
      micropaymentReady: x402.x402.micropaymentReady,
      solvency: x402.solvency,
      readinessScore: x402.footprint.score,
    },
  });
}
