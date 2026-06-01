'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Erc8004CardPanel } from '../components/Erc8004CardPanel';
import { CHAIN_ORDER, CHAINS } from '../../lib/chains';

type LookupMode = 'agent' | 'token' | 'email' | 'erc8048';

interface FootprintData {
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
    principal: string | null;
    surgeScore: number;
    mcpServers: string[];
    gnsName: string | null;
    hasX402Capability: boolean;
    nftImage?: string | null;
    nftImageSource?: 'paired' | 'beacon' | null;
    pairedNftInfo?: { nftType: string; tokenId: string; collectionName?: string } | null;
    ensSocial?: {
      ensName: string | null;
      name: string | null;
      description: string | null;
      avatar: string | null;
      url: string | null;
      twitter: string | null;
      github: string | null;
      email: string | null;
    } | null;
  };
  spendProfile?: {
    balance: number | null;
    totalSpent24h: number;
    totalSpent7d: number;
    dailyBurnRate: number;
    runwayDays: number | null;
    livenessStatus: 'active' | 'idle' | 'dormant';
    healthStatus: string;
    healthLabel: string;
    vendorBreakdown: Array<{ vendor: string; spent: number; txCount: number }>;
    anomalies: Array<{ type: string; description: string; severity: string }>;
  } | null;
  exposure: {
    hasPublicEndpoints: boolean;
    hasMCPServers: boolean;
    hasGNSName: boolean;
    hasX402Capability: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  erc8004Card?: {
    agentId: number;
    chain: string;
    registry: string;
    agentURI: string;
    owner: string | null;
    name: string | null;
    description: string | null;
    image: string | null;
    services: Array<{ name: string; endpoint: string; version?: string }> | null;
    skills: Array<{ id?: string; name: string; description?: string; tags?: string[] }> | null;
    a2aEndpoint: string | null;
    x402Support: boolean | null;
    explorerUrl: string;
    binding: {
      bindingContract: string;
      tokenStandard: string;
      tokenContract: string;
      tokenId: string;
      verified: boolean;
    } | null;
    pairedAgent: { name: string; chain: string; agentId: number } | null;
  } | null;
}

interface RelationsData {
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

interface ExposureData {
  agent: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exposures: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  score: number;
}

interface X402Data {
  agent: string;
  x402: {
    enabled: boolean;
    micropaymentReady: boolean;
    supportedChains: string[];
    paymentEndpoints: Array<{
      url: string;
      supportsX402: boolean;
      methods: string[];
    }>;
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

interface GlassboxData {
  agent: string;
  glassbox_data?: {
    source: 'molt.gno' | 'openclaw.gno';
    transparency_score: number;
    transaction_analysis: {
      total_transactions: number;
      total_value: string;
      unique_counterparties: number;
      avg_transaction_value: string;
      frequency_per_day: number;
    };
    network_intelligence: {
      centrality_score: number;
      connection_count: number;
      interaction_types: string[];
      risk_factors: string[];
    };
    behavioral_patterns: {
      activity_frequency: number;
      detected_patterns: string[];
      predictive_confidence: number;
    };
  };
  fallback_osint: {
    footprint: FootprintData | null;
    exposure: ExposureData | null;
    basic_reliability: number;
  };
  confidence_score: number;
  timestamp: string;
}

export default function OSINTDashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OSINTDashboardContent />
    </Suspense>
  );
}

function OSINTDashboardContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LookupMode>('agent');
  const [chain, setChain] = useState('gnosis');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [footprint, setFootprint] = useState<FootprintData | null>(null);
  const [relations, setRelations] = useState<RelationsData | null>(null);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [x402, setX402] = useState<X402Data | null>(null);
  const [glassbox, setGlassbox] = useState<GlassboxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle URL parameters
  useEffect(() => {
    const urlMode = searchParams.get('mode') as LookupMode;
    const urlAgent = searchParams.get('agent');
    const urlChain = searchParams.get('chain');
    
    if (urlMode && ['agent', 'token', 'email'].includes(urlMode)) {
      setMode(urlMode);
    }
    
    if (urlChain) {
      // Validate chain exists in CHAINS array
      const validChain = CHAINS[urlChain];
      if (validChain) {
        setChain(urlChain);
      } else {
        // Fallback to gnosis for unknown chains
        setChain('gnosis');
      }
    }
    
    if (urlAgent) {
      const activeChain = (urlChain && CHAINS[urlChain]) ? urlChain : 'gnosis';
      setAgentName(urlAgent);
      setChain(activeChain);
      setTimeout(() => fireQueries(encodeURIComponent(urlAgent.trim()), `&chain=${activeChain}`), 50);
    }
  }, [searchParams]);

