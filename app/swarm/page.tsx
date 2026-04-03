'use client';

// Silence Next.js dev server localStorage error
if (typeof window === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AlignmentScore from '../components/AlignmentScore';
import GoalDriftTimeline from '../components/GoalDriftTimeline';
import type { AlignmentResult } from '../services/alignment-calculator';
import type { DriftResult } from '../services/goal-drift-detector';

import type { Member, Attestation, VerifyResult } from '../types';

type SearchStatus = 'idle' | 'searching' | 'found' | 'notfound' | 'error';

function ts(ms: number) {
  return new Date(ms).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function repClass(score: number) {
  if (score >= 700) return 'pill pill-green';
  if (score >= 400) return 'pill pill-amber';
  return 'pill pill-red';
}

export default function HomePage() {
  const [query, setQuery]         = useState('');
  const [status, setStatus]       = useState<SearchStatus>('idle');
  const [result, setResult]       = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [copied, setCopied]       = useState(false);
  const [alignment, setAlignment]   = useState<AlignmentResult | null>(null);
  const [drift, setDrift]           = useState<DriftResult | null>(null);
  const [companyRepo, setCompanyRepo] = useState<string | null>(null);

  async function search() {
    const id = query.trim().toLowerCase();
    if (!id) return;
    setStatus('searching');
    setResult(null);
    setErrorMsg('');

    try {
      const res  = await fetch(`/api/verify/swarm?swarmId=${encodeURIComponent(id)}`);
      const data = await res.json() as VerifyResult & { error?: string };
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      if (data.memberCount === 0 && data.attestations.length === 0) {
        setStatus('notfound');
        return;
      }
      setResult(data);
      setStatus('found');
      setCompanyRepo(null);
      // Fetch Agent Companies manifest (non-blocking)
      const repoToCheck = (data as any).config?.companyRepo ?? (id === 'ghostagent' ? 'eyemine/ghostagent-ninja' : null);
      if (repoToCheck) {
        fetch(`/api/company?repo=${encodeURIComponent(repoToCheck)}`)
          .then(r => r.ok ? r.json() : null)
          .then((c: { schema?: string; slug?: string } | null) => {
            if (c?.schema?.startsWith('agentcompanies/')) setCompanyRepo(repoToCheck);
          })
          .catch(() => {});
      }
      // Fetch alignment score + goal drift in parallel (non-blocking)
      const enc = encodeURIComponent(id);
      Promise.all([
        fetch(`/api/alignment/score?swarmId=${enc}`).then(r => r.json()),
        fetch(`/api/alignment/drift?swarmId=${enc}`).then(r => r.json()),
      ]).then(([scoreData, driftData]) => {
        setAlignment(scoreData as AlignmentResult);
        setDrift(driftData as DriftResult);
      }).catch(() => { /* non-fatal */ });
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  }

  function copyPermalink() {
    if (!result) return;
    const url = `${window.location.origin}/?swarm=${encodeURIComponent(result.swarmId)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const badgeIsGreen = result?.fullyVerified;
  const badgeIsRed   = !result?.verified;

  return (
    <div className="page-wrap">
      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem 0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        <Link href="/" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
          ERC-8004 Feed
        </Link>
        <span className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', background: 'var(--red-light)', borderColor: 'var(--red-mid)', color: 'var(--red)', cursor: 'default' }}>
          Swarm Verifier
        </span>
        <Link href="/a2a" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
          A2A Validator
        </Link>
        <Link href="/mcp" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
          MCP Inspector
        </Link>
        <Link href="/osint" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
          🔍 OSINT
        </Link>
      </nav>

      {/* Hero */}
      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>
          Swarm Verifier
        </h1>
        <p>
          An independent alignment watchdog for AI agent swarms. Are your agents doing their jobs — or are they becoming{' '}
          <a href="https://cepr.org/voxeu/columns/ai-and-paperclip-problem" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>paperclip maximisers</a>?
          Verify task compliance, A2A identity, and on-chain reputation for any agent running in a{' '}
          <a href="https://paperclip.ing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Paperclip.ing</a>{' '}company or independent swarm.
        </p>
      </div>

      {/* Search */}
      <div className="search-row">
        <input
          className="search-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setStatus('idle'); }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Enter swarm ID, e.g. ghostagent"
          autoComplete="off" autoCorrect="off" spellCheck={false}
        />
        <button className="btn-primary" onClick={search} disabled={!query.trim() || status === 'searching'}>
          {status === 'searching'
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
          Verify
        </button>
      </div>

      {/* Error */}
      {status === 'error' && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{errorMsg}</div>}

      {/* Not found */}
      {status === 'notfound' && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
          No swarm found for <span className="mono" style={{ color: 'var(--text)' }}>&ldquo;{query}&rdquo;</span>
          <div style={{ marginTop: '1rem' }}>
            <a
              href={`/swarm/${encodeURIComponent(query)}`}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.8rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2v10l7 7"/>
              </svg>
              View Network Map Anyway
            </a>
          </div>
        </div>
      )}

      {/* Results */}
      {status === 'found' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Badge banner */}
          <div className="card" style={{
            padding: '1.125rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            borderLeft: `4px solid ${badgeIsGreen ? 'var(--green)' : badgeIsRed ? 'var(--red)' : 'var(--amber)'}`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={badgeIsGreen ? 'var(--green)' : badgeIsRed ? 'var(--red)' : 'var(--amber)'}
              strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              {result.verified && <path d="m9 12 2 2 4-4"/>}
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: badgeIsGreen ? 'var(--green)' : badgeIsRed ? 'var(--red)' : 'var(--amber)' }}>
                {result.badge}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                swarm: <span className="mono">{result.swarmId}</span>
                {' · '}checked {ts(result.checkedAt)}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '0.625rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>members</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{result.memberCount}</div>
            </div>
          </div>

          {/* Permalink */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 0.875rem' }}>
            <span className="mono" style={{ flex: 1, fontSize: '0.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {origin}/?swarm={encodeURIComponent(result.swarmId)}
            </span>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', flexShrink: 0 }} onClick={copyPermalink}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>

          {/* View Swarm Map */}
          <div style={{ textAlign: 'center' }}>
            <a
              href={`/swarm/${encodeURIComponent(result.swarmId)}`}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2v10l7 7"/>
              </svg>
              View Swarm Network Map
            </a>
          </div>

          {/* Alignment Score */}
          {alignment && <AlignmentScore result={alignment} />}

          {/* Goal Drift */}
          {drift && drift.snapshots.length > 0 && <GoalDriftTimeline result={drift} />}

          {/* Criteria */}
          <Card header="Verification Criteria">
            {[
              { label: `≥ 2 active members — ${result.memberCount} present`, met: result.criteria.hasMinMembers },
              { label: `≥ 1 on-task attestation — ${result.attestations.length} submitted, ${result.verifiedProofs} verified`, met: result.criteria.hasVerifiedProof },
              { label: 'All members have on-chain ERC-8004 identity', met: result.criteria.allMembersHaveRep },
            ].map((row, i) => (
              <div key={i} className="data-row" style={{ alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.125rem' }}>
                <span className={`pill ${row.met ? 'pill-green' : 'pill-grey'}`} style={{ width: '1.25rem', height: '1.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0 }}>
                  {row.met ? '✓' : '–'}
                </span>
                <span style={{ fontSize: '0.8rem', color: row.met ? 'var(--text)' : 'var(--muted)' }}>{row.label}</span>
              </div>
            ))}
            <div className="data-row" style={{ alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.125rem', borderTop: '1px solid var(--border)' }}>
              <span className="pill pill-green" style={{ width: '1.25rem', height: '1.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text)', flex: 1 }}>
                ERC-8004 registry independently indexed by{' '}
                <a href="https://gnosisscan.io/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Gnosisscan ↗</a>
                {' '}— on-chain data verifiable by any third party
              </span>
            </div>
            <div className="data-row" style={{ alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.125rem', borderTop: '1px solid var(--border)' }}>
              <span className={`pill ${companyRepo ? 'pill-green' : 'pill-grey'}`} style={{ width: '1.25rem', height: '1.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0, flexShrink: 0 }}>{companyRepo ? '✓' : '–'}</span>
              <span style={{ fontSize: '0.8rem', color: companyRepo ? 'var(--text)' : 'var(--muted)', flex: 1 }}>
                {companyRepo ? (
                  <>
                    Agent Companies package present —{' '}
                    <a href={`https://github.com/${companyRepo}/blob/main/COMPANY.md`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>COMPANY.md ↗</a>
                    {' '}(<a href="https://companies.sh" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>companies.sh</a>)
                  </>
                ) : 'No Agent Companies package found (schema: agentcompanies/v1)'}
              </span>
            </div>
          </Card>

          {/* Members */}
          {result.members.length > 0 && (
            <Card header="Swarm Members">
              {result.members.map((m, i) => {
                const key = (m.agentName || m.address || '').toLowerCase();
                const repHistory = result.reputation[key];
                const latest = repHistory?.[repHistory.length - 1];
                const score = latest ? Math.round((latest.taskScore ?? latest.paperclipScore ?? 0) * 0.847) : null;
                return (
                  <div key={i} className="data-row" style={{ alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--red-light)', border: '1px solid var(--red-mid)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>
                      {(m.agentName || m.address || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.agentName || m.address}</span>
                        {m.agentName && (
                          <a href={`/?agent=${encodeURIComponent(m.agentName)}`}
                            style={{ fontSize: '0.62rem', color: 'var(--green)', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                            ERC-8004 ↗
                          </a>
                        )}
                      </div>
                      {m.address && m.agentName && (
                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.address}</div>
                      )}
                    </div>
                    {score !== null && (
                      <span className={repClass(score)} style={{ flexShrink: 0 }}>{score}/1000</span>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {/* Attestations */}
          {result.attestations.length > 0 ? (
            <Card header="Agent Task Attestations" sub={`${result.attestations.length} total · ${result.verifiedProofs} verified`}>
              {[...result.attestations].reverse().slice(0, 5).map((a, i, arr) => (
                <div key={i} className="data-row" style={{ gap: '0.75rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span className={`pill ${a.verified ? 'pill-green' : 'pill-amber'}`} style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                    {a.verified ? 'Verified' : 'Pending'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{a.agentName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                      <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                        {a.proofHash ? a.proofHash.slice(0, 22) + '…' : '—'}
                      </span>
                      {a.proofHash && (
                        <a href={a.notaUrl ?? `/verify/${a.proofHash}`}
                          style={{ fontSize: '0.65rem', color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>
                          view proof ↗
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{ts(a.timestamp)}</div>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
              No task attestations submitted yet for this swarm.
            </div>
          )}

        </div>
      )}

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>Alignment watchdog for <a href="https://paperclip.ing" target="_blank" rel="noopener noreferrer">Paperclip.ing</a> companies · ERC-8004 on Gnosis Chain · <a href="https://cepr.org/voxeu/columns/ai-and-paperclip-problem" target="_blank" rel="noopener noreferrer">Why “not a paperclip”?</a></div>
      </footer>

    </div>
  );
}

function Card({ header, sub, children }: { header: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        {header}
        {sub && <span style={{ fontWeight: 400, letterSpacing: 0, fontSize: '0.625rem' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}
