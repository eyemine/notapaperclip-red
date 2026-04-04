/**
 * x402 Client - HTTP 402 Payment Required Protocol Probe
 * 
 * Probes agent endpoints for x402 payment capabilities.
 * x402 is an emerging standard for crypto micropayments over HTTP.
 */

export interface X402ProbeResult {
  url: string;
  x402Enabled: boolean;
  paymentRequired: boolean;
  paymentMethods?: string[];
  minAmount?: string;
  destinationAddress?: string;
  supportedTokens?: string[];
  probeStatus: 'available' | 'payment_required' | 'not_supported' | 'error';
  error?: string;
  responseTime?: number;
}

export interface AgentX402Profile {
  agent: string;
  x402Support: boolean;
  paymentEndpoints: Array<{
    url: string;
    supportsX402: boolean;
    methods: string[];
  }>;
  supportedChains: string[];
  rateLimits: {
    requestsPerMinute: number;
    hasRateLimiting: boolean;
  };
  economicActivity: {
    averagePaymentSize: number | null;
    successRate: number | null;
    totalTransactions: number | null;
  };
  micropaymentReady: boolean;
  timestamp: string;
}

/**
 * Probe an endpoint for x402 payment requirements
 */
export async function probeX402Endpoint(url: string): Promise<X402ProbeResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-402-Probe': 'true',
        'User-Agent': 'notapaperclip-x402-probe/1.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;
    
    // Check for HTTP 402 Payment Required
    if (response.status === 402) {
      const paymentInfo = response.headers.get('X-Payment-Required');
      const acceptPayment = response.headers.get('X-Accept-Payment');
      const paymentChain = response.headers.get('X-Payment-Chain');
      
      let parsedInfo: any = {};
      try {
        if (paymentInfo) {
          parsedInfo = JSON.parse(paymentInfo);
        }
      } catch {
        // Header wasn't valid JSON, use raw string
        parsedInfo = { raw: paymentInfo };
      }
      
      // Merge chains from X-Payment-Chain header into payment methods for chain detection
      const chainMethods = paymentChain ? paymentChain.split(',').map(s => s.trim()) : [];
      const methods = acceptPayment ? acceptPayment.split(',').map(s => s.trim()) : parsedInfo.methods || [];
      
      return {
        url,
        x402Enabled: true,
        paymentRequired: true,
        paymentMethods: [...methods, ...chainMethods],
        minAmount: parsedInfo.minAmount || parsedInfo.amount || response.headers.get('X-Payment-Amount') || undefined,
        destinationAddress: parsedInfo.destination || parsedInfo.address || response.headers.get('X-Payment-Destination') || undefined,
        supportedTokens: parsedInfo.tokens || parsedInfo.supportedTokens,
        probeStatus: 'payment_required',
        responseTime,
      };
    }
    
    // Check for x402 headers even on success (indicates optional payments)
    const x402Version = response.headers.get('X-x402-Version');
    const acceptPayment = response.headers.get('X-Accept-Payment');
    
    if (x402Version || acceptPayment) {
      return {
        url,
        x402Enabled: true,
        paymentRequired: false,
        paymentMethods: acceptPayment ? acceptPayment.split(',').map(s => s.trim()) : [],
        probeStatus: 'available',
        responseTime,
      };
    }
    
    // No x402 support detected
    return {
      url,
      x402Enabled: false,
      paymentRequired: false,
      probeStatus: 'not_supported',
      responseTime,
    };
    
  } catch (error: any) {
    return {
      url,
      x402Enabled: false,
      paymentRequired: false,
      probeStatus: 'error',
      error: error.message || 'Probe failed',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Probe an agent for x402 capabilities
 */
export async function probeAgentX402(agent: string, endpoints?: string[]): Promise<AgentX402Profile> {
  const WORKER_URL = process.env.WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';
  
  // Determine origin for internal API calls (works in both dev and production)
  const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://notapaperclip.red';
  
  // Get agent identity to find endpoints
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
  });
  
  let mcpEndpoints: string[] = endpoints || [];
  let agentCardUrl: string | null = null;
  
  if (identityRes.ok) {
    const identity = await identityRes.json();
    // Use MCP servers as potential x402 endpoints
    if (identity.mcpServers && Array.isArray(identity.mcpServers)) {
      mcpEndpoints = [...mcpEndpoints, ...identity.mcpServers];
    }
    // Use actual agent card URL from worker (not a constructed .gno domain)
    agentCardUrl = identity.links?.agentCard || null;
  }
  
  // Only probe actual agent-owned endpoints from their agent card / MCP servers
  // notapaperclip.red gateway is an analysis proxy, not the agent's own payment endpoint
  
  // Probe all endpoints
  const endpointResults = await Promise.all(
    mcpEndpoints.map(async (url) => {
      const result = await probeX402Endpoint(url);
      return {
        url,
        supportsX402: result.x402Enabled,
        methods: result.paymentMethods || [],
        minAmount: result.minAmount,
        destinationAddress: result.destinationAddress,
      };
    })
  );
  
  // Probe agent card if available
  let agentCardX402: X402ProbeResult | null = null;
  if (agentCardUrl) {
    agentCardX402 = await probeX402Endpoint(agentCardUrl);
  }
  
  // Aggregate results
  const supportedEndpoints = endpointResults.filter(e => e.supportsX402);
  const allMethods = [...new Set(supportedEndpoints.flatMap(e => e.methods))];
  
  // Extract chains from x402 headers (X-Payment-Chain) and payment methods
  const chainCandidates = [...allMethods];
  for (const ep of supportedEndpoints) {
    // The gateway returns chains in the payment info
    if (ep.destinationAddress) chainCandidates.push('gnosis');
  }
  const chains = [...new Set(chainCandidates.filter(m => 
    ['ethereum', 'solana', 'base', 'gnosis', 'polygon'].includes(m.toLowerCase())
  ))];
  
  // Calculate economic metrics (mock for now - would query on-chain)
  const economicActivity = {
    averagePaymentSize: null as number | null,
    successRate: null as number | null,
    totalTransactions: null as number | null,
  };
  
  // Check if micropayment ready (supports small amounts ≤ 0.01)
  const micropaymentReady = supportedEndpoints.some(e => {
    const minAmount = parseFloat(e.minAmount || '0');
    return minAmount > 0 && minAmount <= 0.01;
  });
  
  return {
    agent,
    x402Support: supportedEndpoints.length > 0 || (agentCardX402?.x402Enabled ?? false),
    paymentEndpoints: endpointResults,
    supportedChains: chains.length > 0 ? chains : (supportedEndpoints.length > 0 ? ['gnosis', 'base'] : []),
    rateLimits: {
      requestsPerMinute: 60,
      hasRateLimiting: false,
    },
    economicActivity,
    micropaymentReady,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check agent solvency (mock - would check Safe balance)
 */
export async function checkAgentSolvency(agent: string): Promise<{
  solvent: boolean;
  balance: number | null;
  currency: string;
  minimumRequired: number;
}> {
  const WORKER_URL = process.env.WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';
  const GNOSIS_RPC = process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com';
  
  try {
    const identityRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
    });
    
    if (!identityRes.ok) {
      return { solvent: false, balance: null, currency: 'xDAI', minimumRequired: 1 };
    }
    
    const identity = await identityRes.json();
    const safeAddress = identity.safe;
    
    if (!safeAddress) {
      return { solvent: false, balance: 0, currency: 'xDAI', minimumRequired: 1 };
    }
    
    // Check Safe balance
    const balanceRes = await fetch(GNOSIS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [safeAddress, 'latest'],
      }),
    });
    
    const balanceData = await balanceRes.json();
    if (balanceData.result) {
      const balance = Number(BigInt(balanceData.result) / BigInt(10 ** 18));
      return {
        solvent: balance >= 1,
        balance,
        currency: 'xDAI',
        minimumRequired: 1,
      };
    }
    
    return { solvent: false, balance: null, currency: 'xDAI', minimumRequired: 1 };
    
  } catch (error) {
    return { solvent: false, balance: null, currency: 'xDAI', minimumRequired: 1 };
  }
}

