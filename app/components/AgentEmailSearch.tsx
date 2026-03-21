'use client';

import { useState, useEffect } from 'react';
import type { AgentResolution } from '@/app/lib/agent-email-resolution';

type SearchStatus = 'idle' | 'searching' | 'found' | 'not_found' | 'invalid' | 'error';

export default function AgentEmailSearch({ initialEmail = '' }: { initialEmail?: string }) {
  const [input,  setInput]  = useState(initialEmail);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [result, setResult] = useState<AgentResolution | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) search();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    const email = input.trim().toLowerCase();
    if (!email) return;

    setStatus('searching');
    setResult(null);
    setError(null);

    try {
      const res  = await fetch(`/api/agent-lookup?email=${encodeURIComponent(email)}`);
      const data = await res.json() as AgentResolution & { error?: string };

      if (data.status === 'invalid_format') {
        setError(data.error ?? 'Invalid email format');
        setStatus('invalid');
        return;
      }
      if (data.status === 'not_found') {
        setError(data.error ?? 'Agent not found');
        setStatus('not_found');
        return;
      }
      if (!res.ok || data.status === 'error') {
        setError(data.error ?? `Error ${res.status}`);
        setStatus('error');
        return;
      }

      setResult(data);
      setStatus('found');
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  const scoreColor = (level: AgentResolution['alignmentLevel']) => {
    if (level === 'green') return 'var(--green)';
    if (level === 'amber') return 'var(--amber)';
    if (level === 'red')   return 'var(--red)';
    return 'var(--muted)';
  };

  const scoreBg = (level: AgentResolution['alignmentLevel']) => {
    if (level === 'green') return 'var(--green-bg)';
    if (level === 'amber') return 'var(--amber-bg)';
    if (level === 'red')   return 'var(--red-light)';
    return 'rgba(255,255,255,0.04)';
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
    <div className="card" style={{ maxWidth: 640, width: '100%' }}>

      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
        Agent Email Lookup
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
        Verify an AI agent by its NFTmail address. Only agent emails{' '}
        (<code style={{ color: 'var(--accent)' }}>[name]_@nftmail.box</code>) can be verified —
        the underscore suffix distinguishes agents from human users.
      </p>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setStatus('idle'); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="ghostagent_@nftmail.box"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.55rem 0.85rem',
            color: 'var(--fg)',
            fontSize: '0.9rem',
            outline: 'none',
            fontFamily: 'monospace',
          }}
        />
        <button
          onClick={search}
          disabled={status === 'searching' || !input.trim()}
          style={{
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: 8,
            padding: '0.55rem 1.1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: status === 'searching' ? 'wait' : 'pointer',
            opacity: !input.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'searching' ? 'Resolving…' : 'Verify'}
        </button>
      </div>

      {/* Hint */}
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem' }}>
        ↳ Resolution: email → Safe address → ERC-8004 agentId → alignment score
      </p>

      {/* Invalid format */}
      {status === 'invalid' && error && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', marginBottom: '0.75rem' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 600 }}>✕ {error}</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
            Example valid format: <code style={{ color: 'var(--accent)' }}>ghostagent_@nftmail.box</code>
          </p>
        </div>
      )}

      {/* Not found */}
      {status === 'not_found' && error && (
        <div className="card" style={{ borderColor: 'var(--amber)', background: 'var(--amber-bg)', marginBottom: '0.75rem' }}>
          <p style={{ color: 'var(--amber)', fontSize: '0.85rem', fontWeight: 600 }}>⚠ {error}</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
            Agent may not be registered yet. Mint at{' '}
            <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer"
               style={{ color: 'var(--accent)' }}>ghostagent.ninja</a>
          </p>
        </div>
      )}

      {/* Generic error */}
      {status === 'error' && error && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', marginBottom: '0.75rem' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>Error: {error}</p>
        </div>
      )}

      {/* Result */}
      {status === 'found' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Header row */}
          <div className="card" style={{ borderColor: 'var(--green)', background: 'var(--green-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>✓ Verified Agent</span>
              {result.badges?.map(b => (
                <span key={b} className="pill pill-green" style={{ fontSize: '0.72rem' }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Data grid */}
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <tbody>
                <DataRow label="Email">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <code style={{ color: 'var(--accent)' }}>{result.email}</code>
                    <a
                      href={`https://nftmail.box/inbox/${result.label}_`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.55rem',
                        borderRadius: 6,
                        background: 'var(--bg-alt)',
                        border: '1px solid var(--border)',
                        color: 'var(--red)',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {result.alignmentLevel === 'green' ? '🔒 Private Inbox' : '🔍 Glassbox Inbox'} ↗
                    </a>
                  </div>
                </DataRow>
                <DataRow label="Safe Address">
                  <code style={{ color: 'var(--fg)', wordBreak: 'break-all' }}>{result.safeAddress}</code>
                  {' '}
                  <a
                    href={`https://gnosisscan.io/address/${result.safeAddress}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--muted)', fontSize: '0.75rem' }}
                  >↗</a>
                </DataRow>
                {result.agentId !== undefined ? (
                  <DataRow label="ERC-8004 (Gnosis)">
                    <a href={`https://gnosisscan.io/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${result.agentId}`}
                       target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      #{result.agentId}
                    </a>
                    {' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>(Gnosis)</span>
                  </DataRow>
                ) : (
                  <DataRow label="ERC-8004 (Gnosis)">
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Not registered</span>
                  </DataRow>
                )}
                {(result as any).erc8004Base?.agentId ? (
                  <DataRow label="ERC-8004 (Base)">
                    <a href={`https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${(result as any).erc8004Base.agentId}`}
                       target="_blank" rel="noopener noreferrer" style={{ color: '#0052ff', fontWeight: 600 }}>
                      #{(result as any).erc8004Base.agentId}
                    </a>
                    {' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>(Base · Synthesis)</span>
                  </DataRow>
                ) : null}
                {(result as any).erc8004BaseSepolia?.agentId ? (
                  <DataRow label="ERC-8004 (Base Sepolia)">
                    <a href={`https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${(result as any).erc8004BaseSepolia.agentId}`}
                       target="_blank" rel="noopener noreferrer" style={{ color: '#6b8cff', fontWeight: 600 }}>
                      #{(result as any).erc8004BaseSepolia.agentId}
                    </a>
                    {' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>(Base Sepolia · Hackathon)</span>
                  </DataRow>
                ) : null}
                <DataRow label="Alignment Score">
                  {result.alignmentScore !== null && result.alignmentScore !== undefined ? (
                    <span style={{
                      display: 'inline-block',
                      background: scoreBg(result.alignmentLevel),
                      color: scoreColor(result.alignmentLevel),
                      borderRadius: 6,
                      padding: '0.15rem 0.6rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}>
                      {result.alignmentScore}/100
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>No score recorded yet</span>
                  )}
                </DataRow>
                <DataRow label="Resolved At">
                  <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                    {new Date(result.resolvedAt).toLocaleString()}
                  </span>
                </DataRow>
              </tbody>
            </table>
          </div>

          {/* Disclaimer */}
          <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            ⚠ Agent email verified. Human emails cannot be verified by this tool —
            only <code>[name]_@nftmail.box</code> agent accounts are resolvable.
          </p>
        </div>
      )}
    </div>
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '0.45rem 0.75rem 0.45rem 0', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', width: '38%' }}>
        {label}
      </td>
      <td style={{ padding: '0.45rem 0' }}>
        {children}
      </td>
    </tr>
  );
}
