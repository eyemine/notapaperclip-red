import { NextRequest, NextResponse } from 'next/server';

const GNOSIS_RPC = process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com';
const GNOSISSCAN_API = 'https://api.gnosisscan.io/api';
const BASESCAN_API = 'https://api.basescan.org/api';
const WORKER_URL = process.env.WORKER_URL || 'https://nftmail-email-worker.richard-159.workers.dev';
const GHOSTAGENT_LOOKUP_URL = 'https://ghostagent.ninja/api/agent-lookup';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// ERC-8004 supported chains for universal agent lookup
const ERC8004_CHAINS: Record<string, { name: string; rpc: string; chainId: number }> = {
  gnosis: { name: 'Gnosis', rpc: 'https://rpc.gnosischain.com', chainId: 100 },
  base: { name: 'Base', rpc: 'https://mainnet.base.org', chainId: 8453 },
  'base-sepolia': { name: 'Base Sepolia', rpc: 'https://sepolia.base.org', chainId: 84532 },
};

// ============== TYPES ==============

interface AgentFootprint {
  agent: string;
  dataSource: 'worker-kv' | 'ghostagent-api' | 'erc8004-registry' | 'on-chain' | 'minimal' | 'none';
  onChain: {
    safeAddress: string | null;
    tbaAddress: string | null;
    tbaDeployed: boolean;
    totalTransactions: number;
    firstSeen: number | null;
    lastSeen: number | null;
    balances: { token: string; amount: string }[];
    erc8004Registrations: Array<{
      chain: string;
      agentId: number;
      agentURI: string | null;
    }>;
  };
  offChain: {
    tld: string;
    tier: string;
    totalXdaiBurned: number;
    surgeScore: number;
    mcpServers: string[];
    gnsName: string | null;
    hasX402Capability: boolean;
    emailAddress: string | null;
    agentCardUrl: string | null;
  };
  exposure: {
    hasPublicEndpoints: boolean;
    hasMCPServers: boolean;
    hasGNSName: boolean;
    hasX402Capability: boolean;
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
  meta?: {
    totalEvents: number;
    dataSource: string;
    coverage: string[];
    correlations: Array<{ type: string; entities: string[]; confidence: number }>;
  };
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

// ============== ERC-8004 ON-CHAIN REGISTRY LOOKUP ==============
// Encode tokenURI(uint256) call
function encodeTokenURICall(agentId: number): string {
  const selector = 'c87b56dd';
  return `0x${selector}${agentId.toString(16).padStart(64, '0')}`;
}

// Decode ABI-encoded string return value
function decodeStringReturn(hex: string): string {
  const data = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (data.length < 128) return '';
  const length = parseInt(data.slice(64, 128), 16);
  if (length === 0) return '';
  return Buffer.from(data.slice(128, 128 + length * 2), 'hex').toString('utf8');
}

// Parse 8004agents.ai URL → { chain, agentId } or null
function parse8004Url(input: string): { chain: string; agentId: number } | null {
  const m = /8004agents\.ai\/([^/]+)\/agent\/(\d+)/.exec(input);
  if (m) return { chain: m[1].toLowerCase(), agentId: parseInt(m[2]) };
  // Also accept erc8004:{chain}:{agentId} internal encoding
  const m2 = /^erc8004:([^:]+):(\d+)$/.exec(input);
  if (m2) return { chain: m2[1], agentId: parseInt(m2[2]) };
  return null;
}

// Fetch agent card from ERC-8004 registry on-chain → synthetic identity object
async function lookupErc8004Registry(chainKey: string, agentId: number): Promise<any | null> {
  const chain = ERC8004_CHAINS[chainKey] || ERC8004_CHAINS['gnosis'];
  try {
    const res = await fetch(chain.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: ERC8004_REGISTRY, data: encodeTokenURICall(agentId) }, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json() as { result?: string };
    if (!json.result || json.result === '0x') return null;

    const agentURI = decodeStringReturn(json.result);
    if (!agentURI) return null;

    let card: any = { agentId, chain: chainKey, agentURI, source: 'erc8004-registry' };

    // Inline data URI
    if (agentURI.startsWith('data:')) {
      try {
        const b64 = agentURI.split(',')[1];
        const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        card = { ...card, ...parsed };
      } catch {}
      return card;
    }

    // Remote URI
    try {
      const cardRes = await fetch(agentURI, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (cardRes.ok) {
        const parsed = await cardRes.json();
        card = { ...card, ...parsed };
      }
    } catch {}

    return card;
  } catch {
    return null;
  }
}

// ============== IMPLEMENTATIONS ==============

async function analyzeFootprint(agent: string): Promise<AgentFootprint> {
  let identity: any = null;
  let dataSource: AgentFootprint['dataSource'] = 'none';
  let tbaAddress: string | null = null;

  // ─── PHASE 0: ERC-8004 direct registry (8004agents.ai URL, #ID, erc8004:chain:id) ───
  const erc8004Parsed = parse8004Url(agent);
  if (erc8004Parsed) {
    const card = await lookupErc8004Registry(erc8004Parsed.chain, erc8004Parsed.agentId);
    if (card) {
      identity = {
        exists: true,
        safe: card.safe || card.safeAddress || null,
        tbaAddress: null,
        identityNft: null,
        tld: card.tld || null,
        links: { agentCard: card.agentURI || null, ...(card.links || {}) },
        mcpServers: card.mcpServers || card.tools?.map((t: any) => t.url).filter(Boolean) || [],
        genomeUrl: card.genomeUrl || null,
        accountTier: card.tier || 'basic',
        tier: card.tier || 'basic',
        totalXdaiBurned: 0,
        surgeReputationScore: 0,
        erc8004: { [erc8004Parsed.chain]: { agentId: erc8004Parsed.agentId, agentURI: card.agentURI } },
        email: card.email || null,
        name: card.name || `agent#${erc8004Parsed.agentId}`,
      };
      dataSource = 'erc8004-registry';
    }
  }

  // ─── PHASE 1: ghostagent.ninja agent-lookup — always try for TBA even if Phase 0 set identity ───
  try {
    const lookupRes = await fetch(`${GHOSTAGENT_LOOKUP_URL}?q=${encodeURIComponent(agent)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (lookupRes.ok) {
      const lookupData = await lookupRes.json();
      if (lookupData.exists) {
        if (!identity) {
          identity = lookupData;
          dataSource = 'ghostagent-api';
        }
        // Always take TBA from ghostagent API — it does on-chain derivation
        tbaAddress = lookupData.tbaAddress || tbaAddress;
      }
    }
  } catch {
    // non-fatal
  }

  // ─── PHASE 2: Fallback to worker KV if ghostagent API didn't return data ───
  if (!identity && !erc8004Parsed) {
    try {
      const identityRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
      });
      if (identityRes.ok) {
        identity = await identityRes.json();
        dataSource = 'worker-kv';
      }
    } catch (e) {
      console.log('Worker KV lookup failed');
    }
  }

  // ─── PHASE 3: Minimal identity for agents with no blockchain data ───
  if (!identity) {
    dataSource = 'minimal';
    identity = {
      exists: false,
      safe: null,
      identityNft: null,
      links: {},
      mcpServers: [],
      genomeUrl: null,
      accountTier: 'unknown',
      tier: 'unknown',
      totalXdaiBurned: 0,
      surgeReputationScore: 0,
      erc8004: null,
      email: null,
    };
  }

  // Extract fields from identity (works for both ghostagent-api and worker-kv)
  const safeAddress = identity?.safe || identity?.safeAddress || null;
  const tld = identity?.identityNft?.tld || identity?.tld || null;
  const tldBase = tld ? tld.replace(/\.gno$/, '') : null;
  const agentCardUrl = identity?.links?.agentCard || identity?.agentCardUrl || null;
  const mcpServers: string[] = identity?.mcpServers || [];
  // GNS name = the registered .gno name (e.g. ghostagent.molt.gno)
  // The tld field IS the GNS record — genome in Gnosis ecosystem = GNS identity
  const gnsName = tld ? `${typeof agent === 'string' && !agent.startsWith('erc8004:') ? agent : (identity?.name || 'agent')}.${tld}` : null;
  const genomeUrl = identity?.genomeUrl || identity?.links?.genome || null; // kept for compat
  const emailAddress = identity?.email || identity?.emailAddress || null;

  // ─── PHASE 4: Gather on-chain data ───
  let onChainData = {
    safeAddress,
    tbaAddress,
    tbaDeployed: false,
    totalTransactions: 0,
    firstSeen: null as number | null,
    lastSeen: null as number | null,
    balances: [] as { token: string; amount: string }[],
    erc8004Registrations: [] as AgentFootprint['onChain']['erc8004Registrations'],
  };

  // Safe balance and transaction history
  if (safeAddress) {
    try {
      const [balanceRes, txRes] = await Promise.all([
        fetch(GNOSIS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [safeAddress, 'latest'],
          }),
        }),
        fetch(`${GNOSISSCAN_API}?module=account&action=txlist&address=${safeAddress}&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken`),
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

  // ERC-8004 registrations from identity
  if (identity?.erc8004) {
    Object.entries(identity.erc8004).forEach(([chain, data]: [string, any]) => {
      if (data?.agentId) {
        onChainData.erc8004Registrations.push({
          chain,
          agentId: data.agentId,
          agentURI: data.agentURI || null,
        });
      }
    });
  }

  // Check if TBA is deployed (has code)
  if (tbaAddress) {
    try {
      const codeRes = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getCode',
          params: [tbaAddress, 'latest'],
        }),
      });
      const codeData = await codeRes.json();
      onChainData.tbaDeployed = !!(codeData.result && codeData.result !== '0x');
    } catch {}
  }

  // ─── PHASE 5: Exposure & risk assessment ───
  const KNOWN_TLDS = ['molt', 'nftmail', 'openclaw', 'picoclaw', 'vault', 'agent'];
  const hasX402Capability = !!(tldBase && KNOWN_TLDS.includes(tldBase));
  const hasPublicEndpoints = mcpServers.length > 0;
  
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (!safeAddress && !tbaAddress) riskLevel = 'high';
  else if (onChainData.balances.length === 0 || parseFloat(onChainData.balances[0]?.amount || '0') < 1) riskLevel = 'medium';

  return {
    agent,
    dataSource,
    onChain: onChainData,
    offChain: {
      tld: tld || 'unknown',
      tier: identity?.accountTier || identity?.tier || 'unknown',
      totalXdaiBurned: identity?.totalXdaiBurned || 0,
      surgeScore: identity?.surgeReputationScore || 0,
      mcpServers,
      gnsName,
      hasX402Capability,
      emailAddress,
      agentCardUrl,
    },
    exposure: {
      hasPublicEndpoints,
      hasMCPServers: hasPublicEndpoints,
      hasGNSName: !!tld,
      hasX402Capability,
      riskLevel,
    },
  };
}

// ============== MALTEGO-STYLE TRANSFORM GRAPH ==============
// Each transform takes an entity type and discovers related entities
// Transforms compose: Agent → Safe → Agents → TBAs → NFTs → ...

type EntityType = 'agent' | 'safe' | 'tba' | 'nft' | 'mcp' | 'contract' | 'wallet';

interface GraphEntity {
  id: string;
  type: EntityType;
  label: string;
  data?: any;
}

interface GraphRelation {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

// Transform 1: Agent → Safe (from identity data)
async function transformAgentToSafe(agentName: string, identity: any): Promise<GraphEntity | null> {
  const safe = identity?.safe || identity?.safeAddress;
  if (!safe) return null;
  return { id: safe, type: 'safe', label: `Safe ${safe.slice(0, 8)}...`, data: { address: safe } };
}

// Transform 2: Safe → All Agents (query all agents, filter by shared Safe)
async function transformSafeToAgents(safeAddress: string, excludeAgent: string): Promise<GraphEntity[]> {
  const agents: GraphEntity[] = [];
  try {
    const listRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listAgents' }),
    });
    if (!listRes.ok) return agents;
    
    const data = await listRes.json();
    const allAgents = data.agents || [];
    
    // Check each agent for shared Safe
    await Promise.all(allAgents.map(async (a: any) => {
      const peerName = typeof a === 'string' ? a : a.name;
      if (peerName === excludeAgent) return;
      
      const peerRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: peerName }),
      });
      if (!peerRes.ok) return;
      
      const peer = await peerRes.json();
      if (peer.safe?.toLowerCase() === safeAddress.toLowerCase()) {
        agents.push({
          id: peerName,
          type: 'agent',
          label: peerName,
          data: { safe: peer.safe, tier: peer.accountTier },
        });
      }
    }));
  } catch {}
  return agents;
}

// Transform 3: Agent → TBA (from ghostagent.ninja API)
async function transformAgentToTBA(agentName: string): Promise<GraphEntity | null> {
  try {
    const lookupRes = await fetch(`${GHOSTAGENT_LOOKUP_URL}?q=${encodeURIComponent(agentName)}`);
    if (!lookupRes.ok) return null;
    const data = await lookupRes.json();
    if (data.tbaAddress) {
      return {
        id: data.tbaAddress,
        type: 'tba',
        label: `TBA ${data.tbaAddress.slice(0, 8)}...`,
        data: { address: data.tbaAddress, deployed: data.tbaDeployed },
      };
    }
  } catch {}
  return null;
}

// Transform 4: TBA → NFT (owner of the NFT that owns the TBA)
async function transformTBAToNFT(tbaAddress: string, tokenContract?: string, tokenId?: number): Promise<GraphEntity | null> {
  if (!tokenContract || !tokenId) return null;
  return {
    id: `${tokenContract}:${tokenId}`,
    type: 'nft',
    label: `NFT #${tokenId}`,
    data: { contract: tokenContract, tokenId },
  };
}

// Transform 5: Agent → MCP Servers (from identity)
async function transformAgentToMCPs(agentName: string, identity: any): Promise<GraphEntity[]> {
  const mcpServers: string[] = identity?.mcpServers || [];
  return mcpServers.map((url: string) => ({
    id: url,
    type: 'mcp',
    label: new URL(url).hostname,
    data: { endpoint: url },
  }));
}

// Transform 6: Safe → On-chain Contracts (from tx history)
async function transformSafeToContracts(safeAddress: string): Promise<GraphEntity[]> {
  const contracts: GraphEntity[] = [];
  try {
    const txRes = await fetch(
      `${GNOSISSCAN_API}?module=account&action=txlist&address=${safeAddress}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
    );
    const txData = await txRes.json();
    if (txData.status === '1' && Array.isArray(txData.result)) {
      // Count interactions per contract
      const contractCounts: Record<string, number> = {};
      txData.result.slice(0, 100).forEach((tx: any) => {
        const to = tx.to?.toLowerCase();
        if (to && to !== safeAddress.toLowerCase()) {
          contractCounts[to] = (contractCounts[to] || 0) + 1;
        }
      });
      
      // Top 10 contracts by interaction count
      Object.entries(contractCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([address, count]) => {
          contracts.push({
            id: address,
            type: 'contract',
            label: `Contract ${address.slice(0, 8)}...`,
            data: { address, interactions: count },
          });
        });
    }
  } catch {}
  return contracts;
}

// Main Maltego-style graph builder
async function buildTransformGraph(agent: string, depth: number = 2): Promise<{ entities: GraphEntity[]; relations: GraphRelation[] }> {
  const entities: GraphEntity[] = [{ id: agent, type: 'agent', label: agent }];
  const relations: GraphRelation[] = [];
  const visited = new Set<string>([agent]);
  
  // Get base identity
  let identity: any = null;
  try {
    const lookupRes = await fetch(`${GHOSTAGENT_LOOKUP_URL}?q=${encodeURIComponent(agent)}`);
    if (lookupRes.ok) identity = await lookupRes.json();
  } catch {
    try {
      const workerRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
      });
      if (workerRes.ok) identity = await workerRes.json();
    } catch {}
  }
  
  if (!identity) return { entities, relations };
  
  // Layer 1: Direct connections from agent
  const safe = await transformAgentToSafe(agent, identity);
  if (safe) {
    entities.push(safe);
    relations.push({ source: agent, target: safe.id, type: 'owns', properties: { relation: 'agent-safe' } });
    
    if (depth > 1) {
      // Layer 2: Safe → other agents
      const coAgents = await transformSafeToAgents(safe.data.address, agent);
      coAgents.forEach(coAgent => {
        if (!visited.has(coAgent.id)) {
          visited.add(coAgent.id);
          entities.push(coAgent);
          relations.push({ source: safe.id, target: coAgent.id, type: 'shared', properties: { relation: 'safe-sharing' } });
        }
      });
      
      // Layer 2: Safe → contracts
      const contracts = await transformSafeToContracts(safe.data.address);
      contracts.forEach(contract => {
        if (!visited.has(contract.id)) {
          visited.add(contract.id);
          entities.push(contract);
          relations.push({ source: safe.id, target: contract.id, type: 'interacts', properties: { count: contract.data.interactions } });
        }
      });
    }
  }
  
  // Layer 1: Agent → TBA
  const tba = await transformAgentToTBA(agent);
  if (tba) {
    entities.push(tba);
    relations.push({ source: agent, target: tba.id, type: 'bound', properties: { relation: 'erc6551-tba' } });
    
    // Layer 2: TBA → NFT (if we have originNft data)
    const originNft = identity?.originNft;
    if (originNft && identity?.mintedTokenId) {
      // Parse originNft like "ghostagent.molt.gno" to extract registrar
      const nft = await transformTBAToNFT(tba.id, identity.onChainOwner, identity.mintedTokenId);
      if (nft && !visited.has(nft.id)) {
        visited.add(nft.id);
        entities.push(nft);
        relations.push({ source: tba.id, target: nft.id, type: 'owns', properties: { relation: 'tba-nft' } });
      }
    }
  }
  
  // Layer 1: Agent → MCPs
  const mcps = await transformAgentToMCPs(agent, identity);
  mcps.forEach(mcp => {
    if (!visited.has(mcp.id)) {
      visited.add(mcp.id);
      entities.push(mcp);
      relations.push({ source: agent, target: mcp.id, type: 'exposes', properties: { relation: 'mcp-server' } });
    }
  });
  
  return { entities, relations };
}

async function mapRelations(agent: string): Promise<AgentRelations & { graph: { entities: GraphEntity[]; relations: GraphRelation[] } }> {
  // Build Maltego-style transform graph
  const { entities, relations } = await buildTransformGraph(agent, 2);
  
  // Calculate traditional metrics from graph
  const sharedSafes = entities
    .filter(e => e.type === 'safe')
    .map(e => e.data?.address)
    .filter(Boolean);
  
  const handshakes: AgentRelations['handshakes'] = relations
    .filter(r => r.type === 'shared')
    .map(r => ({
      peer: r.target,
      status: 'shared-safe',
      timestamp: Date.now(),
    }));
  
  const networkSize = entities.filter(e => e.type === 'agent').length - 1 + // other agents
                     entities.filter(e => e.type === 'contract').length + // contracts
                     entities.filter(e => e.type === 'mcp').length; // MCPs
  
  const centrality = Math.min(networkSize / 10, 1);
  
  return {
    agent,
    handshakes,
    sharedSafes,
    networkSize,
    centrality,
    graph: { entities, relations },
  };
}

async function buildGraph(agent: string, depth: number = 2): Promise<GraphData> {
  const nodes: GraphData['nodes'] = [{ id: agent, label: agent, type: 'agent' }];
  const edges: GraphData['edges'] = [];
  const visited = new Set([agent]);
  
  async function explore(currentAgent: string, currentDepth: number) {
    if (currentDepth <= 0) return;
    
    const identityRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAgentIdentity', agentName: currentAgent }),
    }).catch(() => null);
    
    if (identityRes?.ok) {
      const identity = await identityRes.json();
      
      if (identity.safe && !visited.has(identity.safe)) {
        visited.add(identity.safe);
        nodes.push({ id: identity.safe, label: 'Safe', type: 'safe' });
        edges.push({ source: currentAgent, target: identity.safe, type: 'owns', weight: 1 });
      }
      
      (identity.mcpServers || []).forEach((mcp: string) => {
        if (!visited.has(mcp)) {
          visited.add(mcp);
          nodes.push({ id: mcp, label: 'MCP', type: 'mcp' });
          edges.push({ source: currentAgent, target: mcp, type: 'uses', weight: 0.5 });
        }
      });
    }
    
    // Use listAgents to find peers (no listHandshakes action available)
    const listRes = await fetch(`${WORKER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listAgents' }),
    }).catch(() => null);
    
    if (listRes?.ok) {
      const data = await listRes.json();
      for (const a of (data.agents || [])) {
        const peerName = typeof a === 'string' ? a : a.name;
        if (!peerName || visited.has(peerName)) continue;
        
        visited.add(peerName);
        nodes.push({ id: peerName, label: peerName, type: 'agent' });
        edges.push({ source: currentAgent, target: peerName, type: 'peer', weight: 0.8 });
        
        await explore(peerName, currentDepth - 1);
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
  if (identity.erc8004) {
    Object.entries(identity.erc8004).forEach(([chain, id]: [string, any]) => {
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
  
  // Check for linked Safe
  if (identity.safe) {
    correlated.push({
      platform: 'gnosis-safe',
      handle: identity.safe,
      confidence: 100,
      verified: true,
    });
  }
  
  // Check for owner wallet
  if (identity.identityNft?.owner) {
    correlated.push({
      platform: 'nft-owner',
      handle: identity.identityNft.owner,
      confidence: 100,
      verified: true,
    });
  }
  
  // A2A card cross-reference
  if (identity.links?.a2aCard) {
    correlated.push({
      platform: 'a2a-protocol',
      handle: handle,
      confidence: 90,
      verified: true,
    });
  }
  
  // NFTmail email
  if (identity.email) {
    correlated.push({
      platform: 'nftmail',
      handle: identity.email,
      confidence: 100,
      verified: true,
    });
  }
  
  const tld = identity.identityNft?.tld || 'gno';
  return {
    primaryIdentity: `${handle}.${tld}`,
    correlatedIdentities: correlated,
  };
}

// ============== SPIDERFOOT-STYLE MODULAR RECON ==============
// Independent modules run in parallel, each producing "events"
// Modules can emit events that trigger other modules (event-driven pipeline)

type ReconEventType = 'agent' | 'dns' | 'crypto' | 'contract' | 'social' | 'blockchain' | 'whois';

interface ReconEvent {
  type: ReconEventType;
  source: string; // module that produced this event
  data: any;
  confidence: number; // 0-100
  timestamp: number;
}

interface ReconModule {
  name: string;
  description: string;
  run: (target: string, identity: any) => Promise<ReconEvent[]>;
}

// Module 1: DNS/Domain recon
const dnsModule: ReconModule = {
  name: 'dns',
  description: 'Resolve agent domains and MCP endpoints',
  async run(target, identity) {
    const events: ReconEvent[] = [];
    const tld = identity?.tld || identity?.identityNft?.tld;
    
    if (tld) {
      events.push({
        type: 'dns',
        source: 'dns',
        data: { domain: `${target}.${tld}`, resolved: true },
        confidence: 100,
        timestamp: Date.now(),
      });
    }
    
    // Check MCP endpoints
    const mcps = identity?.mcpServers || [];
    mcps.forEach((url: string) => {
      try {
        const hostname = new URL(url).hostname;
        events.push({
          type: 'dns',
          source: 'dns',
          data: { endpoint: url, hostname, type: 'mcp-server' },
          confidence: 95,
          timestamp: Date.now(),
        });
      } catch {}
    });
    
    return events;
  },
};

// Module 2: Crypto/Blockchain recon
const cryptoModule: ReconModule = {
  name: 'crypto',
  description: 'Analyze on-chain addresses and transactions',
  async run(target, identity) {
    const events: ReconEvent[] = [];
    const safe = identity?.safe || identity?.safeAddress;
    const tba = identity?.tbaAddress;
    
    if (safe) {
      events.push({
        type: 'crypto',
        source: 'crypto',
        data: { type: 'safe', address: safe, chain: 'gnosis' },
        confidence: 100,
        timestamp: Date.now(),
      });
      
      // Fetch transaction count
      try {
        const txRes = await fetch(
          `${GNOSISSCAN_API}?module=account&action=txlist&address=${safe}&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken`
        );
        const txData = await txRes.json();
        if (txData.status === '1' && Array.isArray(txData.result)) {
          events.push({
            type: 'blockchain',
            source: 'crypto',
            data: { 
              address: safe, 
              txCount: txData.result.length,
              firstSeen: txData.result[0]?.timeStamp,
              lastSeen: txData.result[txData.result.length - 1]?.timeStamp,
            },
            confidence: 100,
            timestamp: Date.now(),
          });
          
          // Extract unique contract interactions
          const contracts = new Set<string>();
          txData.result.forEach((tx: any) => {
            if (tx.to && tx.to.toLowerCase() !== safe.toLowerCase()) {
              contracts.add(tx.to);
            }
          });
          
          events.push({
            type: 'contract',
            source: 'crypto',
            data: { 
              type: 'contract-interactions', 
              count: contracts.size,
              addresses: Array.from(contracts).slice(0, 20),
            },
            confidence: 90,
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    
    if (tba) {
      events.push({
        type: 'crypto',
        source: 'crypto',
        data: { type: 'tba', address: tba, standard: 'erc6551' },
        confidence: 100,
        timestamp: Date.now(),
      });
    }
    
    // ERC-8004 registrations
    if (identity?.erc8004) {
      Object.entries(identity.erc8004).forEach(([chain, data]: [string, any]) => {
        if (data?.agentId) {
          events.push({
            type: 'crypto',
            source: 'crypto',
            data: { type: 'erc8004', chain, agentId: data.agentId },
            confidence: 100,
            timestamp: Date.now(),
          });
        }
      });
    }
    
    return events;
  },
};

// Module 3: Social/Identity correlation
const socialModule: ReconModule = {
  name: 'social',
  description: 'Correlate agent identity across platforms',
  async run(target, identity) {
    const events: ReconEvent[] = [];
    
    // Email address
    if (identity?.email || identity?.emailAddress) {
      events.push({
        type: 'social',
        source: 'social',
        data: { platform: 'nftmail', handle: identity.email || identity.emailAddress },
        confidence: 100,
        timestamp: Date.now(),
      });
    }
    
    // Owner wallet
    if (identity?.onChainOwner || identity?.identityNft?.owner) {
      events.push({
        type: 'social',
        source: 'social',
        data: { platform: 'wallet', address: identity.onChainOwner || identity.identityNft?.owner },
        confidence: 100,
        timestamp: Date.now(),
      });
    }
    
    // Agent card / A2A
    if (identity?.links?.agentCard || identity?.agentCardUrl) {
      events.push({
        type: 'social',
        source: 'social',
        data: { platform: 'a2a-protocol', card: identity.links?.agentCard || identity.agentCardUrl },
        confidence: 95,
        timestamp: Date.now(),
      });
    }
    
    return events;
  },
};

// Module 4: Whois-style metadata recon
const whoisModule: ReconModule = {
  name: 'whois',
  description: 'Extract registration and metadata information',
  async run(target, identity) {
    const events: ReconEvent[] = [];
    
    if (identity?.originNft) {
      events.push({
        type: 'whois',
        source: 'whois',
        data: { 
          originNft: identity.originNft,
          tokenId: identity.mintedTokenId,
          owner: identity.onChainOwner,
          tier: identity.accountTier || identity.tier,
        },
        confidence: 100,
        timestamp: Date.now(),
      });
    }
    
    if (identity?.mintedAt || identity?.createdAt) {
      events.push({
        type: 'whois',
        source: 'whois',
        data: { registeredAt: identity.mintedAt || identity.createdAt },
        confidence: 90,
        timestamp: Date.now(),
      });
    }
    
    return events;
  },
};

// Main recon runner — runs all modules in parallel
async function runRecon(target: string, requestedModules: string[]): Promise<ReconReport> {
  const allModules = [dnsModule, cryptoModule, socialModule, whoisModule];
  const enabledModules = requestedModules.includes('all')
    ? allModules
    : allModules.filter(m => requestedModules.includes(m.name) || requestedModules.includes('basic'));
  
  // Fetch identity once for all modules
  let identity: any = null;
  try {
    const lookupRes = await fetch(`${GHOSTAGENT_LOOKUP_URL}?q=${encodeURIComponent(target)}`);
    if (lookupRes.ok) {
      const data = await lookupRes.json();
      if (data.exists) identity = data;
    }
  } catch {}
  
  if (!identity) {
    try {
      const workerRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: target }),
      });
      if (workerRes.ok) identity = await workerRes.json();
    } catch {}
  }
  
  // Run all enabled modules in parallel
  const moduleResults = await Promise.all(
    enabledModules.map(async (mod) => {
      try {
        const events = await mod.run(target, identity || {});
        return { name: mod.name, events, error: null };
      } catch (error: any) {
        return { name: mod.name, events: [], error: error.message };
      }
    })
  );
  
  // Aggregate results
  const allEvents: ReconEvent[] = [];
  const results: Record<string, any> = {};
  
  moduleResults.forEach(({ name, events, error }) => {
    if (error) {
      results[name] = { error, status: 'failed' };
    } else {
      results[name] = { 
        eventsFound: events.length,
        status: 'completed',
        data: events.map(e => ({ type: e.type, confidence: e.confidence, data: e.data })),
      };
      allEvents.push(...events);
    }
  });
  
  // Cross-correlation analysis
  const correlations = analyzeCorrelations(allEvents);
  
  return {
    target,
    modules: results,
    meta: {
      totalEvents: allEvents.length,
      dataSource: identity ? (identity.tbaAddress ? 'ghostagent-api' : 'worker-kv') : 'none',
      coverage: enabledModules.map(m => m.name),
      correlations,
    },
    timestamp: Date.now(),
  };
}

// Analyze correlations between events (SpiderFoot-style)
function analyzeCorrelations(events: ReconEvent[]): Array<{ type: string; entities: string[]; confidence: number }> {
  const correlations: Array<{ type: string; entities: string[]; confidence: number }> = [];
  
  // Find linked addresses (Safe ↔ TBA)
  const safes = events.filter(e => e.type === 'crypto' && e.data?.type === 'safe').map(e => e.data.address);
  const tbas = events.filter(e => e.type === 'crypto' && e.data?.type === 'tba').map(e => e.data.address);
  
  if (safes.length > 0 && tbas.length > 0) {
    correlations.push({
      type: 'safe-tba-link',
      entities: [...safes, ...tbas],
      confidence: 95,
    });
  }
  
  // Find multi-chain registrations
  const erc8004Chains = events.filter(e => e.type === 'crypto' && e.data?.type === 'erc8004');
  if (erc8004Chains.length > 1) {
    correlations.push({
      type: 'multi-chain-identity',
      entities: erc8004Chains.map(e => `${e.data.chain}:${e.data.agentId}`),
      confidence: 100,
    });
  }
  
  // Find exposed endpoints with on-chain activity
  const endpoints = events.filter(e => e.type === 'dns' && e.data?.type === 'mcp-server');
  const txActivity = events.filter(e => e.type === 'blockchain' && e.data?.txCount > 0);
  
  if (endpoints.length > 0 && txActivity.length > 0) {
    correlations.push({
      type: 'active-exposed-agent',
      entities: endpoints.map(e => e.data.hostname),
      confidence: 85,
    });
  }
  
  return correlations;
}

async function checkExposure(agent: string): Promise<ExposureReport> {
  // Same 3-phase lookup as analyzeFootprint — never throw for unknown agents
  let identity: any = null;

  const erc8004Parsed = parse8004Url(agent);
  if (erc8004Parsed) {
    identity = await lookupErc8004Registry(erc8004Parsed.chain, erc8004Parsed.agentId);
  }

  if (!identity) {
    try {
      const lookupRes = await fetch(`${GHOSTAGENT_LOOKUP_URL}?q=${encodeURIComponent(agent)}`);
      if (lookupRes.ok) {
        const d = await lookupRes.json();
        if (d.exists) identity = d;
      }
    } catch {}
  }

  if (!identity) {
    try {
      const workerRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAgentIdentity', agentName: agent }),
      });
      if (workerRes.ok) identity = await workerRes.json();
    } catch {}
  }

  if (!identity) identity = { safe: null, mcpServers: [], erc8004: null, genomeUrl: null };

  // Extract from actual worker shape
  const safeAddress = identity.safe || identity.safeAddress || null;
  const tld = identity.identityNft?.tld || null;
  const tldBase = tld ? tld.replace(/\.gno$/, '') : null;
  const KNOWN_TLDS = ['molt', 'nftmail', 'openclaw', 'picoclaw', 'vault', 'agent'];
  const hasX402 = !!(tldBase && KNOWN_TLDS.includes(tldBase));
  
  const exposures: Array<{ type: string; severity: string; description: string }> = [];
  let score = 100;
  
  if (!safeAddress) {
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
          params: [safeAddress, 'latest'],
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
  
  // Genome check — worker doesn't store genomeUrl, so check if it's a known TLD agent
  if (!identity.genomeUrl && !identity.links?.genome) {
    if (!hasX402) {
      // Only flag as exposure if NOT a known ghostagent TLD (they have built-in capabilities)
      exposures.push({ type: 'no-gns-name', severity: 'low', description: 'Agent has no GNS (.gno) registered name' });
      score -= 10;
    }
  }
  
  if ((identity.mcpServers || []).length > 0) {
    exposures.push({ type: 'public-mcp', severity: 'low', description: `${identity.mcpServers.length} public MCP endpoint(s) exposed` });
    score -= 5;
  }
  
  // Positive signals
  if (hasX402) {
    score = Math.min(score + 10, 100);
  }
  if (identity.erc8004 && Object.keys(identity.erc8004).length >= 3) {
    score = Math.min(score + 5, 100); // Registered on all 3 chains
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
  
  const safeAddress = identity.safe || null;
  const chains = [];
  
  // Gnosis transactions
  if (safeAddress) {
    try {
      const gnosisTx = await fetch(
        `${GNOSISSCAN_API}?module=account&action=txlist&address=${safeAddress}&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken`
      );
      const gnosisData = await gnosisTx.json();
      if (gnosisData.status === '1' && Array.isArray(gnosisData.result)) {
        chains.push({ chain: 'gnosis', txCount: gnosisData.result.length, volume: 0 });
      }
    } catch (e) {}
  }
  
  // Check for Base
  if (identity.erc8004?.base) {
    chains.push({ chain: 'base', txCount: 0, volume: 0 });
  }
  
  // Check for Base Sepolia
  if (identity.erc8004?.baseSepolia) {
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
// Never throws — unknown agents pass through as-is for graceful handling downstream

async function resolveAgentIdentifier(raw: string, chain?: string): Promise<string> {
  const v = raw.trim();
  if (!v) throw new Error('Empty agent identifier');

  // 8004agents.ai URL → encode as erc8004:{chain}:{id} for downstream resolution
  if (v.includes('8004agents.ai')) {
    const parsed = parse8004Url(v);
    if (parsed) return `erc8004:${parsed.chain}:${parsed.agentId}`;
  }

  // Strip leading # — numeric = ERC-8004 agentId
  const stripped = v.replace(/^#/, '');
  if (/^\d+$/.test(stripped)) {
    const targetId = parseInt(stripped);
    const resolvedChain = chain || 'gnosis';

    // Try worker KV first (fast path for ghostagent.ninja agents)
    try {
      const listRes = await fetch(`${WORKER_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listAgents' }),
      });
      if (listRes.ok) {
        const data = await listRes.json();
        const chainsToCheck = chain ? [chain] : ['gnosis', 'base', 'baseSepolia'];
        for (const agentObj of (data.agents || [])) {
          const name = typeof agentObj === 'string' ? agentObj : agentObj.name;
          const erc8004 = typeof agentObj === 'string' ? null : agentObj.erc8004;
          if (erc8004) {
            for (const c of chainsToCheck) {
              if (erc8004[c]?.agentId === targetId) return name;
            }
          }
        }
      }
    } catch {}

    // Not in worker KV → encode for direct on-chain resolution
    return `erc8004:${resolvedChain}:${stripped}`;
  }

  // Agent email: [name]_@nftmail.box
  if (v.includes('_@nftmail.box')) {
    return v.replace('_@nftmail.box', '');
  }

  // Regular agent name — return as-is; analyzeFootprint handles graceful fallback
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
  const chain = searchParams.get('chain');
  
  if (!rawAgent) {
    return NextResponse.json({ error: 'Missing agent parameter (use agent, target, handle, or agentId)' }, { status: 400 });
  }
  
  try {
    // Resolve the agent identifier (handles #ID, email, or name)
    const agent = await resolveAgentIdentifier(rawAgent, chain || undefined);
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