  function fireQueries(enc: string, cp: string) {
    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true); setError(null); setLoadingStep('Querying ERC-8004 registry…');
    setFootprint(null); setRelations(null); setExposure(null); setX402(null); setGlassbox(null);
    let pending = 5;
    const done = () => { if (--pending <= 0) { setLoading(false); setLoadingStep(''); abortControllerRef.current = null; } };

    const signal = controller.signal;

    fetch(`/api/osint/footprint?agent=${enc}${cp}`, { signal })
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(new Error(e.error || 'Footprint failed'))))
      .then(d => { setFootprint(d); setLoadingStep('Mapping agent network…'); done(); })
      .catch((e: any) => { if (e.name !== 'AbortError') { setError(e.message || 'Failed to analyze agent'); setLoading(false); setLoadingStep(''); } });

    fetch(`/api/osint/relations?agent=${enc}${cp}`, { signal })
      .then(r => r.ok ? r.json() : null).then(d => { setRelations(d); done(); }).catch((e: any) => { if (e.name !== 'AbortError') done(); });

    fetch(`/api/osint/exposure?agent=${enc}${cp}`, { signal })
      .then(r => r.ok ? r.json() : null).then(d => { setExposure(d); setLoadingStep('Checking x402…'); done(); }).catch((e: any) => { if (e.name !== 'AbortError') done(); });

    fetch(`/api/x402/probe?agent=${enc}${cp}`, { signal })
      .then(r => r.ok ? r.json() : null).then(d => { setX402(d); setLoadingStep('Collecting glassbox data…'); done(); }).catch((e: any) => { if (e.name !== 'AbortError') done(); });

    fetch(`/api/osint/glassbox-enhanced?agent=${enc}${cp}`, { signal })
      .then(r => r.ok ? r.json() : null).then(d => { setGlassbox(d); done(); }).catch((e: any) => { if (e.name !== 'AbortError') done(); });
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setLoadingStep('');
    setError('Query cancelled');
  }

  function handleAnalyze() {
    const q = agentName.trim();
    if (!q) return;

    if (mode === 'erc8048') {
      // ERC-8048 metadata search - separate logic
      setLoading(true);
      setError('');
      setFootprint(null); setRelations(null); setExposure(null); setX402(null); setGlassbox(null);

      fetch('/api/erc8048/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'byAgentId',
          agentId: parseInt(q),
        }),
      })
        .then(r => r.json())
        .then(d => {
          setLoading(false);
          if (d.success && d.results) {
            // Display ERC-8048 metadata in the footprint area
            const result = d.results[0];
            if (result) {
              setFootprint({
                agent: q,
                onChain: { safeAddress: null, tbaAddress: null, totalTransactions: 0, firstSeen: null, lastSeen: null, balances: [] },
                offChain: { tld: '', tier: '', principal: null, surgeScore: 0, mcpServers: [], gnsName: null, hasX402Capability: false },
                exposure: { hasPublicEndpoints: false, hasMCPServers: false, hasGNSName: false, hasX402Capability: false, riskLevel: 'low' },
                erc8048Metadata: result.metadata,
              } as any);
            }
          } else {
            setError(d.error || 'No ERC-8048 metadata found');
          }
        })
        .catch((e) => {
          setLoading(false);
          setError(String(e));
        });
      return;
    }

    let query = q;
    if (mode === 'token' && !query.startsWith('#')) query = `#${query}`;
    fireQueries(encodeURIComponent(query), `&chain=${chain}`);
  }

  return (
    <div className="page-wrap">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>OSINT Intelligence</h1>
        <p>
          Agent footprint analysis, network mapping, and exposure assessment.
          Search by GhostAgent name, ERC-8004 token ID, or NFTmail address.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {(
          [
            { key: 'token', label: 'By ERC-8004 Token ID' },
            { key: 'agent', label: 'By GhostAgent Name' },
            { key: 'email', label: 'By NFTmail Address' },
            { key: 'erc8048', label: 'ERC-8048 Metadata' },
          ] as { key: LookupMode; label: string }[]
        ).map(({ key, label }) => (
          <button key={key}
            className={mode === key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
            onClick={() => { setMode(key); setError(''); setAgentName(''); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chain selector — shown for token / agent modes */}
      {mode !== 'email' && (
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CHAIN_ORDER.map(key => {
            const c = CHAINS[key];
            if (!c) return null;
            return (
            <button key={c.key}
              className={chain === c.key ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 99 }}
              onClick={() => setChain(c.key)}
            >
              {c.label}
            </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="search-row">
        <input
          type="text"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder={
            mode === 'email'  ? 'e.g. ghostagent_@nftmail.box'
            : mode === 'agent' ? 'GhostAgent name, e.g. ghostagent'
            : mode === 'erc8048' ? 'ERC-8004 agent ID, e.g. 3199'
            : `ERC-8004 token ID on ${CHAINS[chain]?.label || 'Gnosis'}, e.g. 3199`
          }
          className="search-input"
          autoComplete="off" spellCheck={false}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !agentName.trim()}
          className="btn-primary"
        >
          {loading
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
          Analyze
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
                  onClick={() => { setAgentName(ex.val); setError(''); }}>
                  {ex.label}
                </button>
              ))}
          </div>
        )}
        {mode === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[{ label: 'ghostagent_@nftmail.box', val: 'ghostagent_@nftmail.box' }, { label: 'eyemine_@nftmail.box', val: 'eyemine_@nftmail.box' }]
                .map(ex => (
                  <button key={ex.val} className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                    onClick={() => { setAgentName(ex.val); setError(''); }}>
                    {ex.label}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              NFTmail.box: Sovereign verifiable communication for AI agents. Every message logged, every agent accountable.
            </p>
          </div>
        )}
        {mode === 'agent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[{ label: 'ghostagent', val: 'ghostagent' }, { label: 'eyemine', val: 'eyemine' }, { label: 'victor', val: 'victor' }]
                .map(ex => (
                  <button key={ex.val} className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                    onClick={() => { setAgentName(ex.val); setError(''); }}>
                    {ex.label}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              Agent names are sovereign identities registered on ghostagent.ninja.
            </p>
          </div>
        )}
        {mode === 'erc8048' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[{ label: '3199 (ghostagent)', val: '3199' }, { label: '3205 (eyemine)', val: '3205' }]
                .map(ex => (
                  <button key={ex.val} className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
                    onClick={() => { setAgentName(ex.val); setError(''); }}>
                    {ex.label}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              ERC-8048 metadata from GhostAgentMetadataRegistry on Gnosis.
            </p>
          </div>
        )}
        </div>

      {/* Error */}
      {error && (
        <div className="alert alert-warn" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Full spinner — only while no data has arrived yet */}
      {loading && !footprint && !relations && !exposure && !x402 && !glassbox && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)' }}>
          <div style={{ width: 56, height: 56, animation: 'spin 1.4s linear infinite', opacity: 0.75 }}>
            <svg viewBox="0 0 34 32" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
              <path fill="currentColor" d="M5.587,31.867c2.015,0,4.183-1.026,5.707-2.551l16.883-17.169c0.866-0.866,1.348-2.014,1.356-3.231c0.009-1.22-0.459-2.364-1.316-3.222c-1.768-1.767-4.661-1.751-6.462,0.048L8.814,19.272c-0.203,0.213-0.196,0.552,0.018,0.756c0.213,0.204,0.55,0.196,0.756-0.017L22.52,6.489c1.373-1.374,3.591-1.391,4.941-0.04c0.653,0.653,1.01,1.526,1.003,2.458c-0.006,0.935-0.377,1.816-1.046,2.486L10.535,28.563c-1.776,1.775-5.426,3.385-7.615,1.194c-1.037-1.037-1.557-2.309-1.503-3.679c0.053-1.36,0.693-2.72,1.807-3.833L22.52,2.661c1.026-1.026,2.629-1.62,4.396-1.626c0.011,0,0.021,0,0.032,0c1.752,0,3.333,0.577,4.342,1.586c1.016,1.015,1.594,2.609,1.587,4.374c-0.007,1.767-0.601,3.369-1.634,4.402L16.348,26.882c-0.205,0.213-0.198,0.551,0.015,0.756c0.212,0.204,0.551,0.198,0.755-0.015l14.888-15.478c1.225-1.224,1.932-3.1,1.939-5.146c0.009-2.047-0.684-3.919-1.899-5.134c-1.208-1.208-3.064-1.9-5.098-1.9c-0.012,0-0.024,0-0.036,0c-2.047,0.008-3.923,0.715-5.15,1.942L2.465,21.492c-2.701,2.701-2.827,6.495-0.301,9.021C3.111,31.459,4.318,31.867,5.587,31.867z"/>
            </svg>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)', textAlign: 'center' }}>
            <div>{loadingStep || 'Querying ERC-8004 registry…'}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>Collecting OSINT intelligence</div>
          </div>
        </div>
      )}

      {/* Compact progress bar — shown once data starts arriving but queries still pending */}
      {loading && (footprint || relations || exposure || x402 || glassbox) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.875rem', marginBottom: '0.75rem', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>
          <div style={{ width: 16, height: 16, animation: 'spin 1.4s linear infinite', flexShrink: 0 }}>
            <svg viewBox="0 0 34 32" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
              <path fill="currentColor" d="M5.587,31.867c2.015,0,4.183-1.026,5.707-2.551l16.883-17.169c0.866-0.866,1.348-2.014,1.356-3.231c0.009-1.22-0.459-2.364-1.316-3.222c-1.768-1.767-4.661-1.751-6.462,0.048L8.814,19.272c-0.203,0.213-0.196,0.552,0.018,0.756c0.213,0.204,0.55,0.196,0.756-0.017L22.52,6.489c1.373-1.374,3.591-1.391,4.941-0.04c0.653,0.653,1.01,1.526,1.003,2.458c-0.006,0.935-0.377,1.816-1.046,2.486L10.535,28.563c-1.776,1.775-5.426,3.385-7.615,1.194c-1.037-1.037-1.557-2.309-1.503-3.679c0.053-1.36,0.693-2.72,1.807-3.833L22.52,2.661c1.026-1.026,2.629-1.62,4.396-1.626c0.011,0,0.021,0,0.032,0c1.752,0,3.333,0.577,4.342,1.586c1.016,1.015,1.594,2.609,1.587,4.374c-0.007,1.767-0.601,3.369-1.634,4.402L16.348,26.882c-0.205,0.213-0.198,0.551,0.015,0.756c0.212,0.204,0.551,0.198,0.755-0.015l14.888-15.478c1.225-1.224,1.932-3.1,1.939-5.146c0.009-2.047-0.684-3.919-1.899-5.134c-1.208-1.208-3.064-1.9-5.098-1.9c-0.012,0-0.024,0-0.036,0c-2.047,0.008-3.923,0.715-5.15,1.942L2.465,21.492c-2.701,2.701-2.827,6.495-0.301,9.021C3.111,31.459,4.318,31.867,5.587,31.867z"/>
            </svg>
          </div>
          <span>{loadingStep || 'Still loading…'}</span>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(([footprint,relations,exposure,x402,glassbox].filter(Boolean).length / 5) * 100)}%`, background: 'var(--red)', transition: 'width 0.4s ease', borderRadius: 1 }} />
          </div>
          <span style={{ fontSize: '0.72rem' }}>{[footprint,relations,exposure,x402,glassbox].filter(Boolean).length}/5</span>
          <button
            onClick={handleCancel}
            className="btn-secondary"
            style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 99, flexShrink: 0 }}
          >
            Cancel
          </button>
        </div>
      )}

        {/* Results */}
        {(footprint || relations || exposure || x402) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* ERC-8004 Card panel (external agents like Normies) */}
            {footprint?.erc8004Card && (
              <Erc8004CardPanel card={footprint.erc8004Card} />
            )}

            {/* Footprint */}
            {footprint && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                {footprint.offChain.nftImage && (
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={footprint.offChain.nftImage}
                      alt="Agent NFT"
                      style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', background: 'var(--bg-alt)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {footprint.offChain.nftImageSource === 'paired' ? 'Paired NFT' : 'Beacon NFT'}
                    </div>
                  </div>
                )}
                <h2 style={{ marginBottom: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', alignSelf: 'center' }}>Digital Footprint</h2>
              </div>
                
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                  {/* On-chain */}
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>On-Chain Data</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Safe Address</span>
                        <span className="mono" style={{ color: 'var(--text)' }}>
                          {footprint.onChain.safeAddress ? 
                            `${footprint.onChain.safeAddress.slice(0, 6)}...${footprint.onChain.safeAddress.slice(-4)}` : 
                            '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>TBA Address</span>
                        <span className="mono" style={{ color: 'var(--text)' }}>
                          {footprint.onChain.tbaAddress ? 
                            `${footprint.onChain.tbaAddress.slice(0, 6)}...${footprint.onChain.tbaAddress.slice(-4)}` : 
                            '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Total Transactions</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.onChain.totalTransactions}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Balance</span>
                        <span style={{ color: 'var(--text)' }}>
                          {footprint.onChain.balances[0]?.amount || '0'} {footprint.onChain.balances[0]?.token || 'xDAI'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Off-chain */}
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>Off-Chain Data</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--muted)' }} title="NFT owner wallet — the human principal who controls this agent via their BYO NFT">NFT Owner Wallet</span>
                        <span className="mono" style={{ color: '#d97706', fontSize: '0.8rem' }}>
                          {footprint.offChain.principal ?
                            <a
                              href={`https://gnosisscan.io/address/${footprint.offChain.principal}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ color: '#d97706', textDecoration: 'none' }}
                              title={footprint.offChain.principal}
                            >
                              {footprint.offChain.principal.slice(0, 6)}…{footprint.offChain.principal.slice(-4)}
                            </a> :
                            '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>TLD</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.tld}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Tier</span>
                        <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{footprint.offChain.tier}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>GNS Name</span>
                        <span className="mono" style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                          {footprint.offChain.gnsName || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>MCP Servers</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.mcpServers.length}</span>
                      </div>
                      {(footprint.offChain as any).sandboxEmails?.human && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)', marginTop: '0.25rem' }}>
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sandbox Emails</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--muted)' }}>Human (HITL)</span>
                            <span className="mono" style={{ color: 'var(--text)' }}>{(footprint.offChain as any).sandboxEmails.human}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--muted)' }}>Agent (A2A)</span>
                            <span className="mono" style={{ color: 'var(--text)' }}>{(footprint.offChain as any).sandboxEmails.agent}</span>
                          </div>
                        </div>
                      )}
                      {footprint.offChain.pairedNftInfo && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Paired NFT</span>
                          <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                            {footprint.offChain.pairedNftInfo.collectionName
                              ? `${footprint.offChain.pairedNftInfo.collectionName} #${footprint.offChain.pairedNftInfo.tokenId}`
                              : `${footprint.offChain.pairedNftInfo.nftType} #${footprint.offChain.pairedNftInfo.tokenId}`}
                          </span>
                        </div>
                      )}
                      {!footprint.offChain.pairedNftInfo && footprint.offChain.nftImageSource === 'beacon' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>NFT Source</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Beacon (not paired)</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>x402 Ready</span>
                        <span style={{ color: footprint.offChain.hasX402Capability ? 'var(--green)' : 'var(--amber)' }}>
                          {footprint.offChain.hasX402Capability ? '✓ Yes' : '— No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ERC-8048 Metadata */}
                  {(footprint as any)?.erc8048Metadata && (
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>ERC-8048 Metadata</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                        {Object.entries((footprint as any).erc8048Metadata).map(([key, value]) => (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{key}</span>
                            <span className="mono" style={{ color: 'var(--text)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                              {String(value).length > 30 ? `${String(value).slice(0, 30)}…` : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ENS Social */}
                {footprint.offChain.ensSocial && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>ENS Social Profile</h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {footprint.offChain.ensSocial.avatar && (
                        <img src={footprint.offChain.ensSocial.avatar.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${footprint.offChain.ensSocial.avatar.slice(7)}` : footprint.offChain.ensSocial.avatar} alt="ENS avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, border: '1px solid var(--border)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', flex: 1 }}>
                        {footprint.offChain.ensSocial.name && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Name</span>
                            <span style={{ color: 'var(--text)' }}>{footprint.offChain.ensSocial.name}</span>
                          </div>
                        )}
                        {footprint.offChain.ensSocial.description && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Bio</span>
                            <span style={{ color: 'var(--text)', fontSize: '0.8rem', lineHeight: 1.4 }}>{footprint.offChain.ensSocial.description}</span>
                          </div>
                        )}
                        {footprint.offChain.ensSocial.twitter && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Twitter/X</span>
                            <a href={`https://x.com/${footprint.offChain.ensSocial.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none' }}>@{footprint.offChain.ensSocial.twitter.replace('@','')}</a>
                          </div>
                        )}
                        {footprint.offChain.ensSocial.github && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>GitHub</span>
                            <a href={`https://github.com/${footprint.offChain.ensSocial.github}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none' }}>{footprint.offChain.ensSocial.github}</a>
                          </div>
                        )}
                        {footprint.offChain.ensSocial.url && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Website</span>
                            <a href={footprint.offChain.ensSocial.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{footprint.offChain.ensSocial.url.replace(/^https?:\/\//, '')}</a>
                          </div>
                        )}
                        {footprint.offChain.ensSocial.email && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Email</span>
                            <span className="mono" style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{footprint.offChain.ensSocial.email}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>ENS Name</span>
                          <a href={`https://app.ens.domains/${footprint.offChain.ensSocial.ensName}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ color: 'var(--muted)', fontSize: '0.75rem', textDecoration: 'none' }}>{footprint.offChain.ensSocial.ensName}</a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AgentCash Spend Profile */}
                {footprint.spendProfile && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>AgentCash / Spend</h3>
                      <span className={`pill ${
                        footprint.spendProfile.healthStatus === 'healthy' ? 'pill-green' :
                        footprint.spendProfile.healthStatus === 'critical' ? 'pill-red' :
                        footprint.spendProfile.healthStatus === 'dormant' ? 'pill-grey' : 'pill-amber'
                      }`}>{footprint.spendProfile.livenessStatus.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Balance</span>
                          <span style={{ color: 'var(--text)' }}>{footprint.spendProfile.balance !== null ? `${footprint.spendProfile.balance} xDAI` : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Burn rate (7d avg)</span>
                          <span style={{ color: 'var(--text)' }}>{footprint.spendProfile.dailyBurnRate > 0 ? `${footprint.spendProfile.dailyBurnRate} xDAI/day` : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Runway</span>
                          <span style={{ color: footprint.spendProfile.runwayDays !== null && footprint.spendProfile.runwayDays < 3 ? 'var(--red)' : 'var(--text)' }}>
                            {footprint.spendProfile.runwayDays !== null ? `${footprint.spendProfile.runwayDays}d` : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Spent 24h</span>
                          <span style={{ color: 'var(--text)' }}>{footprint.spendProfile.totalSpent24h > 0 ? `${footprint.spendProfile.totalSpent24h} xDAI` : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Spent 7d</span>
                          <span style={{ color: 'var(--text)' }}>{footprint.spendProfile.totalSpent7d > 0 ? `${footprint.spendProfile.totalSpent7d} xDAI` : '—'}</span>
                        </div>
                      </div>
                      {footprint.spendProfile.vendorBreakdown.length > 0 && (
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Top Vendors</p>
                          {footprint.spendProfile.vendorBreakdown.slice(0, 4).map(v => (
                            <div key={v.vendor} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--muted)' }}>{v.vendor}</span>
                              <span style={{ color: 'var(--text)' }}>{v.spent} xDAI ({v.txCount} tx)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {footprint.spendProfile.anomalies.length > 0 && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {footprint.spendProfile.anomalies.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '4px', background: a.severity === 'high' ? 'rgba(239,68,68,0.08)' : a.severity === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${a.severity === 'high' ? 'rgba(239,68,68,0.2)' : a.severity === 'medium' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}` }}>
                            <span style={{ color: a.severity === 'high' ? 'var(--red)' : a.severity === 'medium' ? 'var(--amber)' : 'var(--muted)', flexShrink: 0, fontWeight: 600 }}>{a.severity.toUpperCase()}</span>
                            <span style={{ color: 'var(--text)' }}>{a.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>{footprint.spendProfile.healthLabel}</p>
                  </div>
                )}

                {/* Exposure summary */}
                <div style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Risk Level</span>
                    <span className={`pill ${footprint.exposure.riskLevel === 'low' ? 'pill-green' : footprint.exposure.riskLevel === 'medium' ? 'pill-amber' : 'pill-red'}`}>
                      {footprint.exposure.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>x402 Capability</span>
                    <span className={`pill ${footprint.exposure.hasX402Capability ? 'pill-green' : 'pill-grey'}`}>
                      {footprint.exposure.hasX402Capability ? 'BUILT-IN' : 'NONE'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Relations */}
            {relations && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Network Relations</h2>
                
                <div style={{ marginBottom: '1rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>{relations.networkSize}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Connections</div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>{(relations.centrality * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Centrality</div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>{relations.sharedSafes.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Shared Safes</div>
                  </div>
                </div>

                {relations.handshakes.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>A2A Handshakes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {relations.handshakes.slice(0, 5).map((h, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                          <span className="mono" style={{ color: 'var(--text)' }}>{h.peer}</span>
                          <span style={{ color: 'var(--muted)' }}>{h.status}</span>
                        </div>
                      ))}
                      {relations.handshakes.length > 5 && (
                        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          +{relations.handshakes.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exposure */}
            {(exposure || footprint) && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Exposure Assessment</h2>
                
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Overall Risk Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: exposure ? (exposure.riskLevel === 'low' ? 'var(--green)' : exposure.riskLevel === 'medium' ? 'var(--amber)' : 'var(--red)') : 'var(--muted)' }}>
                      {exposure ? `${exposure.score}/100` : '––/100'}
                    </div>
                  </div>
                  <span className={`pill ${exposure ? (exposure.riskLevel === 'low' ? 'pill-green' : exposure.riskLevel === 'medium' ? 'pill-amber' : 'pill-red') : 'pill-grey'}`}>
                    {exposure ? exposure.riskLevel.toUpperCase() : '–––'}
                  </span>
                </div>

                {exposure && exposure.exposures.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>Identified Exposures</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {exposure.exposures.map((exp, i) => (
                        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: exp.severity === 'high' || exp.severity === 'critical' ? 'var(--red-light)' : exp.severity === 'medium' ? 'var(--amber-bg)' : 'var(--green-bg)', padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{exp.type}</span>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)' }}>{exp.severity}</span>
                          </div>
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--muted)' }}>{exp.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* x402 Payment Capabilities */}
            {(x402 || footprint) && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>x402 Payment Capabilities</h2>
                <p style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  HTTP 402 Payment Required protocol support analysis
                </p>
                
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>x402 Readiness Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: x402 ? (x402.footprint.readiness === 'ready' ? 'var(--green)' : x402.footprint.readiness === 'partial' ? 'var(--amber)' : 'var(--red)') : 'var(--muted)' }}>
                      {x402 ? `${x402.footprint.score}/100` : '––/100'}
                    </div>
                  </div>
                  <span className={`pill ${x402 ? (x402.footprint.readiness === 'ready' ? 'pill-green' : x402.footprint.readiness === 'partial' ? 'pill-amber' : 'pill-red') : 'pill-grey'}`}>
                    {x402 ? x402.footprint.readiness.toUpperCase().replace('_', ' ') : 'NOT READY'}
                  </span>
                </div>

                {x402 && (
                <div>
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>x402 Support</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: x402.x402.enabled ? 'var(--green)' : 'var(--red)' }}>
                      {x402.x402.enabled ? 'Enabled' : 'Not Detected'}
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Micropayment Ready</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: x402.x402.micropaymentReady ? 'var(--green)' : 'var(--amber)' }}>
                      {x402.x402.micropaymentReady ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Solvency</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: x402.solvency.solvent ? 'var(--green)' : 'var(--red)' }}>
                      {x402.solvency.balance?.toFixed(2) || '0'} {x402.solvency.currency}
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Supported Chains</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                      {x402.x402.supportedChains.join(', ') || 'None detected'}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>Agent Payment Endpoints</h3>
                  {x402 && x402.x402.paymentEndpoints.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {x402.x402.paymentEndpoints.slice(0, 5).map((ep, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: ep.supportsX402 ? 'var(--green-bg)' : 'var(--bg-alt)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                          <span className="mono" style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{ep.url}</span>
                          <span style={{ color: ep.supportsX402 ? 'var(--green)' : 'var(--muted)' }}>
                            {ep.supportsX402 ? '✓ x402' : '— no x402'}
                          </span>
                        </div>
                      ))}
                      {x402.x402.paymentEndpoints.length > 5 && (
                        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          +{x402.x402.paymentEndpoints.length - 5} more endpoints
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                      No public MCP endpoints registered — agent payment endpoints unknown.
                    </div>
                  )}
                </div>
                </div>)}
              </div>
            )}

            {/* Glassbox Transparency */}
            {glassbox && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔍 Glassbox Transparency
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: glassbox.glassbox_data ? 'var(--green-bg)' : 'var(--amber-bg)', color: glassbox.glassbox_data ? 'var(--green)' : 'var(--amber)', borderRadius: 'var(--radius)', fontWeight: 500 }}>
                    {glassbox.glassbox_data ? glassbox.glassbox_data.source : 'Basic OSINT'}
                  </span>
                </h2>

                {glassbox.glassbox_data ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Transparency Score */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: glassbox.glassbox_data.transparency_score >= 9 ? 'var(--green)' : glassbox.glassbox_data.transparency_score >= 7 ? 'var(--amber)' : 'var(--red)' }}>
                          {glassbox.glassbox_data.transparency_score.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transparency Score</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--blue)' }}>
                          {glassbox.confidence_score.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</div>
                      </div>
                    </div>

                    {/* Transaction Analysis */}
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Transaction Analysis</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.transaction_analysis.total_transactions.toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Total Transactions</div>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.transaction_analysis.total_value} xDAI</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Total Value</div>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.transaction_analysis.unique_counterparties}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Counterparties</div>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.transaction_analysis.frequency_per_day.toFixed(1)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Daily Frequency</div>
                        </div>
                      </div>
                    </div>

                    {/* Network Intelligence */}
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Network Intelligence</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.network_intelligence.centrality_score.toFixed(0)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Centrality Score</div>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.network_intelligence.connection_count}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Connections</div>
                        </div>
                      </div>
                      {glassbox.glassbox_data.network_intelligence.interaction_types.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Interaction Types:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {glassbox.glassbox_data.network_intelligence.interaction_types.map((type, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {glassbox.glassbox_data.network_intelligence.risk_factors.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--red)', marginBottom: '0.5rem' }}>Risk Factors:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {glassbox.glassbox_data.network_intelligence.risk_factors.map((risk, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 'var(--radius)' }}>
                                {risk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Behavioral Patterns */}
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Behavioral Patterns</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{glassbox.glassbox_data.behavioral_patterns.activity_frequency.toFixed(1)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Activity Frequency</div>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{(glassbox.glassbox_data.behavioral_patterns.predictive_confidence * 100).toFixed(0)}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Predictive Confidence</div>
                        </div>
                      </div>
                      {glassbox.glassbox_data.behavioral_patterns.detected_patterns.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Detected Patterns:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {glassbox.glassbox_data.behavioral_patterns.detected_patterns.map((pattern, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)' }}>
                                {pattern.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                    <p>This agent does not have glassbox transparency enabled. Basic OSINT data available with {glassbox.confidence_score.toFixed(2)} confidence.</p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Glassbox transparency provides detailed transaction analysis, network intelligence, and behavioral patterns from transparent Molts.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Empty state */}
      {!loading && !footprint && !relations && !exposure && !x402 && !glassbox && !error && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          Enter an agent identifier to start OSINT analysis. The oracle will retrieve on-chain identity, off-chain metadata, network relations, exposure assessment, and glassbox transparency data.
        </div>
      )}

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>OSINT analysis powered by ERC-8004 registry data and glassbox transparency</div>
      </footer>
    </div>
  );
}
