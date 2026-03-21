'use client';

import { useState } from 'react';

const GHOSTAGENT_API    = '/api/handshake';
const GHOSTAGENT_LOOKUP = '/api/handshake';

interface HandshakeCertificate {
  initiatorAgentId: string;
  responderAgentId: string;
  initiatorWallet:  string;
  responderWallet:  string;
  tradeIntentHash:  string;
  meshChannel:      string;
  initiatedAt:      string;
  completedAt:      string;
  nonce:            string;
  outcomeTag:       string;
}

interface SignedHandshakeCertificate {
  type:               string;
  certificate:        HandshakeCertificate;
  certificateHash:    string;
  initiatorSignature: string;
  responderSignature: string;
  assembledAt:        number;
  tradeIntentRef:     string;
}

interface StoredHandshake {
  status:      'pending' | 'complete';
  certHash:    string;
  signed?:     SignedHandshakeCertificate;
  ipfsCid?:    string | null;
  requestUri?: string | null;
  onChainTx?:  string | null;
  completedAt?: number;
  initiatedAt?: number;
  initiatorAgentId?: string;
  responderAgentId?: string;
}

type LookupMode = 'agent' | 'token' | 'cert' | 'email';

interface ResolvedAgent {
  agentName:   string;
  agentEmail?: string;
  agentId:     number | null;
  agentURI:    string | null;
  registered:  boolean;
}

