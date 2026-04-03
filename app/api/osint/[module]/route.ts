import { NextRequest, NextResponse } from 'next/server';

const GNOSIS_RPC = process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com';
const GNOSISSCAN_API = 'https://api.gnosisscan.io/api';
const BASESCAN_API = 'https://api.basescan.org/api';
const WORKER_URL = process.env.WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';

// ============== TYPES ==============

interface AgentFootprint {
  agent: string;
  onChain: {
    safeAddress: string | null;
    tbaAddress: string | null;
    totalTransactions: number;
    firstSeen: number | null;
    lastSeen: number | null;
    balances: { token: string; amount: string }[];
  };
  offChain: {
    tld: string;
    tier: string;
    totalXdaiBurned: number;
    surgeScore: number;
    mcpServers: string[];
    genomeUrl: string | null;
  };
  exposure: {
    hasPublicEndpoints: boolean;
    hasMCPServers: boolean;
    hasGenomeMetadata: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface AgentRelations {
  agent: string;
  handshakes: Array<{
    peer: string;
    status: string;
    timestamp: number;
  }>;
  sharedSafes: string[];
  networkSize: number;
  centrality: number;
}

interface ExposureReport {
  agent: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exposures: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  score: number;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'agent' | 'safe' | 'mcp' | 'contract';
    tier?: string;
    riskScore?: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

interface CrossPlatformIdentity {
  primaryIdentity: string;
  correlatedIdentities: Array<{
    platform: string;
    handle: string;
    confidence: number;
    verified: boolean;
  }>;
}

interface ReconReport {
  target: string;
  modules: Record<string, any>;
  timestamp: number;
}

interface RiskAssessment {
  agent: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: Array<{
    category: string;
    risk: string;
    severity: string;
    impact: string;
    likelihood: number;
  }>;
  recommendations: string[];
}

interface DigitalExhaust {
  agent: string;
  transactionPatterns: {
    totalTxs: number;
    avgTxsPerDay: number;
    chains: Array<{ chain: string; txCount: number; volume: number }>;
  };
  contractInteractions: {
    topContracts: Array<{ address: string; name: string; count: number }>;
  };
  moltHistory: Array<{
    date: number;
    from: string;
    to: string;
    cost: number;
  }>;
}

interface ReputationScore {
  agent: string;
  overallScore: number;
  tier: string;
  breakdown: Record<string, { score: number; weight: number }>;
  badges: string[];
}

interface MonitoringReport {
  agent: string;
  status: 'normal' | 'anomaly-detected' | 'alert';
  alerts: Array<{
    type: string;
    severity: string;
    timestamp: number;
    description: string;
  }>;
  baseline: Record<string, any>;
  currentActivity: Record<string, any>;
}

// ============== IMPLEMENTATIONS ==============

async function analyzeFootprint(agent: string): Promise<AgentFootprint> {
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
  });
  
  if (!identityRes.ok) throw new Error('Agent not found');
  const identity = await identityRes.json();
  
  let onChainData = {
    safeAddress: identity.safeAddress || null,
    tbaAddress: identity.tbaAddress || null,
    totalTransactions: 0,
    firstSeen: null as number | null,
    lastSeen: null as number | null,
    balances: [] as { token: string; amount: string }[],
  };
  
  if (identity.safeAddress) {
    try {
      const [balanceRes, txRes] = await Promise.all([
        fetch(GNOSIS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [identity.safeAddress, 'latest'],
          }),
        }),
        fetch(`${GNOSISSCAN_API}?module=account&action=txlist&address=${identity.safeAddress}&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken`),
      ]);
      
      const balanceData = await balanceRes.json();
      if (balanceData.result) {
        const xdaiBalance = (BigInt(balanceData.result) / BigInt(10 ** 18)).toString();
        onChainData.balances.push({ token: 'xDAI', amount: xdaiBalance });
      }
      
