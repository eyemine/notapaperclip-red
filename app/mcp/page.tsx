'use client';

import { useState } from 'react';

// ─── Known MCP packages / servers with capability classifications ──────────────
const KNOWN_MCP_SERVERS: Record<string, { label: string; risk: 'critical' | 'high' | 'medium' | 'low'; tags: string[]; description: string }> = {
  '@quicknode/mcp':          { label: 'QuickNode',       risk: 'high',     tags: ['blockchain','network','infra'],         description: 'Manages RPC endpoints, billing, security settings' },
  '@modelcontextprotocol/server-filesystem': { label: 'Filesystem', risk: 'critical', tags: ['filesystem','read','write'], description: 'Read/write access to local filesystem' },
  '@modelcontextprotocol/server-github':     { label: 'GitHub',     risk: 'high',     tags: ['code','network','write'],    description: 'Repository management, issue tracking, PRs' },
  '@modelcontextprotocol/server-brave-search':{ label: 'Brave Search', risk: 'low',  tags: ['network','data-read'],        description: 'Web search via Brave API' },
  '@modelcontextprotocol/server-postgres':   { label: 'PostgreSQL',  risk: 'high',   tags: ['database','read','write'],    description: 'Direct database read/write access' },
  '@modelcontextprotocol/server-sqlite':     { label: 'SQLite',      risk: 'medium', tags: ['database','read','write'],    description: 'Local SQLite database access' },
  '@modelcontextprotocol/server-puppeteer':  { label: 'Puppeteer',   risk: 'high',   tags: ['browser','network','execute'], description: 'Headless browser — can execute arbitrary JS' },
  '@modelcontextprotocol/server-slack':      { label: 'Slack',       risk: 'medium', tags: ['messaging','network'],        description: 'Slack workspace messaging' },
  '@modelcontextprotocol/server-google-maps':{ label: 'Google Maps', risk: 'low',    tags: ['network','data-read'],        description: 'Location and mapping queries' },
  '@modelcontextprotocol/server-memory':     { label: 'Memory',      risk: 'medium', tags: ['persistence','read','write'], description: 'Persistent agent memory store' },
  '@modelcontextprotocol/server-fetch':      { label: 'Fetch',       risk: 'medium', tags: ['network','read'],             description: 'Arbitrary HTTP fetch — outbound network calls' },
  '@modelcontextprotocol/server-everything': { label: 'Everything',  risk: 'critical', tags: ['filesystem','network','execute'], description: 'Full capability test server — dangerous in prod' },
  'story-sdk-mcp':           { label: 'Story Protocol',  risk: 'high',   tags: ['blockchain','ip','write'],  description: 'Story Protocol IP asset registration and licensing' },
  'piplabs/story-sdk-mcp':   { label: 'Story Protocol',  risk: 'high',   tags: ['blockchain','ip','write'],  description: 'Story Protocol IP asset registration and licensing' },
  'ghostagent-protocol':     { label: 'GhostAgent Core', risk: 'high',   tags: ['blockchain','write','network'], description: 'ERC-8004 identity, ERC-6551 TBA wallet, Gnosis Safe treasury, x402 payment rail' },
  '@ghostagent/x402-mcp':    { label: 'x402 Payment',    risk: 'medium', tags: ['blockchain','network','write'], description: 'HTTP 402 pay-per-use payment protocol for agent-to-agent micropayments' },
  '@ghostagent/a2a-mcp':     { label: 'GhostWire A2A',   risk: 'medium', tags: ['network','messaging'],      description: 'EIP-712 bilateral HandshakeCertificate negotiation and validation' },
  '@ghostagent/nftmail-mcp': { label: 'NFTmail Inbox',   risk: 'medium', tags: ['messaging','network'],      description: 'NFT-gated encrypted agent inbox — send and receive agent-to-agent messages' },
  '@ghostagent/reputation-mcp': { label: 'Reputation Oracle', risk: 'medium', tags: ['blockchain','data-read'], description: 'ERC-8004 reputation registry — read/write public agent reputation scores' },
  '@lighthouse-web3/sdk':    { label: 'Lighthouse IPFS', risk: 'low',    tags: ['network','persistence'],    description: 'Filecoin-backed IPFS pinning for metadata, agent cards, and attestations' },
};