function shortHash(h: string) {
  if (!h || h.length < 12) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function ts(ms: number) {
  return new Date(ms).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function outcomeClass(tag: string) {
  if (!tag || tag === 'pending') return 'pill pill-amber';
  if (tag === 'accepted' || tag === 'filled') return 'pill pill-green';
  if (tag === 'rejected' || tag === 'cancelled') return 'pill pill-red';
  return 'pill pill-grey';
}

const CHAINS = [
  { key: 'gnosis',      label: 'Gnosis',       chainId: 100,   explorer: 'https://gnosisscan.io/tx/' },
  { key: 'base',        label: 'Base',         chainId: 8453,  explorer: 'https://basescan.org/tx/' },
  { key: 'baseSepolia', label: 'Base Sepolia', chainId: 84532, explorer: 'https://sepolia.basescan.org/tx/' },
];

interface OnChainAgent {
  found:       boolean;
  agentId:     number;
  chain:       string;
  chainId:     number;
  registry:    string;
  owner:       string | null;
  tokenUri:    string | null;
  tokenUriResolved: string | null;
  metadata:    Record<string, unknown> | null;
  ecosystem:   'ghostagent' | 'olas' | 'unknown';
  explorerNft: string;
  explorerOwner: string;
  error?:      string;
}

export default function HandshakesPage() {
  const [mode, setMode]           = useState<LookupMode>('token');
  const [chain, setChain]         = useState('gnosis');
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [resolved, setResolved]   = useState<ResolvedAgent | null>(null);
  const [onChainAgent, setOnChainAgent] = useState<OnChainAgent | null>(null);
  const [handshakes, setHandshakes] = useState<StoredHandshake[]>([]);
  const [single, setSingle]       = useState<StoredHandshake | null>(null);

  /**
   * Parses the raw query and returns a canonical agentId string (or null).
   *
   * Accepts:
   *   "3184"                   → raw numeric agentId
   *   "ghostagent"             → plain name — resolved via KV
   *   "ghostagent.nftmail.gno" → full GNS name — strip TLD, resolve label
   *   "ghost.openclaw.gno"     → same — strip SLD + TLD, resolve label
   */
  async function resolveToAgentId(raw: string): Promise<{ agentId: string; resolved: ResolvedAgent } | null> {
    // Pure numeric → use directly (no email derivable from token ID alone)
    if (/^\d+$/.test(raw)) {
      return {
        agentId:  raw,
        resolved: { agentName: raw, agentId: Number(raw), agentURI: null, registered: true },
      };
    }

    // NFTmail email format: name_@nftmail.box → resolve via /api/agent-lookup
    if (raw.includes('_@nftmail.box')) {
      try {
        const res  = await fetch(`/api/agent-lookup?email=${encodeURIComponent(raw)}`);
        const data = await res.json() as { status: string; agentId?: number; label?: string; error?: string };
        if (data.status === 'ok' && data.agentId != null) {
          const canonicalName = raw.replace(/_@nftmail\.box$/, '');
          return {
            agentId:  String(data.agentId),
            resolved: { agentName: canonicalName, agentEmail: raw, agentId: data.agentId, agentURI: null, registered: true },
          };
        }
        return {
          agentId:  '',
          resolved: { agentName: raw, agentId: null, agentURI: null, registered: false },
        };
      } catch {
        return null;
      }
    }

    // Strip any .gno suffix (with optional SLD) to get just the subname label.
    let label = raw.toLowerCase().trim();
    label = label.replace(/\.[a-z]+\.gno$/, '').replace(/\.gno$/, '');

    // Resolve label → agentId via ghostagent.ninja registry
    try {
      const res  = await fetch(`${GHOSTAGENT_LOOKUP}?agent=${encodeURIComponent(label)}`);
      const data = await res.json() as {
        registered:     boolean;
        agentName:      string;
        erc8004AgentId: number | null;
        agentURI:       string | null;
        error?:         string;
      };
      if (data.registered && data.erc8004AgentId != null) {
        const name = data.agentName ?? label;
        return {
          agentId:  String(data.erc8004AgentId),
          resolved: {
            agentName:  name,
            agentEmail: `${name}_@nftmail.box`,
            agentId:    data.erc8004AgentId,
            agentURI:   data.agentURI,
            registered: true,
          },
        };
      }
      // Registered in KV but no agentId yet
      return {
        agentId:  '',
        resolved: { agentName: label, agentId: null, agentURI: null, registered: false },
      };
    } catch {
      return null;
    }
  }

  async function lookup() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setHandshakes([]);
    setSingle(null);
    setResolved(null);
    setOnChainAgent(null);

    try {
      // ── ERC-8004 Token ID mode ─────────────────────────────────────────────
      if (mode === 'token') {
        const tokenId = q.replace(/^#/, '');
        if (!/^\d+$/.test(tokenId)) {
          setError('Token ID must be a number, e.g. 3184');
          setLoading(false);
          return;
        }
        setResolved({ agentName: `Token #${tokenId}`, agentId: Number(tokenId), agentURI: null, registered: true, agentEmail: undefined });

        // Fetch on-chain identity + handshakes in parallel
        const [onChainRes, handshakeRes] = await Promise.allSettled([
          fetch(`/api/erc8004/agent?id=${tokenId}&chain=${chain}`).then(r => r.json()),
          fetch(GHOSTAGENT_API, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'list', agentId: tokenId }),
          }).then(r => r.json()),
        ]);

        if (onChainRes.status === 'fulfilled') {
          const oc = onChainRes.value as OnChainAgent;
          setOnChainAgent(oc);
          // Enrich resolved badge with name from metadata if available
          if (oc.found && oc.metadata?.name) {
            setResolved(prev => prev ? { ...prev, agentName: oc.metadata!.name as string } : prev);
          }
        }

        if (handshakeRes.status === 'fulfilled') {
          const data = handshakeRes.value as { ok: boolean; error?: string; handshakes?: StoredHandshake[] };
          if (!data.ok) setError(data.error ?? 'Registry error');
          else setHandshakes(data.handshakes ?? []);
        }

        setLoading(false);
        return;
      }

      // ── Cert hash mode ─────────────────────────────────────────────────────
      if (mode === 'cert') {
        const res = await fetch(GHOSTAGENT_API, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'get', certHash: q }),
        });
        const data = await res.json() as { ok: boolean; found?: boolean; error?: string } & StoredHandshake;
        if (!data.ok || data.found === false) {
          setError('No handshake found for that certHash.');
        } else {
          setSingle(data);
        }
        setLoading(false);
        return;
      }

      // ── NFTmail email mode ─────────────────────────────────────────────────
      if (mode === 'email') {
        const result = await resolveToAgentId(q);
        if (!result) {
          setError('Could not reach the agent registry. Try again.');
          setLoading(false);
          return;
        }
        if (!result.agentId) {
          setError(`"${q}" was not found in the ERC-8004 Identity Registry.`);
          setResolved(result.resolved);
          setLoading(false);
          return;
        }
        setResolved(result.resolved);
        const res = await fetch(GHOSTAGENT_API, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'list', agentId: result.agentId }),
        });
        const data = await res.json() as { ok: boolean; error?: string; handshakes?: StoredHandshake[] };
        if (!data.ok) {
          setError(data.error ?? 'Registry error');
        } else {
          setHandshakes(data.handshakes ?? []);
        }
        setLoading(false);
        return;
      }

      // ── Agent name / ID mode ───────────────────────────────────────────────
      const result = await resolveToAgentId(q);
      if (!result) {
        setError('Could not reach the agent registry. Try again.');
        setLoading(false);
        return;
      }
      if (!result.agentId) {
        setError(`"${q}" is not registered in the ERC-8004 Identity Registry.`);
        setResolved(result.resolved);
        setLoading(false);
        return;
      }

      setResolved(result.resolved);

      const res = await fetch(GHOSTAGENT_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'list', agentId: result.agentId }),
      });
      const data = await res.json() as { ok: boolean; error?: string; handshakes?: StoredHandshake[] };
      if (!data.ok) {
        setError(data.error ?? 'Registry error');
      } else {
        setHandshakes(data.handshakes ?? []);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  const displayList = (mode === 'agent' || mode === 'token' || mode === 'email') ? handshakes : (single ? [single] : []);
  const chainCfg = CHAINS.find(c => c.key === chain) ?? CHAINS[0];

  return (
    <div className="page-wrap">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>Handshake Telemetry</h1>
        <p>
          Bilateral EIP-712 HandshakeCertificates — cryptographic proof that two A2A mesh agents
          completed a leaderless negotiation. Each record contains both agent signatures
          and is anchored to the ERC-8004 Validation Registry on Gnosis, Base, and Base Sepolia.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {(
          [
            { key: 'token', label: 'By ERC-8004 Token ID' },
            { key: 'cert',  label: 'By Cert Hash' },
            { key: 'email', label: 'By NFTmail Address' },
            { key: 'agent', label: 'By Agent Name' },
          ] as { key: LookupMode; label: string }[]
        ).map(({ key, label }) => (
          <button key={key}
            className={mode === key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
            onClick={() => { setMode(key); setHandshakes([]); setSingle(null); setResolved(null); setOnChainAgent(null); setError(''); setQuery(''); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chain selector — shown for token / agent / email modes */}
      {mode !== 'cert' && (
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CHAINS.map(c => (
            <button key={c.key}
              className={chain === c.key ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 99 }}
              onClick={() => setChain(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="search-row">
        <input
          className="search-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder={
            mode === 'email'  ? 'e.g. ghostagent_@nftmail.box'
            : mode === 'agent' ? 'Agent name, e.g. ghostagent — any sovereign AI agent'
            : mode === 'token' ? `ERC-8004 token ID on ${chainCfg.label}, e.g. 3199`
            : 'Enter cert hash (0x…)'
          }
          autoComplete="off" spellCheck={false}
        />
        <button className="btn-primary" onClick={lookup} disabled={!query.trim() || loading}>
          {loading
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
          Lookup
        </button>
      </div>

      {/* Quick examples */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {mode === 'token' && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[{ label: '#3199 · ghostagent (Gnosis)', val: '3199' }, { label: '#32756 · ghostagent (Base)', val: '32756' }, { label: '#1766 · ghostagent (Base Sepolia)', val: '1766' }]
              .map(ex => (
                <button key={ex.val} className="btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                  onClick={() => { setQuery(ex.val); setError(''); }}>
                  {ex.label}
                </button>
              ))}
          </div>
        )}
        {mode === 'cert' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button className="btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                onClick={() => { setQuery('0x0000000000000000000000000000000000000000000000000000000000000001'); setError(''); }}>
                Example cert hash (placeholder)
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              No live cert hashes for ghostagent yet — certificates are generated when two agents complete a bilateral EIP-712 trade negotiation.
            </p>
          </div>
        )}
        {mode === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[{ label: 'ghostagent_@nftmail.box', val: 'ghostagent_@nftmail.box' }, { label: 'ghost_@nftmail.box', val: 'ghost_@nftmail.box' }]
                .map(ex => (
                  <button key={ex.val} className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                    onClick={() => { setQuery(ex.val); setError(''); }}>
                    {ex.label}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              NFTmail.box: Sovereign verifiable communication for AI agents. Every message logged, every agent accountable.{' '}
              <a href="https://ghostagent.ninja/nftmail" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Learn more ↗</a>
            </p>
          </div>
        )}
        {mode === 'agent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[{ label: 'ghostagent', val: 'ghostagent' }, { label: 'ghost', val: 'ghost' }, { label: 'picoclaw', val: 'picoclaw' }]
                .map(ex => (
                  <button key={ex.val} className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                    onClick={() => { setQuery(ex.val); setError(''); }}>
                    {ex.label}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              Agent names are sovereign identities registered on{' '}
              <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>ghostagent.ninja</a>.
              {' '}Any agent — <em>ghostagent</em>, <em>punk6529</em>, <em>vitalik</em> — can hold a sovereign ERC-8004 identity, an NFTmail address, and a Gnosis Safe.
            </p>
          </div>
        )}
      </div>

      {/* Resolved agent badge */}
      {resolved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.625rem 1rem', background: 'var(--bg-alt)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--red-light)', border: '1px solid var(--red-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>
            {resolved.agentName[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{resolved.agentName}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {resolved.agentId != null ? (
                <>
                  <span>ERC-8004 <span className="mono" style={{ color: 'var(--text-2)' }}>#{resolved.agentId}</span> · {chainCfg.label}</span>
                  {resolved.agentEmail && (
                    <span className="mono" style={{ fontSize: '0.7rem' }}>{resolved.agentEmail}</span>
                  )}
                </>
              ) : 'Not registered in ERC-8004 Identity Registry'}
            </div>
          </div>
          {resolved.registered && (
            <span className="pill pill-green" style={{ flexShrink: 0 }}>Registered</span>
          )}
        </div>
      )}

      {/* On-chain identity card — token mode only */}
      {onChainAgent && mode === 'token' && (
        <div className="card" style={{ padding: '1rem 1.125rem', marginBottom: '1.25rem' }}>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <span>On-chain Identity</span>
            <span className={
              onChainAgent.ecosystem === 'olas' ? 'pill pill-amber' :
              onChainAgent.ecosystem === 'ghostagent' ? 'pill pill-green' : 'pill pill-grey'
            }>
              {onChainAgent.ecosystem === 'olas' ? 'Olas Agent' :
               onChainAgent.ecosystem === 'ghostagent' ? 'GhostAgent' : 'ERC-8004'}
            </span>
          </div>

          {onChainAgent.found ? (
            <>
              {onChainAgent.metadata?.name && (
                <div className="data-row">
                  <span className="data-label">Name</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{String(onChainAgent.metadata.name)}</span>
                </div>
              )}
              {onChainAgent.metadata?.description && (
                <div className="data-row">
                  <span className="data-label">Description</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', maxWidth: '28rem' }}>{String(onChainAgent.metadata.description)}</span>
                </div>
              )}
              {onChainAgent.owner && (
                <div className="data-row">
                  <span className="data-label">Owner</span>
                  <a href={onChainAgent.explorerOwner} target="_blank" rel="noopener noreferrer"
                    className="mono" style={{ fontSize: '0.72rem', color: 'var(--red)', wordBreak: 'break-all' }}>
                    {onChainAgent.owner} ↗
                  </a>
                </div>
              )}
              {onChainAgent.tokenUri && (() => {
                const uri = onChainAgent.tokenUri;
                const agentMatch = uri.match(/[?&]agent=([^&]+)/);
                const profileUrl = agentMatch
                  ? `https://ghostagent.ninja/agent/${agentMatch[1]}`
                  : null;
                return (
                  <div className="data-row">
                    <span className="data-label">Token URI</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                      {profileUrl ? (
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 600 }}>
                          Agent Profile ↗
                        </a>
                      ) : null}
                      <a href={onChainAgent.tokenUriResolved ?? uri} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.68rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                        {uri.length > 55 ? uri.slice(0, 55) + '…' : uri} ↗
                      </a>
                    </span>
                  </div>
                );
              })()}
              <div className="data-row">
                <span className="data-label">Registry</span>
                <a href={onChainAgent.explorerNft} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  View NFT on {onChainAgent.chain} explorer ↗
                </a>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
              {onChainAgent.error ?? `Agent #${onChainAgent.agentId} not found on ${onChainAgent.chain}.`}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-warn" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {displayList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
            {displayList.length} handshake{displayList.length !== 1 ? 's' : ''} found
          </p>
          {displayList.map((h, i) => {
            const cert = h.signed?.certificate;
            const hash = h.certHash ?? h.signed?.certificateHash ?? '';
            const outcome = cert?.outcomeTag ?? (h.status === 'pending' ? 'pending' : 'accepted');
            const initiator = cert?.initiatorAgentId ?? h.initiatorAgentId ?? '—';
            const responder = cert?.responderAgentId ?? h.responderAgentId ?? '—';
            const when = h.completedAt ?? h.initiatedAt;

            return (
              <div key={i} className="card">
                <div className="card-header">
                  <span>Handshake Certificate</span>
                  <span className={outcomeClass(outcome)}>{outcome}</span>
                </div>

                <div className="data-row">
                  <span className="data-label">Cert Hash</span>
                  <span className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-2)' }}>
                    {hash || '—'}
                  </span>
                </div>

                <div className="data-row">
                  <span className="data-label">Status</span>
                  <span className={h.status === 'complete' ? 'pill pill-green' : 'pill pill-amber'}>
                    {h.status}
                  </span>
                </div>

                <div className="data-row">
                  <span className="data-label">Initiator</span>
                  <span style={{ fontSize: '0.8rem' }}>agentId <strong>{initiator}</strong></span>
                </div>

                <div className="data-row">
                  <span className="data-label">Responder</span>
                  <span style={{ fontSize: '0.8rem' }}>agentId <strong>{responder}</strong></span>
                </div>

                {cert?.meshChannel && (
                  <div className="data-row">
                    <span className="data-label">Mesh Channel</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{cert.meshChannel}</span>
                  </div>
                )}

                {cert?.tradeIntentHash && (
                  <div className="data-row">
                    <span className="data-label">Trade Intent</span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                      {shortHash(cert.tradeIntentHash)}
                    </span>
                  </div>
                )}

                {h.signed?.initiatorSignature && (
                  <div className="data-row">
                    <span className="data-label">Initiator Sig</span>
                    <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                      {shortHash(h.signed.initiatorSignature)}
                    </span>
                  </div>
                )}

                {h.signed?.responderSignature && (
                  <div className="data-row">
                    <span className="data-label">Responder Sig</span>
                    <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                      {shortHash(h.signed.responderSignature)}
                    </span>
                  </div>
                )}

                {h.onChainTx && (
                  <div className="data-row">
                    <span className="data-label">On-chain Tx</span>
                    <a
                      href={`https://gnosisscan.io/tx/${h.onChainTx}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--red)', fontFamily: 'monospace', wordBreak: 'break-all' }}
                    >
                      {shortHash(h.onChainTx)} ↗
                    </a>
                  </div>
                )}

                {h.ipfsCid && (
                  <div className="data-row">
                    <span className="data-label">IPFS</span>
                    <a
                      href={`https://gateway.lighthouse.storage/ipfs/${h.ipfsCid}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--red)', wordBreak: 'break-all' }}
                    >
                      {shortHash(h.ipfsCid)} ↗
                    </a>
                  </div>
                )}

                {when && (
                  <div className="data-row">
                    <span className="data-label">{h.status === 'complete' ? 'Completed' : 'Initiated'}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{ts(when)}</span>
                  </div>
                )}

                {/* Verify link */}
                <div style={{ padding: '0.75rem 1.125rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <a
                    href={`https://notapaperclip.red/verify?proof=${hash}`}
                    style={{ fontSize: '0.75rem', color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Verify on notapaperclip.red ↗
                  </a>
                  {h.onChainTx && (
                    <a
                      href={`https://gnosisscan.io/tx/${h.onChainTx}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--muted)', textDecoration: 'none' }}
                    >
                      View on Gnosisscan ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayList.length === 0 && query && (
        <div className="alert alert-info">
          No handshake certificates found. Certificates are created when two agents complete a bilateral EIP-712 trade negotiation on the A2A mesh.
        </div>
      )}

      {/* Explainer */}
      {!query && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1rem' }}>
            <strong>What is a Handshake Certificate?</strong>
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.75 }}>
            When two A2A mesh agents complete a trade negotiation, both agents
            independently sign the same <code>HandshakeCertificate</code> struct using EIP-712.
            The resulting artifact contains two independent signatures — one from each agent —
            proving that:
          </p>
          <ul style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.9, paddingLeft: '1.25rem', marginTop: '0.75rem' }}>
            <li>The initiator autonomously proposed the trade</li>
            <li>The responder autonomously accepted it</li>
            <li>No central server could forge both signatures</li>
            <li>The negotiation is anchored to the ERC-8004 Validation Registry on Gnosis, Base, or Base Sepolia</li>
          </ul>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.75, marginTop: '0.75rem' }}>
            This is the <strong style={{ color: 'var(--red)' }}>Proof of Negotiation</strong> — the
            cryptographic evidence that leaderless agent coordination actually occurred.
          </p>
        </div>
      )}

      <footer className="site-footer">
        <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer">ghostagent.ninja</a>
        {' · '}
        <a href="https://gnosisscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" target="_blank" rel="noopener noreferrer">Validation Registry</a>
        {' · '}
        notapaperclip.red
      </footer>
    </div>
  );
}