      const txData = await txRes.json();
      if (txData.status === '1' && Array.isArray(txData.result)) {
        onChainData.totalTransactions = txData.result.length;
        if (txData.result.length > 0) {
          onChainData.firstSeen = parseInt(txData.result[0].timeStamp);
          onChainData.lastSeen = parseInt(txData.result[txData.result.length - 1].timeStamp);
        }
      }
    } catch (error) {
      console.error('Error fetching on-chain data:', error);
    }
  }
  
  const hasPublicEndpoints = identity.mcpServers && identity.mcpServers.length > 0;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (!identity.safeAddress) riskLevel = 'high';
  else if (onChainData.balances.length === 0 || parseFloat(onChainData.balances[0]?.amount || '0') < 1) riskLevel = 'medium';
  
  return {
    agent,
    onChain: onChainData,
    offChain: {
      tld: identity.tld || 'unknown',
      tier: identity.accountTier || identity.tier || 'basic',
      totalXdaiBurned: identity.totalXdaiBurned || 0,
      surgeScore: identity.surgeReputationScore || 0,
      mcpServers: identity.mcpServers || [],
      genomeUrl: identity.genomeUrl || null,
    },
    exposure: {
      hasPublicEndpoints,
      hasMCPServers: hasPublicEndpoints,
      hasGenomeMetadata: !!identity.genomeUrl,
      riskLevel,
    },
  };
}

async function mapRelations(agent: string): Promise<AgentRelations> {
  const [handshakesRes, identityRes] = await Promise.all([
    fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listHandshakes', agentName: agent }),
    }),
    fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
    }),
  ]);
  
  let handshakes: any[] = [];
  if (handshakesRes.ok) {
    const data = await handshakesRes.json();
    handshakes = data.handshakes || [];
  }
  
  let sharedSafes: string[] = [];
  if (identityRes.ok) {
    const identity = await identityRes.json();
    if (identity.safeAddress) sharedSafes.push(identity.safeAddress);
  }
  
  const networkSize = handshakes.length;
  const centrality = Math.min(networkSize / 10, 1);
  
  return {
    agent,
    handshakes: handshakes.map((h: any) => ({
      peer: h.peerAgent || h.peer || 'unknown',
      status: h.status || 'unknown',
      timestamp: h.timestamp || Date.now(),
    })),
    sharedSafes,
    networkSize,
    centrality,
  };
}

async function buildGraph(agent: string, depth: number = 2): Promise<GraphData> {
  const nodes: GraphData['nodes'] = [{ id: agent, label: agent, type: 'agent' }];
  const edges: GraphData['edges'] = [];
  const visited = new Set([agent]);
  
  async function explore(currentAgent: string, currentDepth: number) {
    if (currentDepth <= 0) return;
    
    const [identityRes, handshakesRes] = await Promise.all([
      fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: currentAgent }),
      }).catch(() => null),
      fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listHandshakes', agentName: currentAgent }),
      }).catch(() => null),
    ]);
    
    if (identityRes?.ok) {
      const identity = await identityRes.json();
      
      if (identity.safeAddress && !visited.has(identity.safeAddress)) {
        visited.add(identity.safeAddress);
        nodes.push({ id: identity.safeAddress, label: 'Safe', type: 'safe' });
        edges.push({ source: currentAgent, target: identity.safeAddress, type: 'owns', weight: 1 });
      }
      
      (identity.mcpServers || []).forEach((mcp: string) => {
        if (!visited.has(mcp)) {
          visited.add(mcp);
          nodes.push({ id: mcp, label: 'MCP', type: 'mcp' });
          edges.push({ source: currentAgent, target: mcp, type: 'uses', weight: 0.5 });
        }
      });
    }
    
    if (handshakesRes?.ok) {
      const data = await handshakesRes.json();
      for (const h of (data.handshakes || [])) {
        const peer = h.peerAgent || h.peer;
        if (!peer || visited.has(peer)) continue;
        
        visited.add(peer);
        nodes.push({ id: peer, label: peer, type: 'agent' });
        edges.push({ source: currentAgent, target: peer, type: 'handshake', weight: 0.8 });
        
        await explore(peer, currentDepth - 1);
      }
    }
  }
  
  await explore(agent, depth);
  return { nodes, edges };
}

