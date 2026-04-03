'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ChainEvent {
  chain:     string;
  chainId:   number;
  eventType: string;
  agentId:   string;
  txHash:    string;
  block:     number;
  contract:  string;
}

const WORKER = 'https://nftmail-email-worker.richard-159.workers.dev';

interface Erc8004Chain { agentId: number; chainId: number; agentURI: string; registeredAt?: number; }
interface AgentIdentity {
  name: string;
  email: string;
  identityNft: { name: string; tokenId: number | null; owner: string | null; tld: string | null } | null;
  safe: string | null;
  storyIp: string | null;
  erc8004: { gnosis?: Erc8004Chain; base?: Erc8004Chain; baseSepolia?: Erc8004Chain };
  links: { profile: string; agentCard: string; a2aCard: string; registry: string };
}

interface CompanyManifest {
  schema:      string;
  slug:        string;
  name:        string;
  description: string;
  version:     string;
  sourceUrl:   string;
  fetchedAt:   number;
}

interface FeedResult {
  events:    ChainEvent[];
  total:     number;
  chains:    string[];
  errors?:   string[];
  fetchedAt: number;
}

const GHOSTAGENT_LOOKUP = '/api/handshake';

const CHAIN_DOT: Record<string, string> = {
  'Gnosis':       '#1a7a4a',
  'Base':         '#0052ff',
  'Base Sepolia': '#6b8cff',
};

const EXPLORER: Record<number, string> = {
  100:   'https://gnosisscan.io/tx/',
  8453:  'https://basescan.org/tx/',
  84532: 'https://sepolia.basescan.org/tx/',
};

