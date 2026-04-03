'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  };
  exposure: {
    hasPublicEndpoints: boolean;
    hasMCPServers: boolean;
    hasGenomeMetadata: boolean;
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

export default function OSINTDashboard() {
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [footprint, setFootprint] = useState<FootprintData | null>(null);
  const [relations, setRelations] = useState<RelationsData | null>(null);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!agentName.trim()) return;
    
    setLoading(true);
    setError(null);
    setFootprint(null);
    setRelations(null);
    setExposure(null);

    try {
      // Fetch all three modules in parallel - pass the raw query to let API resolve it
      const encodedQuery = encodeURIComponent(agentName.trim());
      const [footprintRes, relationsRes, exposureRes] = await Promise.all([
        fetch(`/api/osint/footprint?agent=${encodedQuery}`),
        fetch(`/api/osint/relations?agent=${encodedQuery}`),
        fetch(`/api/osint/exposure?agent=${encodedQuery}`),
      ]);

      if (!footprintRes.ok) {
        const err = await footprintRes.json();
        throw new Error(err.error || 'Failed to fetch footprint');
      }

      const footprintData = await footprintRes.json();
      const relationsData = relationsRes.ok ? await relationsRes.json() : null;
      const exposureData = exposureRes.ok ? await exposureRes.json() : null;

      setFootprint(footprintData);
      setRelations(relationsData);
      setExposure(exposureData);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Header with Navigation */}
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>OSINT Intelligence</h1>
              <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
                Agent footprint analysis, network mapping, and exposure assessment
              </p>
            </div>
          </div>
          {/* Navigation */}
          <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <Link href="/" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
              ERC-8004 Feed
            </Link>
            <Link href="/swarm" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
              Swarm Verifier
            </Link>
            <Link href="/a2a" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
              A2A Validator
            </Link>
            <Link href="/mcp" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
              MCP Inspector
            </Link>
            <span className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', background: 'var(--red-light)', borderColor: 'var(--red-mid)', color: 'var(--red)', cursor: 'default' }}>
              🔍 OSINT
            </span>
          </nav>
        </header>

        {/* Search */}
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
          <label style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Search Agent
          </label>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
            Enter agent name, ERC-8004 ID (e.g., #3199), or email (e.g., ghostagent_@nftmail.box)
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="ghostagent, eyemine, victor, #3199, ghostagent_@nftmail.box..."
              className="search-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !agentName.trim()}
              className="btn-primary"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: '0.75rem', border: '1px solid var(--red-mid)', borderRadius: 'var(--radius)', background: 'var(--red-light)', padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {(footprint || relations || exposure) && (
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
                    </div>
                  </div>
                </div>

                {/* Exposure summary */}
                <div style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-alt)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Risk Level</span>
                    <span className={`pill ${footprint.exposure.riskLevel === 'low' ? 'pill-green' : footprint.exposure.riskLevel === 'medium' ? 'pill-amber' : 'pill-red'}`}>
                      {footprint.exposure.riskLevel.toUpperCase()}
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
          </div>
        )}

        {/* Empty state */}
        {!loading && !footprint && !relations && !exposure && !error && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>No Analysis Yet</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
              Enter an agent name above to start OSINT analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