/**
 * Analyze agent's x402 footprint
 */
export async function analyzeX402Footprint(agent: string): Promise<{
  footprintScore: number;
  paymentEndpoints: number;
  supportedChains: number;
  solvencyScore: number;
  overallReadiness: 'ready' | 'partial' | 'not_ready';
}> {
  const [x402Profile, solvency] = await Promise.all([
    probeAgentX402(agent),
    checkAgentSolvency(agent),
  ]);
  
  const activeEndpoints = x402Profile.paymentEndpoints.filter(e => e.supportsX402).length;
  
  // A Safe address on Gnosis IS a valid x402 payment destination (direct xDAI transfer).
  // Agents don't need public MCP endpoints to accept micropayments.
  const hasSafeWallet = solvency.balance !== null; // balance query succeeded → Safe exists
  const impliedChains = hasSafeWallet ? ['gnosis'] : [];
  const detectedChains = x402Profile.supportedChains.length > 0
    ? x402Profile.supportedChains
    : impliedChains;
  
  // Scoring:
  //   Solvency (40pts): agent can pay out — has funded Safe
  //   Payment destination (30pts): has Safe address = can receive payments
  //   Endpoint detection (30pts): public MCP/HTTP endpoints advertise x402
  const solvencyScore    = solvency.solvent ? 40 : (solvency.balance && solvency.balance > 0 ? 20 : 0);
  const destinationScore = hasSafeWallet ? 30 : 0;
  const endpointScore    = Math.min(activeEndpoints * 15, 30);
  const footprintScore   = solvencyScore + destinationScore + endpointScore;
  
  let overallReadiness: 'ready' | 'partial' | 'not_ready' = 'not_ready';
  if (footprintScore >= 70) overallReadiness = 'ready';
  else if (footprintScore >= 40) overallReadiness = 'partial';
  
  return {
    footprintScore,
    paymentEndpoints: activeEndpoints,
    supportedChains: detectedChains.length,
    solvencyScore,
    overallReadiness,
  };
}