function Erc8004FeedInner() {
  const searchParams = useSearchParams();
  const [chain, setChain]         = useState<'all' | 'gnosis' | 'basemainnet' | 'basesepolia'>('all');
  const [agentFilter, setFilter]  = useState(() => searchParams.get('agent') ?? '');
  const [resolvedId, setResolved]         = useState<string | null>(null);
  const [resolvedName, setResolvedName]   = useState<string | null>(null);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(null);
  const [companyManifest, setCompany]     = useState<CompanyManifest | null>(null);
  const [resolveErr, setResolveErr]       = useState('');
  const [data, setData]               = useState<FeedResult | null>(null);
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setRefresh]     = useState(0);

  async function resolveFilter(raw: string): Promise<string> {
    const v = raw.trim();
    if (!v) return '';
    // Strip leading # and treat as numeric token ID
    const stripped = v.replace(/^#/, '');
    if (/^\d+$/.test(stripped)) return stripped;

    // ── Agent email: [name]_@nftmail.box ─────────────────────────────────────
    if (v.includes('_@nftmail.box')) {
      try {
        const res  = await fetch(`/api/agent-lookup?email=${encodeURIComponent(v)}`);
        const json = await res.json() as { status: string; agentId?: number; safeAddress?: string; error?: string };
        if (json.status === 'invalid_format') {
          setResolveErr(json.error ?? 'Invalid agent email format — use [name]_@nftmail.box');
          return '';
        }
        if (json.status === 'not_found') {
          setResolveErr(json.error ?? 'Agent email not found in registry');
          return '';
        }
        if (json.agentId != null) {
          setResolved(String(json.agentId));
          setResolveErr('');
          return String(json.agentId);
        }
        // Safe found but no ERC-8004 agentId yet
        if (json.safeAddress) {
          setResolveErr(`Safe ${json.safeAddress.slice(0, 10)}… found — no ERC-8004 agentId registered yet`);
        } else {
          setResolveErr('Agent email resolved but no ERC-8004 agentId found');
        }
        return '';
      } catch {
        setResolveErr('Agent email lookup failed');
        return '';
      }
    }

    // ── GhostAgent name — strip suffixes and resolve via API ─────────────────
    const label = v.replace(/\.([a-z]+\.)?gno$/i, '').replace(/\.gno$/i, '');
    try {
      const res  = await fetch(`${GHOSTAGENT_LOOKUP}?agent=${encodeURIComponent(label)}`);
      const json = await res.json() as { registered: boolean; erc8004AgentId: number | null };
      if (json.registered && json.erc8004AgentId != null) {
        setResolved(String(json.erc8004AgentId));
        setResolvedName(label);
        setResolveErr('');
        // Fetch full identity stack
        fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getAgentIdentity', agentName: label }) })
          .then(r => r.json()).then((id: AgentIdentity) => setAgentIdentity(id)).catch(() => {});
        // Fetch Agent Companies manifest
        fetch(`/api/company?repo=eyemine/ghostagent-ninja&agent=${encodeURIComponent(label)}`)
          .then(r => r.ok ? r.json() : null)
          .then((c: CompanyManifest | null) => { if (c?.schema?.startsWith('agentcompanies/')) setCompany(c); })
          .catch(() => {});
        return String(json.erc8004AgentId);
      }
      setResolveErr(`__HANDSHAKE__${label}`);
      return '';
    } catch {
      setResolveErr('Name lookup failed — check the agent name and try again');
      return '';
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setResolved(null);
    setResolvedName(null);
    setAgentIdentity(null);
    setCompany(null);
    setResolveErr('');
    try {
      const agentId = await resolveFilter(agentFilter);
      const params  = new URLSearchParams({ chain, limit: '100' });
      if (agentId) params.set('agentId', agentId);
      const res  = await fetch(`/api/erc8004/events?${params}`);
      const json = await res.json() as FeedResult;
      setData(json);
      setRefresh(Date.now());
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, agentFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-trigger search when ?agent param is present on first load
  useEffect(() => {
    const param = searchParams.get('agent');
    if (param) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  function timeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  const chainDot = (c: string) => CHAIN_DOT[c] ?? 'var(--red)';

  return (
    <div className="page-wrap-wide">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>ERC-8004 Feed</h1>
        <p>
          Live event log from ERC-8004 agent identity registries on{' '}
          <a href="https://gnosisscan.io/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Gnosis ↗</a>
          {', '}
          <a href="https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Base ↗</a>
          {' and '}
          <a href="https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Base Sepolia ↗</a>.
          {' '}Auto-refreshes every 30s.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          <span style={{ background: 'var(--green-bg)', border: '1px solid rgba(26,122,74,0.25)', borderRadius: 4, padding: '0.15rem 0.5rem', marginRight: '0.5rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.05em' }}>GNOSISSCAN INDEXED</span>
          The ERC-8004 registry is independently searchable on{' '}
          <a href="https://gnosisscan.io/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Gnosisscan ↗</a>
          {' '}— a trusted third-party source independent of this oracle.
        </p>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
        {(['all', 'gnosis', 'basemainnet', 'basesepolia'] as const).map(c => (
          <button key={c}
            onClick={() => setChain(c)}
            className={chain === c ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: 99 }}>
            {c === 'all' ? 'All chains' : c === 'gnosis' ? 'Gnosis' : c === 'basemainnet' ? 'Base' : 'Base Sepolia'}
          </button>
        ))}
        <input
          className="search-input"
          value={agentFilter}
          onChange={e => { setFilter(e.target.value); setResolved(null); setResolveErr(''); }}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="#3199, ghostagent_@nftmail.box, or ghostagent"
          style={{ flex: 1, minWidth: 200, padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
        />
        <button className="btn-primary" onClick={load} disabled={loading} style={{ fontSize: '0.75rem', padding: '0.4rem 0.875rem' }}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Search'}
        </button>
        {lastRefresh > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>updated {timeAgo(lastRefresh)}</span>
        )}
      </div>

      {/* Resolved name badge */}
      {resolvedId && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid rgba(26,122,74,0.2)', borderRadius: 6, padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: resolvedName ? '0.5rem' : 0 }}>
            <span>Resolved to token ID <strong>#{resolvedId}</strong></span>
            {agentFilter.includes('_@nftmail.box') && (
              <a
                href={`/agent-lookup?email=${encodeURIComponent(agentFilter)}`}
                style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'underline', fontSize: '0.72rem' }}
              >
                Details →
              </a>
            )}
          </div>
          {resolvedName && (
            <div className="card" style={{ padding: '0.875rem 1rem', display: 'grid', gap: '0.6rem' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>GhostAgent Identity</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{resolvedName}</span>
                {agentIdentity?.identityNft && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{agentIdentity.identityNft.name} #{agentIdentity.identityNft.tokenId}</span>
                )}
              </div>

              {/* Identity layers grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1.5rem', fontSize: '0.75rem' }}>

                {/* Identity NFT */}
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Identity NFT</div>
                  {agentIdentity?.identityNft ? (
                    <div style={{ fontWeight: 600 }}>
                      {agentIdentity.identityNft.name}
                      {agentIdentity.identityNft.tokenId != null && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> #{agentIdentity.identityNft.tokenId}</span>}
                    </div>
                  ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  {agentIdentity?.identityNft?.owner && (
                    <div style={{ color: 'var(--muted)', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                      {agentIdentity.identityNft.owner.slice(0, 8)}…{agentIdentity.identityNft.owner.slice(-6)}
                    </div>
                  )}
                </div>

                {/* Safe */}
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Safe (Treasury)</div>
                  {agentIdentity?.safe ? (
                    <a href={`https://app.safe.global/home?safe=gno:${agentIdentity.safe}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--red)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {agentIdentity.safe.slice(0, 8)}…{agentIdentity.safe.slice(-6)} ↗
                    </a>
                  ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </div>

                {/* Story IP */}
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Story IP</div>
                  {agentIdentity?.storyIp ? (
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {agentIdentity.storyIp.slice(0, 10)}…
                    </span>
                  ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </div>

                {/* ERC-8004 IDs */}
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>ERC-8004</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {agentIdentity?.erc8004?.gnosis && (
                      <a href={`https://8004agents.ai/gnosis/agent/${agentIdentity.erc8004.gnosis.agentId}#metadata`} target="_blank" rel="noopener noreferrer" style={{ color: '#1a7a4a', fontWeight: 600, textDecoration: 'none' }}>Gnosis #{agentIdentity.erc8004.gnosis.agentId} ↗</a>
                    )}
                    {agentIdentity?.erc8004?.base && (
                      <a href={`https://8004agents.ai/base/agent/${agentIdentity.erc8004.base.agentId}#metadata`} target="_blank" rel="noopener noreferrer" style={{ color: '#0052ff', fontWeight: 600, textDecoration: 'none' }}>Base #{agentIdentity.erc8004.base.agentId} ↗</a>
                    )}
                    {agentIdentity?.erc8004?.baseSepolia && (
                      <a href={`https://8004agents.ai/base-sepolia/agent/${agentIdentity.erc8004.baseSepolia.agentId}#metadata`} target="_blank" rel="noopener noreferrer" style={{ color: '#6b8cff', fontWeight: 600, textDecoration: 'none' }}>Base Sepolia #{agentIdentity.erc8004.baseSepolia.agentId} ↗</a>
                    )}
                    {!agentIdentity && <span style={{ color: 'var(--muted)' }}>#{resolvedId}</span>}
                  </div>
                </div>
              </div>

              {/* Agent Companies card */}
              {companyManifest && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>companies.sh</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{companyManifest.name}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'monospace' }}>schema: {companyManifest.schema}</span>
                  <a href={companyManifest.sourceUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, textDecoration: 'none', marginLeft: 'auto' }}>AGENTS.md ↗</a>
                  <a href="https://companies.sh" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.68rem', color: 'var(--muted)', textDecoration: 'none' }}>companies.sh ↗</a>
                </div>
              )}

              {/* Links row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border)' }}>
                <a href={`https://ghostagent.ninja/agent/${resolvedName}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 600, textDecoration: 'none' }}>Profile ↗</a>
                {agentIdentity?.erc8004?.base ? (
                  <a href={`https://8004agents.ai/base/agent/${agentIdentity.erc8004.base.agentId}#metadata`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 600, textDecoration: 'none' }}>ERC-8004 Card ↗</a>
                ) : (
                  <a href={`https://ghostagent.ninja/api/agent-card?agent=${resolvedName}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 600, textDecoration: 'none' }}>ERC-8004 Card ↗</a>
                )}
                <a href={`/a2a?agent=${encodeURIComponent(resolvedName ?? '')}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 600, textDecoration: 'none' }}>A2A Card ↗</a>
                <a href="https://ghostagent.ninja/agents" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: 'var(--muted)', textDecoration: 'none' }}>Agent Registry ↗</a>
                {agentIdentity?.erc8004?.gnosis && (
                  <a
                    href={`https://gnosisscan.io/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${agentIdentity.erc8004.gnosis.agentId}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                    title="Independently verify this agent on Gnosisscan">
                    Verify on Gnosisscan ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {resolveErr && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--red)', background: 'var(--red-light)', border: '1px solid var(--red-mid)', borderRadius: 6, padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
          {resolveErr.startsWith('__HANDSHAKE__') ? (
            <>
              <span>
                <strong>{resolveErr.replace('__HANDSHAKE__', '')}</strong> is not a GhostAgent name.
                {' '}To look up full on-chain identity for any ERC-8004 agent,{' '}
              </span>
              <a
                href={`/handshakes`}
                style={{ color: 'var(--red)', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}
              >
                use Handshake Telemetry → By ERC-8004 Token ID
              </a>
            </>
          ) : resolveErr}
        </div>
      )}

      {/* Stats row */}
      {data && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Events', value: data.total },
            { label: 'Chains', value: data.chains.length },
            { label: 'Errors', value: data.errors?.length ?? 0 },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '0.625rem 1.125rem', textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* API errors */}
      {data?.errors && data.errors.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
          {data.errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Event table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '7rem 1fr 5.5rem 5rem 9rem', gap: '0.5rem' }}>
          <span>Chain</span>
          <span>Event</span>
          <span>Agent ID</span>
          <span>Block</span>
          <span>Tx</span>
        </div>

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
            <div className="spinner" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '0.875rem' }}>Fetching on-chain events…</div>
          </div>
        )}

        {data && data.events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
            No events found in the last ~2000 blocks.{agentFilter ? ` No events for agent ID “${agentFilter}”.` : ''}
          </div>
        )}

        {data && data.events.map((ev, i) => {
          const explorerBase = EXPLORER[ev.chainId] ?? 'https://gnosisscan.io/tx/';
          const dot = chainDot(ev.chain);
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '7rem 1fr 5.5rem 5rem 9rem',
              gap: '0.5rem', alignItems: 'center',
              padding: '0.6rem 1.125rem',
              borderBottom: i < data.events.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: '0.8rem',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 500 }}>{ev.chain}</span>
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{ev.eventType}</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--red)' }}>
                {ev.agentId === '?' ? <span style={{ color: 'var(--muted)' }}>?</span> : (
                  <a href={`/?swarm=${encodeURIComponent(ev.agentId)}`} style={{ color: 'var(--red)', textDecoration: 'none' }}>#{ev.agentId}</a>
                )}
              </span>
              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{ev.block.toLocaleString()}</span>
              <a href={`${explorerBase}${ev.txHash}`} target="_blank" rel="noopener noreferrer"
                className="mono" style={{ fontSize: '0.7rem', color: 'var(--red)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.txHash.slice(0, 10)}… ↗
              </a>
            </div>
          );
        })}
      </div>

      {/* Contract chips */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Gnosis Registry', addr: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', href: 'https://gnosisscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' },
          { label: 'Base Registry', addr: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', href: 'https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' },
          { label: 'Base Sepolia Registry', addr: '0x8004A818BFB912233c491871b3d84c89A494BD9e', href: 'https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e' },
        ].map((c, i) => (
          <a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
            className="card" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', textDecoration: 'none' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{c.label}</span>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--red)' }}>{c.addr.slice(0, 10)}…</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>↗</span>
          </a>
        ))}
      </div>

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>Live on-chain data · Not affiliated with any single provider</div>
      </footer>

    </div>
  );
}

export default function Erc8004FeedPage() {
  return (
    <Suspense fallback={<div className="page-wrap-wide" style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--muted)' }}>Loading…</div>}>
      <Erc8004FeedInner />
    </Suspense>
  );
}
