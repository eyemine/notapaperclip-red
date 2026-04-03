'use client';

import { useState } from 'react';

const CHAINS = [
  { key: 'gnosis',      label: 'Gnosis',       chainId: 100,   explorer: 'https://gnosisscan.io/tx/' },
  { key: 'base',        label: 'Base',         chainId: 8453,  explorer: 'https://basescan.org/tx/' },
  { key: 'baseSepolia', label: 'Base Sepolia', chainId: 84532, explorer: 'https://sepolia.basescan.org/tx/' },
];

type LookupMode = 'agent' | 'token' | 'email';

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
    totalXdaiBurned: number;
    surgeScore: number;
    mcpServers: string[];
    genomeUrl: string | null;
    hasX402Capability: boolean;
  };
  exposure: {
    hasPublicEndpoints: boolean;
    hasMCPServers: boolean;
    hasGenomeMetadata: boolean;
    hasX402Capability: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
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

export default function OSINTDashboard() {
  const [mode, setMode] = useState<LookupMode>('agent');
  const [chain, setChain] = useState('gnosis');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [footprint, setFootprint] = useState<FootprintData | null>(null);
  const [relations, setRelations] = useState<RelationsData | null>(null);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [x402, setX402] = useState<X402Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!agentName.trim()) return;
    
    setLoading(true);
    setError(null);
    setFootprint(null);
    setRelations(null);
    setExposure(null);
    setX402(null);

    try {
      // Build query based on mode
      let query = agentName.trim();
      if (mode === 'token' && !query.startsWith('#')) {
        query = `#${query}`;
      }
      
      const encodedQuery = encodeURIComponent(query);
      const chainParam = mode === 'token' ? `&chain=${chain}` : '';
      const [footprintRes, relationsRes, exposureRes, x402Res] = await Promise.all([
        fetch(`/api/osint/footprint?agent=${encodedQuery}${chainParam}`),
        fetch(`/api/osint/relations?agent=${encodedQuery}${chainParam}`),
        fetch(`/api/osint/exposure?agent=${encodedQuery}${chainParam}`),
        fetch(`/api/x402/probe?agent=${encodedQuery}${chainParam}`),
      ]);

      if (!footprintRes.ok) {
        const err = await footprintRes.json();
        throw new Error(err.error || 'Failed to fetch footprint');
      }

      const footprintData = await footprintRes.json();
      const relationsData = relationsRes.ok ? await relationsRes.json() : null;
      const exposureData = exposureRes.ok ? await exposureRes.json() : null;
      const x402Data = x402Res.ok ? await x402Res.json() : null;

      setFootprint(footprintData);
      setRelations(relationsData);
      setExposure(exposureData);
      setX402(x402Data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrap">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>OSINT Intelligence</h1>
        <p>
          Agent footprint analysis, network mapping, and exposure assessment.
          Search by agent name, ERC-8004 token ID, or NFTmail address.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {(
          [
            { key: 'agent', label: 'By Agent Name' },
            { key: 'token', label: 'By ERC-8004 Token ID' },
            { key: 'email', label: 'By NFTmail Address' },
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
          type="text"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder={
            mode === 'email'  ? 'e.g. ghostagent_@nftmail.box'
            : mode === 'agent' ? 'Agent name, e.g. ghostagent'
            : `ERC-8004 token ID on ${CHAINS.find(c => c.key === chain)?.label || 'Gnosis'}, e.g. 3199`
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
        </div>

      {/* Error */}
      {error && (
        <div className="alert alert-warn" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

        {/* Results */}
        {(footprint || relations || exposure || x402) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Footprint */}
            {footprint && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Digital Footprint</h2>
                
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
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>TLD</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.tld}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Tier</span>
                        <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{footprint.offChain.tier}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>xDAI Burned</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.totalXdaiBurned.toFixed(1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Surge Score</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.surgeScore}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>MCP Servers</span>
                        <span style={{ color: 'var(--text)' }}>{footprint.offChain.mcpServers.length}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>x402 Ready</span>
                        <span style={{ color: footprint.offChain.hasX402Capability ? 'var(--green)' : 'var(--amber)' }}>
                          {footprint.offChain.hasX402Capability ? '✓ Yes' : '— No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

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
            {exposure && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Exposure Assessment</h2>
                
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Overall Risk Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: exposure.riskLevel === 'low' ? 'var(--green)' : exposure.riskLevel === 'medium' ? 'var(--amber)' : 'var(--red)' }}>
                      {exposure.score}/100
                    </div>
                  </div>
                  <span className={`pill ${exposure.riskLevel === 'low' ? 'pill-green' : exposure.riskLevel === 'medium' ? 'pill-amber' : 'pill-red'}`}>
                    {exposure.riskLevel.toUpperCase()}
                  </span>
                </div>

                {exposure.exposures.length > 0 && (
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
            {x402 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>x402 Payment Capabilities</h2>
                <p style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  HTTP 402 Payment Required protocol support analysis
                </p>
                
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>x402 Readiness Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: x402.footprint.readiness === 'ready' ? 'var(--green)' : x402.footprint.readiness === 'partial' ? 'var(--amber)' : 'var(--red)' }}>
                      {x402.footprint.score}/100
                    </div>
                  </div>
                  <span className={`pill ${x402.footprint.readiness === 'ready' ? 'pill-green' : x402.footprint.readiness === 'partial' ? 'pill-amber' : 'pill-red'}`}>
                    {x402.footprint.readiness.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

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

                {x402.x402.paymentEndpoints.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>Payment Endpoints</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {x402.x402.paymentEndpoints.slice(0, 5).map((ep, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: ep.supportsX402 ? 'var(--green-bg)' : 'var(--bg-alt)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                          <span className="mono" style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{ep.url}</span>
                          <span style={{ color: ep.supportsX402 ? 'var(--green)' : 'var(--muted)' }}>
                            {ep.supportsX402 ? '✓ x402' : '—'}
                          </span>
                        </div>
                      ))}
                      {x402.x402.paymentEndpoints.length > 5 && (
                        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          +{x402.x402.paymentEndpoints.length - 5} more endpoints
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* Empty state */}
      {!loading && !footprint && !relations && !exposure && !x402 && !error && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          Enter an agent identifier to start OSINT analysis. The oracle will retrieve on-chain identity, off-chain metadata, network relations, and exposure assessment.
        </div>
      )}

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>OSINT analysis powered by ERC-8004 registry data</div>
      </footer>
    </div>
  );
}
