import { NextRequest, NextResponse } from 'next/server';

type JsonRecord = Record<string, unknown>;

const enhancedRateLimiter = new Map<string, number>();

function isRateLimited(agent: string): boolean {
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  const key = `${agent}:${minuteBucket}`;
  const count = enhancedRateLimiter.get(key) || 0;

  if (count >= 10) return true;

  enhancedRateLimiter.set(key, count + 1);
  return false;
}

async function fetchJson(
  url: string,
  timeoutMs = 3000,
): Promise<JsonRecord | null> {
  try {
    const response = await Promise.race([
      fetch(url, { headers: { Accept: 'application/json' } }),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);

    if (!response.ok) return null;
    return (await response.json()) as JsonRecord;
  } catch {
    return null;
  }
}

async function getBaselineData(
  origin: string,
  agent: string,
  chain?: string,
): Promise<JsonRecord | null> {
  const encodedAgent = encodeURIComponent(agent);
  const chainParam = chain ? `&chain=${encodeURIComponent(chain)}` : '';

  const [footprint, relations, exposure, x402] = await Promise.all([
    fetchJson(`${origin}/api/osint/footprint?agent=${encodedAgent}${chainParam}`, 3500),
    fetchJson(`${origin}/api/osint/relations?agent=${encodedAgent}${chainParam}`, 3500),
    fetchJson(`${origin}/api/osint/exposure?agent=${encodedAgent}${chainParam}`, 3500),
    fetchJson(`${origin}/api/x402/probe?agent=${encodedAgent}${chainParam}`, 3500),
  ]);

  if (!footprint) return null;

  return {
    agent,
    footprint,
    relations,
    exposure,
    x402,
    status: 'basic',
  };
}

async function getEnhancedDataSafely(
  origin: string,
  agent: string,
  chain?: string,
): Promise<JsonRecord | null> {
  if (isRateLimited(agent)) {
    return { status: 'rate_limited' };
  }

  const encodedAgent = encodeURIComponent(agent);
  const chainParam = chain ? `&chain=${encodeURIComponent(chain)}` : '';

  const [recon, monitor, risk, reputation] = await Promise.all([
    fetchJson(`${origin}/api/osint/recon?agent=${encodedAgent}${chainParam}&modules=basic`, 5000),
    fetchJson(`${origin}/api/osint/monitor?agent=${encodedAgent}${chainParam}`, 5000),
    fetchJson(`${origin}/api/osint/risk?agent=${encodedAgent}${chainParam}`, 5000),
    fetchJson(`${origin}/api/osint/reputation?agent=${encodedAgent}${chainParam}`, 5000),
  ]);

  const hasAnyEnhancedData = !!(recon || monitor || risk || reputation);
  if (!hasAnyEnhancedData) return null;

  return {
    status: 'available',
    recon,
    monitor,
    risk,
    reputation,
  };
}

function getMinimalBaseline(agent: string): JsonRecord {
  return {
    agent,
    footprint: {
      onChain: {
        safeAddress: null,
        tbaAddress: null,
        totalTransactions: 0,
        balances: [],
      },
      offChain: {
        tld: 'unknown',
        tier: 'unknown',
        gnsName: null,
        mcpServers: [],
      },
      exposure: {
        hasPublicEndpoints: false,
        hasGNSName: false,
        hasX402Capability: false,
        riskLevel: 'high',
      },
    },
    relations: null,
    exposure: null,
    x402: null,
    status: 'basic',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const agent = searchParams.get('agent');
  const chain = searchParams.get('chain') || undefined;
  const depth = (searchParams.get('depth') || 'basic').toLowerCase();

  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  try {
    const baseline = await getBaselineData(origin, agent, chain);

    if (!baseline) {
      return NextResponse.json({
        agent,
        status: 'analysis_unavailable',
        baseline_data: getMinimalBaseline(agent),
      });
    }

    if (depth === 'enhanced') {
      const enhanced = await getEnhancedDataSafely(origin, agent, chain);
      return NextResponse.json({
        ...baseline,
        enhanced: enhanced || { status: 'unavailable' },
        reliability: 'high',
      });
    }

    return NextResponse.json(baseline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({
      agent,
      status: 'analysis_unavailable',
      baseline_data: getMinimalBaseline(agent),
      error: message,
    });
  }
}