const RISK_CONFIG = {
  critical: { label: 'CRITICAL', color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)', border: 'rgba(255,59,59,0.3)' },
  high:     { label: 'HIGH',     color: '#ff8c00', bg: 'rgba(255,140,0,0.1)',  border: 'rgba(255,140,0,0.3)'  },
  medium:   { label: 'MEDIUM',   color: '#f5c842', bg: 'rgba(245,200,66,0.1)', border: 'rgba(245,200,66,0.3)' },
  low:      { label: 'LOW',      color: '#4caf84', bg: 'rgba(76,175,132,0.1)', border: 'rgba(76,175,132,0.3)' },
} as const;

const TAG_COLORS: Record<string, string> = {
  filesystem: '#ff3b3b', execute: '#ff3b3b', 'code-exec': '#ff3b3b',
  blockchain: '#ff8c00', write: '#ff8c00', database: '#ff8c00', infra: '#ff8c00',
  network: '#f5c842', browser: '#f5c842', messaging: '#f5c842', persistence: '#f5c842',
  read: '#4caf84', 'data-read': '#4caf84', ip: '#9b87f5', code: '#87adf5',
};

// ─── Skill capability tags derived from skill names / descriptions ─────────────
function inferSkillRisk(skill: { name?: string; description?: string; tags?: string[] }): { risk: 'critical' | 'high' | 'medium' | 'low'; tags: string[] } {
  const text = `${skill.name ?? ''} ${skill.description ?? ''} ${(skill.tags ?? []).join(' ')}`.toLowerCase();
  const tags: string[] = [];
  if (/exec|run|shell|bash|command|code/.test(text))        tags.push('code-exec');
  if (/file|read file|write file|filesystem|disk/.test(text)) tags.push('filesystem');
  if (/database|sql|postgres|sqlite|mongo/.test(text))      tags.push('database');
  if (/deploy|publish|mint|transfer|sign|transact/.test(text)) tags.push('write');
  if (/blockchain|onchain|contract|wallet|token/.test(text)) tags.push('blockchain');
  if (/fetch|http|request|webhook|network/.test(text))      tags.push('network');
  if (/search|query|lookup|read/.test(text))                tags.push('data-read');
  if (/memory|store|persist|cache/.test(text))              tags.push('persistence');
  if (/email|message|send|notify/.test(text))               tags.push('messaging');

  const risk: 'critical' | 'high' | 'medium' | 'low' =
    tags.includes('code-exec') || tags.includes('filesystem') ? 'critical' :
    tags.includes('blockchain') || tags.includes('database') || tags.includes('write') ? 'high' :
    tags.includes('network') || tags.includes('messaging') || tags.includes('persistence') ? 'medium' : 'low';

  return { risk, tags: tags.length > 0 ? tags : ['data-read'] };
}

interface ProbeEndpoint { url: string; found: boolean; error?: string; text?: string; }