async function correlateIdentity(handle: string, platforms: string[]): Promise<CrossPlatformIdentity> {
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: handle }),
  });
  
  if (!identityRes.ok) throw new Error('Agent not found');
  const identity = await identityRes.json();
  
  const correlated: CrossPlatformIdentity['correlatedIdentities'] = [];
  
  // Check ERC-8004 across chains
  if (identity.erc8004Ids) {
    Object.entries(identity.erc8004Ids).forEach(([chain, id]: [string, any]) => {
      if (id) {
        correlated.push({
          platform: `erc8004-${chain}`,
          handle: `${handle} (ID: ${id.agentId})`,
          confidence: 100,
          verified: true,
        });
      }
    });
  }
  
  // Check for linked ENS
  if (identity.ownerWallet) {
    correlated.push({
      platform: 'gnosis-safe',
      handle: identity.safeAddress || 'unknown',
      confidence: 100,
      verified: true,
    });
  }
  
  // A2A card cross-reference
  if (identity.a2aCardUrl) {
    correlated.push({
      platform: 'a2a-protocol',
      handle: handle,
      confidence: 90,
      verified: true,
    });
  }
  
  return {
    primaryIdentity: `${handle}.${identity.tld || 'gno'}`,
    correlatedIdentities: correlated,
  };
}

async function runRecon(target: string, modules: string[]): Promise<ReconReport> {
  const results: Record<string, any> = {};
  
  if (modules.includes('basic') || modules.includes('dns')) {
    results.dns = {
      mcpEndpoints: [],
      ipfsGateways: ['https://gateway.lighthouse.storage/ipfs/'],
    };
  }
  
  if (modules.includes('basic') || modules.includes('crypto')) {
    const identityRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: target }),
    });
    
    if (identityRes.ok) {
      const identity = await identityRes.json();
      results.crypto = {
        safeAddress: identity.safeAddress,
        tbaAddress: identity.tbaAddress,
        nfts: [],
      };
    }
  }
  
  if (modules.includes('basic') || modules.includes('blockchain')) {
    results.blockchain = {
      chains: ['gnosis', 'base', 'base-sepolia'],
      erc8004Registered: true,
    };
  }
  
  return {
    target,
    modules: results,
    timestamp: Date.now(),
  };
}

async function checkExposure(agent: string): Promise<ExposureReport> {
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
  });
  
  if (!identityRes.ok) throw new Error('Agent not found');
  const identity = await identityRes.json();
  
  const exposures: Array<{ type: string; severity: string; description: string }> = [];
  let score = 100;
  
  if (!identity.safeAddress) {
    exposures.push({ type: 'no-safe', severity: 'high', description: 'Agent has no Gnosis Safe address registered' });
    score -= 30;
  } else {
    try {
      const balanceRes = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [identity.safeAddress, 'latest'],
        }),
      });
      
      const balanceData = await balanceRes.json();
      if (balanceData.result) {
        const xdaiBalance = Number(BigInt(balanceData.result) / BigInt(10 ** 18));
        if (xdaiBalance < 1) {
          exposures.push({ type: 'low-balance', severity: 'medium', description: `Safe balance is low (${xdaiBalance.toFixed(2)} xDAI)` });
          score -= 15;
        }
      }
    } catch (error) {
      console.error('Error checking balance:', error);
    }
  }
  
  if (!identity.genomeUrl) {
    exposures.push({ type: 'no-genome', severity: 'low', description: 'Agent has no genome metadata URL' });
    score -= 10;
  }
  
  if (identity.mcpServers?.length > 0) {
    exposures.push({ type: 'public-endpoints', severity: 'low', description: `Agent has ${identity.mcpServers.length} public MCP endpoints` });
    score -= 5;
  }
  
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score < 40) riskLevel = 'critical';
  else if (score < 60) riskLevel = 'high';
  else if (score < 80) riskLevel = 'medium';
  
  return { agent, riskLevel, exposures, score: Math.max(0, score) };
}

async function assessRisk(agent: string): Promise<RiskAssessment> {
  const [footprint, exposure, relations] = await Promise.all([
    analyzeFootprint(agent),
    checkExposure(agent),
    mapRelations(agent),
  ]);
  
  const factors: RiskAssessment['factors'] = [];
  
  if (!footprint.onChain.safeAddress) {
    factors.push({ category: 'security', risk: 'No Safe address', severity: 'high', impact: 'No on-chain identity', likelihood: 100 });
  }
  
  if (exposure.score < 60) {
    factors.push({ category: 'security', risk: 'Low security score', severity: 'medium', impact: 'Multiple exposures detected', likelihood: 80 });
  }
  
  if (relations.networkSize === 0) {
    factors.push({ category: 'social', risk: 'Isolated agent', severity: 'low', impact: 'No A2A handshakes', likelihood: 60 });
  }
  
  const recommendations = [];
  if (exposure.exposures.some(e => e.type === 'no-safe')) recommendations.push('Register a Gnosis Safe for the agent');
  if (exposure.exposures.some(e => e.type === 'low-balance')) recommendations.push('Fund the agent Safe with at least 1 xDAI');
  if (exposure.exposures.some(e => e.type === 'no-genome')) recommendations.push('Upload genome metadata to IPFS');
  
  return {
    agent,
    overallRisk: exposure.riskLevel,
    riskScore: exposure.score,
    factors,
    recommendations,
  };
}

