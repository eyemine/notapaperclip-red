import { NextRequest, NextResponse } from 'next/server';

interface FootprintResponse {
  agent: string;
  dataSource: string;
  onChain: {
    safeAddress: string | null;
    tbaAddress: string | null;
    balances: Array<{ token: string; amount: string }>;
    erc8004Registrations: Array<{ chain: string; agentId: number; agentURI: string | null }>;
  };
  offChain: {
    tld: string;
    tier: string;
    gnsName: string | null;
    hasX402Capability: boolean;
    mcpServers: string[];
    emailAddress: string | null;
    agentCardUrl: string | null;
  };
}

interface ExposureResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  exposures: Array<{ type: string; severity: string; description: string }>;
}

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
  };
  footprint: {
    score: number;
    readiness: 'ready' | 'partial' | 'not_ready';
  };
}

interface ActionableResponse {
  summary: string;
  payments: {
    canReceive: boolean;
    canSend: boolean;
    walletAddress: string | null;
    suggestedAmount: number | null;
    paymentMethods: string[];
    supportedChains: string[];
    confidence: number;
  };
  operations: {
    actionableNow: string[];
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

  const [footprint, exposure, x402, actionable] = await Promise.all([
    getJson<FootprintResponse>(`${origin}/api/osint/footprint?agent=${encoded}${chainParam}`),
    getJson<ExposureResponse>(`${origin}/api/osint/exposure?agent=${encoded}${chainParam}`),
    getJson<X402Response>(`${origin}/api/x402/probe?agent=${encoded}${chainParam}`),
    getJson<ActionableResponse>(`${origin}/api/osint/actionable?agent=${encoded}${chainParam}`),
  ]);

  if (!footprint) {
    return NextResponse.json({ error: 'Failed to resolve agent footprint' }, { status: 404 });
  }

  return NextResponse.json({
    agent: footprint.agent,
    scrapedAt: new Date().toISOString(),
    structured: {
      identity: {
        dataSource: footprint.dataSource,
        safeAddress: footprint.onChain.safeAddress,
        tbaAddress: footprint.onChain.tbaAddress,
        gnsName: footprint.offChain.gnsName,
        tld: footprint.offChain.tld,
        tier: footprint.offChain.tier,
        erc8004Registrations: footprint.onChain.erc8004Registrations,
      },
      payment: {
        enabled: x402?.x402.enabled ?? false,
        micropaymentReady: x402?.x402.micropaymentReady ?? false,
        solvency: x402?.solvency || null,
        readinessScore: x402?.footprint.score ?? 0,
        readiness: x402?.footprint.readiness ?? 'not_ready',
        supportedChains: x402?.x402.supportedChains ?? [],
        paymentEndpoints: (x402?.x402.paymentEndpoints || []).map((ep) => ({
          url: ep.url,
          supportsX402: ep.supportsX402,
          methods: ep.methods,
        })),
      },
      actionable: actionable || null,
      exposure: exposure || null,
      links: {
        agentCardUrl: footprint.offChain.agentCardUrl,
        mcpServers: footprint.offChain.mcpServers,
      },
    },
  });
}