interface AnalysisResult {
  url: string;
  agentName: string;
  agentDescription: string;
  mcpServers: Array<{ name: string; package?: string; endpoint?: string; known?: typeof KNOWN_MCP_SERVERS[string] }>;
  skills: Array<{ name: string; description?: string; risk: 'critical' | 'high' | 'medium' | 'low'; tags: string[] }>;
  capabilities: Record<string, boolean>;
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  services: Array<{ name: string; endpoint: string }>;
  probed: { agentCardJson: ProbeEndpoint; agentJson: ProbeEndpoint; mcpJson: ProbeEndpoint; aiPlugin: ProbeEndpoint; agentsMd: ProbeEndpoint };
  raw: Record<string, unknown>;
  fetchedAt: number;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

function overallRiskFromParts(
  mcpServers: AnalysisResult['mcpServers'],
  skills: AnalysisResult['skills'],
): 'critical' | 'high' | 'medium' | 'low' {
  const all = [
    ...mcpServers.map(s => s.known?.risk ?? 'low'),
    ...skills.map(s => s.risk),
  ];
  if (all.includes('critical')) return 'critical';
  if (all.includes('high'))     return 'high';
  if (all.includes('medium'))   return 'medium';
  return 'low';
}

function analyseAgentCard(url: string, card: Record<string, unknown>): AnalysisResult {
  // Parse MCP servers (from mcpServers field or well-known patterns)
  const rawMcp = (card.mcpServers ?? card.mcp_servers ?? []) as Array<Record<string, unknown>>;
  const mcpServers: AnalysisResult['mcpServers'] = rawMcp.map(s => {
    const pkg = (s.package ?? s.npm ?? s.name ?? '') as string;
    const known = KNOWN_MCP_SERVERS[pkg] ?? Object.entries(KNOWN_MCP_SERVERS).find(([k]) => pkg.includes(k))?.[1];
    return { name: (s.name ?? pkg) as string, package: pkg || undefined, endpoint: s.url as string | undefined, known };
  });

  // Parse skills (Google A2A format)
  const capabilitiesObj = card.capabilities as Record<string, unknown> | undefined;
  const rawSkills = (card.skills ?? capabilitiesObj?.skills ?? []) as Array<Record<string, unknown>>;
  const skills: AnalysisResult['skills'] = (rawSkills as Array<{ name?: string; description?: string; tags?: string[] }>).map(s => {
    const { risk, tags } = inferSkillRisk(s);
    return { name: s.name ?? 'Unknown', description: s.description, risk, tags };
  });

  // Also infer from services
  const rawServices = (card.services ?? []) as Array<{ name: string; endpoint: string }>;
  rawServices.forEach(svc => {
    if (svc.name && !['web','A2A','email','x402'].includes(svc.name)) {
      const { risk, tags } = inferSkillRisk({ name: svc.name, description: svc.endpoint });
      if (!skills.find(s => s.name === svc.name)) {
        skills.push({ name: svc.name, description: svc.endpoint, risk, tags });
      }
    }
  });

  const capabilities = (card.capabilities ?? {}) as Record<string, boolean>;
  const overallRisk = overallRiskFromParts(mcpServers, skills);

  const probed = {
    agentCardJson: { url: '', found: false },
    agentJson:     { url: '', found: false },
    mcpJson:       { url: '', found: false },
    aiPlugin:      { url: '', found: false },
    agentsMd:      { url: '', found: false },
  };

  return {
    url,
    agentName: (card.name ?? card.agentName ?? 'Unknown') as string,
    agentDescription: (card.description ?? '') as string,
    mcpServers,
    skills,
    capabilities,
    overallRisk,
    services: rawServices,
    probed,
    raw: card,
    fetchedAt: Date.now(),
  };
}

const SUPPORTED_CHAINS = [
  { key: 'gnosis',       label: 'Gnosis'       },
  { key: 'base',         label: 'Base'         },
  { key: 'ethereum',     label: 'Ethereum'     },
  { key: 'bnb',          label: 'BNB Chain'    },
  { key: 'arbitrum',     label: 'Arbitrum'     },
  { key: 'avalanche',    label: 'Avalanche'    },
  { key: 'linea',        label: 'Linea'        },
  { key: 'base-sepolia', label: 'Base Sepolia' },
  { key: 'sepolia',      label: 'Sepolia'      },
];

export default function McpInspectorPage() {
  const [url, setUrl]               = useState('');
  const [status, setStatus]         = useState<Status>('idle');
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [errMsg, setErrMsg]         = useState('');
  const [showRaw, setShowRaw]       = useState(false);
  const [resolving, setResolving]   = useState(false);
  const [resolved, setResolved]     = useState<{ agentId: number; chain: string; chainName: string } | null>(null);
  const [chainKey, setChainKey]     = useState('base');
  const [agentIdInput, setAgentIdInput] = useState('');

  async function resolveFromExplorer(explorerUrl: string) {
    setResolving(true);
    setErrMsg('');
    try {
      const res  = await fetch(`/api/erc8004/resolve?url=${encodeURIComponent(explorerUrl)}`);
      const data = await res.json() as { agentURI?: string; agentId?: number; chain?: string; chainName?: string; inlineCard?: Record<string, unknown>; error?: string };
      if (!res.ok || data.error) { setErrMsg(data.error ?? `HTTP ${res.status}`); setResolving(false); return; }
      const uri = data.agentURI ?? '';
      setUrl(data.inlineCard ? explorerUrl : uri);
      setResolved({ agentId: data.agentId!, chain: data.chain!, chainName: data.chainName! });
      setStatus('loading');
      setResult(null);
      if (data.inlineCard) {
        // Inline data: URI — card is fully on-chain, no HTTP fetch needed
        const analysis = analyseAgentCard(uri, data.inlineCard);
        setResult(analysis);
        setStatus('done');
      } else {
        // Remote URI — probe all well-known endpoints
        const r2 = await fetch(`/api/mcp/probe?url=${encodeURIComponent(uri)}`);
        const d2 = await r2.json() as { merged?: Record<string, unknown>; probed?: AnalysisResult['probed']; error?: string };
        if (!r2.ok || d2.error) { setErrMsg(d2.error ?? `HTTP ${r2.status}`); setStatus('error'); return; }
        const analysis = analyseAgentCard(uri, d2.merged ?? {});
        analysis.probed = d2.probed ?? analysis.probed;
        setResult(analysis);
        setStatus('done');
      }
    } catch (err) {
      setErrMsg(String(err));
      setStatus('error');
    } finally {
      setResolving(false);
    }
  }

  async function inspect() {
    const val = url.trim();
    if (!val) return;
    // If user pasted an 8004agents.ai URL, resolve first
    if (val.includes('8004agents.ai')) {
      await resolveFromExplorer(val);
      return;
    }
    setStatus('loading');
    setResult(null);
    setErrMsg('');
    try {
      const res  = await fetch(`/api/mcp/probe?url=${encodeURIComponent(val)}`);
      const data = await res.json() as {
        merged?: Record<string, unknown>;
        probed?: { agentCardJson: ProbeEndpoint; agentJson: ProbeEndpoint; mcpJson: ProbeEndpoint; aiPlugin: ProbeEndpoint; agentsMd: ProbeEndpoint };
        error?: string;
      };
      if (!res.ok || data.error) { setErrMsg(data.error ?? `HTTP ${res.status}`); setStatus('error'); return; }
      const card = data.merged ?? {};
      const analysis = analyseAgentCard(val, card);
      analysis.probed = data.probed ?? analysis.probed;
      setResult(analysis);
      setStatus('done');
    } catch (err) {
      setErrMsg(String(err));
      setStatus('error');
    }
  }

  const risk = result ? RISK_CONFIG[result.overallRisk] : null;

  return (
    <div className="page-wrap">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>MCP Inspector</h1>
        <p>
          Surface an agent&apos;s capability surface — MCP servers, declared skills, and tool risk profile.
          Works for any <a href="https://google.github.io/A2A" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>A2A-compliant ↗</a> agent.
        </p>
      </div>

      {/* Input */}
      <div className="search-row">
        <input
          className="search-input"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
          onKeyDown={e => e.key === 'Enter' && inspect()}
          placeholder="https://agent.example.com  or  https://8004agents.ai/base/agent/19731"
          autoComplete="off" autoCorrect="off" spellCheck={false}
        />
        <button className="btn-primary" onClick={inspect} disabled={!url.trim() || status === 'loading' || resolving}>
          {status === 'loading' || resolving
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
          Inspect
        </button>
      </div>

      {/* Resolved-from-chain badge */}
      {resolved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
          <span style={{ background: 'rgba(76,175,132,0.12)', border: '1px solid rgba(76,175,132,0.3)', color: 'var(--green)', borderRadius: 99, padding: '0.15rem 0.55rem', fontWeight: 600 }}>
            #{resolved.agentId} on {resolved.chainName}
          </span>
          <span>resolved from ERC-8004 registry — agentURI auto-populated</span>
          <a href={`https://8004agents.ai/${resolved.chain}/agent/${resolved.agentId}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--red)', textDecoration: 'none' }}>view on 8004agents.ai ↗</a>
        </div>
      )}

      {/* ERC-8004 on-chain resolver */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>or resolve by ERC-8004 ID:</span>
        <select
          value={chainKey}
          onChange={e => setChainKey(e.target.value)}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-alt)', color: 'var(--text)', cursor: 'pointer' }}
        >
          {SUPPORTED_CHAINS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-alt)', color: 'var(--text)', width: '90px' }}
          placeholder="Agent ID"
          value={agentIdInput}
          onChange={e => setAgentIdInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && agentIdInput.trim()) { setResolved(null); resolveFromExplorer(`https://8004agents.ai/${chainKey}/agent/${agentIdInput.trim()}`); } }}
        />
        <button className="btn-secondary"
          style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', borderRadius: 99, whiteSpace: 'nowrap' }}
          disabled={!agentIdInput.trim() || resolving}
          onClick={() => { setResolved(null); resolveFromExplorer(`https://8004agents.ai/${chainKey}/agent/${agentIdInput.trim()}`); }}
        >
          {resolving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Resolve →'}
        </button>
      </div>

      {/* Quick examples */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'ghostagent.ninja', url: 'https://ghostagent.ninja' },
          { label: 'ghostagent #32756 (Base)', url: 'https://8004agents.ai/base/agent/32756' },
          { label: 'eyemine #33496 (Base)', url: 'https://8004agents.ai/base/agent/33496' },
          { label: 'Basemate #30380 (Base)', url: 'https://8004agents.ai/base/agent/30380' },
          { label: 'Hermes #34716 (Base)', url: 'https://8004agents.ai/base/agent/34716' },
          { label: 'Phosphor #32263 (Base)', url: 'https://8004agents.ai/base/agent/32263' },
        ].map(ex => (
          <button key={ex.url} className="btn-secondary"
            style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
            onClick={() => { setUrl(ex.url); setStatus('idle'); setResolved(null); }}>
            {ex.label}
          </button>
        ))}
      </div>

      {status === 'error' && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{errMsg}</div>}

      {status === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* ── Endpoint probe results ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">Well-Known Endpoints</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {([
                { key: 'agentCardJson', label: '.well-known/agent-card.json', spec: 'A2A v1.0 — canonical' },
                { key: 'agentJson',     label: '.well-known/agent.json',      spec: 'A2A draft / legacy' },
                { key: 'mcpJson',       label: '.well-known/mcp.json',        spec: 'MCP Servers' },
                { key: 'aiPlugin',      label: '.well-known/ai-plugin.json',  spec: 'OpenAI Plugin' },
                { key: 'agentsMd',      label: 'AGENTS.md',                   spec: 'Codex / Agent Instructions' },
              ] as const).map((ep, i, arr) => {
                const p = result.probed[ep.key];
                return (
                  <div key={ep.key} className="data-row" style={{ gap: '0.75rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <span style={{
                      width: '1.25rem', height: '1.25rem', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', fontSize: '0.65rem', fontWeight: 700,
                      background: p.found ? 'rgba(76,175,132,0.15)' : 'rgba(255,255,255,0.05)',
                      color: p.found ? 'var(--green)' : 'var(--muted)',
                      border: `1px solid ${p.found ? 'rgba(76,175,132,0.4)' : 'var(--border)'}`,
                    }}>{p.found ? '✓' : '✗'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="mono" style={{ fontSize: '0.78rem', color: p.found ? 'var(--text)' : 'var(--muted)' }}>/{ep.label}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.62rem', color: 'var(--muted)' }}>{ep.spec}</span>
                    </div>
                    {p.found
                      ? <span style={{ fontSize: '0.62rem', color: 'var(--green)', fontWeight: 600 }}>found</span>
                      : <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>{p.error ?? 'not found'}</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AGENTS.md content ── */}
          {result.probed.agentsMd.found && result.probed.agentsMd.text && (
            <details className="card" style={{ overflow: 'hidden' }}>
              <summary className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}>
                AGENTS.md
                <span style={{ fontWeight: 400, color: 'var(--green)' }}>found ✓</span>
              </summary>
              <pre className="mono" style={{ padding: '0.875rem 1.125rem', fontSize: '0.72rem', color: 'var(--text-2)', overflowX: 'auto', margin: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-alt)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {result.probed.agentsMd.text}
              </pre>
            </details>
          )}

          {/* ── Risk banner ── */}
          <div className="card" style={{
            padding: '1.125rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            borderLeft: `4px solid ${risk!.color}`,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
                {result.agentName}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{result.agentDescription}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '0.55rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>trust surface</div>
              <div style={{
                fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.06em',
                color: risk!.color,
                background: risk!.bg,
                border: `1px solid ${risk!.border}`,
                borderRadius: 6, padding: '0.2rem 0.6rem', marginTop: '0.2rem',
              }}>
                {risk!.label}
              </div>
            </div>
          </div>

          {/* ── MCP Servers ── */}
          {result.mcpServers.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                MCP Servers
                <span style={{ fontWeight: 400 }}>{result.mcpServers.length} declared</span>
              </div>
              {result.mcpServers.map((srv, i) => {
                const cfg = srv.known ? RISK_CONFIG[srv.known.risk] : RISK_CONFIG.low;
                return (
                  <div key={i} className="data-row" style={{ gap: '0.75rem', borderBottom: i < result.mcpServers.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{srv.known?.label ?? srv.name}</span>
                        {srv.package && <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{srv.package}</span>}
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: '0.1rem 0.35rem' }}>{cfg.label}</span>
                      </div>
                      {srv.known?.description && <div style={{ fontSize: '0.71rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{srv.known.description}</div>}
                      {srv.known?.tags && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                          {srv.known.tags.map(tag => (
                            <span key={tag} style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: 99, background: `${TAG_COLORS[tag] ?? '#888'}22`, color: TAG_COLORS[tag] ?? '#888', border: `1px solid ${TAG_COLORS[tag] ?? '#888'}44`, fontWeight: 600 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Skills / Capabilities ── */}
          {result.skills.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                Declared Skills
                <span style={{ fontWeight: 400 }}>{result.skills.length} found</span>
              </div>
              {result.skills.map((skill, i) => {
                const cfg = RISK_CONFIG[skill.risk];
                return (
                  <div key={i} className="data-row" style={{ gap: '0.75rem', borderBottom: i < result.skills.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{skill.name}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: '0.1rem 0.35rem' }}>{cfg.label}</span>
                      </div>
                      {skill.description && <div style={{ fontSize: '0.71rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{skill.description}</div>}
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                        {skill.tags.map(tag => (
                          <span key={tag} style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: 99, background: `${TAG_COLORS[tag] ?? '#888'}22`, color: TAG_COLORS[tag] ?? '#888', border: `1px solid ${TAG_COLORS[tag] ?? '#888'}44`, fontWeight: 600 }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── A2A Capabilities flags ── */}
          {Object.keys(result.capabilities).length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">A2A Capability Flags</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.875rem 1.125rem' }}>
                {Object.entries(result.capabilities).map(([key, val]) => (
                  <span key={key} style={{
                    fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 6, fontWeight: 600,
                    background: val ? 'rgba(76,175,132,0.1)' : 'rgba(255,255,255,0.04)',
                    color: val ? 'var(--green)' : 'var(--muted)',
                    border: `1px solid ${val ? 'rgba(76,175,132,0.3)' : 'var(--border)'}`,
                  }}>
                    {val ? '✓' : '✗'} {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Services / Endpoints ── */}
          {result.services.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                Service Endpoints
                <span style={{ fontWeight: 400 }}>{result.services.length} declared</span>
              </div>
              {result.services.map((svc, i) => (
                <div key={i} className="data-row" style={{ gap: '0.75rem', borderBottom: i < result.services.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: '3.5rem', flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--red)', fontFamily: 'monospace' }}>{svc.name}</span>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--muted)', wordBreak: 'break-all' }}>{svc.endpoint}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── No capabilities found ── */}
          {result.mcpServers.length === 0 && result.skills.length === 0 && (
            <div className="card" style={{ padding: '1.5rem 1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>No MCP servers or skills declared</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                This agent card doesn&apos;t declare <code style={{ fontSize: '0.7rem' }}>mcpServers</code> or <code style={{ fontSize: '0.7rem' }}>skills[]</code>.
                It may use a private MCP configuration not exposed in its agent card.
              </div>
            </div>
          )}

          {/* ── Raw JSON ── */}
          <details className="card" style={{ overflow: 'hidden' }} open={showRaw} onToggle={e => setShowRaw((e.target as HTMLDetailsElement).open)}>
            <summary className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}>
              Raw agent.json
            </summary>
            <pre className="mono" style={{ padding: '0.875rem 1.125rem', fontSize: '0.72rem', color: 'var(--text-2)', overflowX: 'auto', margin: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </details>

        </div>
      )}

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>MCP capability surface analysis · Works with any A2A-compliant agent</div>
      </footer>

    </div>
  );
}