async function analyzeExhaust(agent: string): Promise<DigitalExhaust> {
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
  });
  
  if (!identityRes.ok) throw new Error('Agent not found');
  const identity = await identityRes.json();
  
  const chains = [];
  
  // Gnosis transactions
  if (identity.safeAddress) {
    try {
      const gnosisTx = await fetch(
        `${GNOSISSCAN_API}?module=account&action=txlist&address=${identity.safeAddress}&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken`
      );
      const gnosisData = await gnosisTx.json();
      if (gnosisData.status === '1' && Array.isArray(gnosisData.result)) {
        chains.push({ chain: 'gnosis', txCount: gnosisData.result.length, volume: 0 });
      }
    } catch (e) {}
  }
  
  // Check for Base
  if (identity.erc8004Ids?.base) {
    chains.push({ chain: 'base', txCount: 0, volume: 0 });
  }
  
  // Check for Base Sepolia
  if (identity.erc8004Ids?.baseSepolia) {
    chains.push({ chain: 'base-sepolia', txCount: 0, volume: 0 });
  }
  
  return {
    agent,
    transactionPatterns: {
      totalTxs: chains.reduce((acc, c) => acc + c.txCount, 0),
      avgTxsPerDay: 0,
      chains,
    },
    contractInteractions: {
      topContracts: [],
    },
    moltHistory: [],
  };
}

async function calculateReputation(agent: string): Promise<ReputationScore> {
  const [footprint, relations, exhaust] = await Promise.all([
    analyzeFootprint(agent),
    mapRelations(agent),
    analyzeExhaust(agent).catch(() => null),
  ]);
  
  const longevity = footprint.onChain.firstSeen ? (Date.now() / 1000 - footprint.onChain.firstSeen) / 86400 : 0;
  const activity = footprint.onChain.totalTransactions;
  const network = relations.networkSize;
  const financial = footprint.offChain.totalXdaiBurned;
  
  const longevityScore = Math.min(longevity / 30, 1) * 100;
  const activityScore = Math.min(activity / 10, 1) * 100;
  const networkScore = Math.min(network / 5, 1) * 100;
  const financialScore = Math.min(financial / 50, 1) * 100;
  
  const overallScore = Math.round(
    (longevityScore * 0.2) + (activityScore * 0.25) + (networkScore * 0.2) + (financialScore * 0.35)
  );
  
  let tier = 'unverified';
  if (overallScore >= 80) tier = 'elite';
  else if (overallScore >= 60) tier = 'trusted';
  else if (overallScore >= 40) tier = 'established';
  else if (overallScore >= 20) tier = 'emerging';
  
  const badges = [];
  if (longevity > 30) badges.push('Longevity');
  if (network > 3) badges.push('Connected');
  if (financial > 20) badges.push('Committed');
  if (activity > 10) badges.push('Active');
  
  return {
    agent,
    overallScore,
    tier,
    breakdown: {
      longevity: { score: longevityScore, weight: 0.2 },
      activity: { score: activityScore, weight: 0.25 },
      network: { score: networkScore, weight: 0.2 },
      financial: { score: financialScore, weight: 0.35 },
    },
    badges,
  };
}

async function monitorAgent(agent: string, alerts: boolean): Promise<MonitoringReport> {
  const [footprint, relations] = await Promise.all([
    analyzeFootprint(agent),
    mapRelations(agent),
  ]);
  
  const alertsList: MonitoringReport['alerts'] = [];
  
  if (footprint.onChain.balances.length === 0 || parseFloat(footprint.onChain.balances[0]?.amount || '0') < 0.1) {
    alertsList.push({ type: 'low-balance', severity: 'warning', timestamp: Date.now(), description: 'Safe balance critically low' });
  }
  
  if (relations.networkSize === 0) {
    alertsList.push({ type: 'isolated', severity: 'info', timestamp: Date.now(), description: 'Agent has no network connections' });
  }
  
  return {
    agent,
    status: alertsList.length > 0 ? 'alert' : 'normal',
    alerts: alertsList,
    baseline: {
      avgTxsPerDay: footprint.onChain.totalTransactions / 30,
      avgTransferSize: 0,
      typicalActivity: 'standard',
    },
    currentActivity: {
      txsToday: 0,
      largestTransfer: 0,
      anomalyScore: alertsList.length * 20,
    },
  };
}

// ============== AGENT RESOLVER ==============

async function resolveAgentIdentifier(raw: string): Promise<string> {
  const v = raw.trim();
  if (!v) throw new Error('Empty agent identifier');
  
  // Strip leading # and treat as numeric token ID / ERC-8004 ID
  const stripped = v.replace(/^#/, '');
  if (/^\d+$/.test(stripped)) {
    // Look up agent by ERC-8004 ID
    const listRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listAgents' }),
    });
    if (!listRes.ok) throw new Error('Failed to list agents');
    const data = await listRes.json();
    const agents = data.agents || [];
    
    // Search through agents for matching ID on any chain
    for (const agent of agents) {
      const identityRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
      });
      if (!identityRes.ok) continue;
      const identity = await identityRes.json();
      
      // Check all chains for matching agentId
      const chains = ['gnosis', 'base', 'baseSepolia'];
      for (const chain of chains) {
        if (identity.erc8004Ids?.[chain]?.agentId === parseInt(stripped)) {
          return agent;
        }
      }
    }
    throw new Error(`No agent found with ERC-8004 ID #${stripped}`);
  }
  
  // Agent email: [name]_@nftmail.box
  if (v.includes('_@nftmail.box')) {
    const res = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: v.replace('_@nftmail.box', '') }),
    });
    if (!res.ok) throw new Error('Agent email not found');
    const identity = await res.json();
    if (identity.email === v || identity.email?.toLowerCase() === v.toLowerCase()) {
      return v.replace('_@nftmail.box', '');
    }
    // Fallback: just return the name part
    return v.replace('_@nftmail.box', '');
  }
  
  // Regular agent name - verify it exists
  const identityRes = await fetch(`${WORKER_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAgentIdentity', agentName: v }),
  });
  if (!identityRes.ok) throw new Error(`Agent "${v}" not found`);
  return v;
}

// ============== ROUTE HANDLER ==============

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> }
) {
  const { module } = await params;
  const { searchParams } = new URL(request.url);
  const rawAgent = searchParams.get('agent') || searchParams.get('target') || searchParams.get('handle') || searchParams.get('agentId');
  
  if (!rawAgent) {
    return NextResponse.json({ error: 'Missing agent parameter (use agent, target, handle, or agentId)' }, { status: 400 });
  }
  
  try {
    // Resolve the agent identifier (handles #ID, email, or name)
    const agent = await resolveAgentIdentifier(rawAgent);
    let result;
    
    switch (module) {
      case 'footprint':
        result = await analyzeFootprint(agent);
        break;
      case 'relations':
        result = await mapRelations(agent);
        break;
      case 'graph':
        const depth = parseInt(searchParams.get('depth') || '2');
        result = await buildGraph(agent, depth);
        break;
      case 'correlate':
        const platforms = (searchParams.get('platforms') || 'all').split(',');
        result = await correlateIdentity(agent, platforms);
        break;
      case 'recon':
        const modules = (searchParams.get('modules') || 'basic').split(',');
        result = await runRecon(agent, modules);
        break;
      case 'exposure':
        result = await checkExposure(agent);
        break;
      case 'risk':
        result = await assessRisk(agent);
        break;
      case 'exhaust':
        result = await analyzeExhaust(agent);
        break;
      case 'reputation':
        result = await calculateReputation(agent);
        break;
      case 'monitor':
        const alerts = searchParams.get('alerts') === 'true';
        result = await monitorAgent(agent, alerts);
        break;
      default:
        return NextResponse.json({ error: `Invalid module: ${module}. Valid modules: footprint, relations, graph, correlate, recon, exposure, risk, exhaust, reputation, monitor` }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`OSINT ${module} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
