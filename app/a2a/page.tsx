'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface FieldResult {
  field:    string;
  required: boolean;
  present:  boolean;
  value?:   string;
  note?:    string;
}

interface ValidationResult {
  url:        string;
  resolvedUrl: string;
  passed:     boolean;
  score:      number;
  fields:     FieldResult[];
  raw:        Record<string, unknown>;
  checkedAt:  number;
  error?:     string;
}

type Status = 'idle' | 'checking' | 'done' | 'error';

function A2AValidatorInner() {
  const searchParams = useSearchParams();
  const [url, setUrl]         = useState(() => {
    const agent = searchParams.get('agent');
    return agent ? 'https://ghostagent.ninja' : '';
  });
  const [status, setStatus]   = useState<Status>('idle');
  const [result, setResult]   = useState<ValidationResult | null>(null);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    const agent = searchParams.get('agent');
    if (agent) {
      const a2aUrl = 'https://ghostagent.ninja';
      setUrl(a2aUrl);
      setStatus('checking');
      setResult(null);
      setErrMsg('');
      fetch(`/api/a2a/validate?url=${encodeURIComponent(a2aUrl)}`)
        .then(r => r.json() as Promise<ValidationResult & { error?: string }>)
        .then(data => {
          if (data.error) { setErrMsg(data.error); setStatus('error'); }
          else { setResult(data); setStatus('done'); }
        })
        .catch(err => { setErrMsg(String(err)); setStatus('error'); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check() {
    const val = url.trim();
    if (!val) return;
    setStatus('checking');
    setResult(null);
    setErrMsg('');

    try {
      const res  = await fetch(`/api/a2a/validate?url=${encodeURIComponent(val)}`);
      const data = await res.json() as ValidationResult & { error?: string };
      if (!res.ok || data.error) {
        setErrMsg(data.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      setResult(data);
      setStatus('done');
    } catch (err) {
      setErrMsg(String(err));
      setStatus('error');
    }
  }

  return (
    <div className="page-wrap">

      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>A2A Validator</h1>
        <p>
          Validates any agent&#39;s{' '}
          <code style={{ background: 'var(--bg-alt)', padding: '0.1rem 0.375rem', borderRadius: 4, fontSize: '0.8rem', border: '1px solid var(--border)' }}>/.well-known/agent-card.json</code>{' '}
          against the <a href="https://github.com/google-a2a/A2A/blob/main/docs/specification.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Google A2A spec ↗</a>.
          Works for any agent framework.
        </p>
      </div>

      {/* Input */}
      <div className="search-row">
        <input
          className="search-input"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="https://your-agent.example.com"
          autoComplete="off" autoCorrect="off" spellCheck={false}
        />
        <button className="btn-primary" onClick={check} disabled={!url.trim() || status === 'checking'}>
          {status === 'checking'
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          }
          Validate
        </button>
      </div>

      {/* Quick examples */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', borderRadius: 99 }}
          onClick={() => { setUrl('https://ghostagent.ninja'); setStatus('idle'); }}>
          ghostagent.ninja
        </button>
      </div>

      {/* Error */}
      {status === 'error' && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{errMsg}</div>}

      {/* Results */}
      {status === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Score banner */}
          <div className="card" style={{
            padding: '1.125rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            borderLeft: `4px solid ${result.passed ? 'var(--green)' : 'var(--red)'}`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={result.passed ? 'var(--green)' : 'var(--red)'}
              strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              {result.passed
                ? <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>
                : <><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></>
              }
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: result.passed ? 'var(--green)' : 'var(--red)' }}>
                {result.passed ? 'A2A Compliant ✓' : 'Validation Failed'}
              </div>
              <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                {result.resolvedUrl}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '0.625rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1,
                color: result.score >= 80 ? 'var(--green)' : result.score >= 50 ? 'var(--amber)' : 'var(--red)' }}>
                {result.score}%
              </div>
            </div>
          </div>

          {/* Field checks */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              Schema Fields
              <span style={{ fontWeight: 400 }}>{result.fields.filter(f => f.present).length}/{result.fields.length} present</span>
            </div>
            {result.fields.map((f, i) => (
              <div key={i} className="data-row" style={{ gap: '0.75rem', borderBottom: i < result.fields.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                <span className={`pill ${f.present ? 'pill-green' : f.required ? 'pill-red' : 'pill-grey'}`}
                  style={{ flexShrink: 0, marginTop: '0.1rem', width: '1.25rem', height: '1.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0 }}>
                  {f.present ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: '0.8rem', color: f.present ? 'var(--text)' : 'var(--muted)' }}>{f.field}</span>
                    {f.required && <span className="pill pill-amber" style={{ fontSize: '0.55rem' }}>REQUIRED</span>}
                  </div>
                  {f.value && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>}
                  {f.note  && <div style={{ fontSize: '0.7rem', color: 'var(--amber)', marginTop: '0.15rem' }}>{f.note}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* GhostAgent CTA — only show if failed */}
          {!result.passed && (
            <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--red)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>Missing A2A compliance?</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  GhostAgent.ninja ships a fully compliant <code style={{ fontSize: '0.7rem' }}>/.well-known/agent.json</code> with ERC-8004 identity baked in.
                </div>
              </div>
              <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ flexShrink: 0, textDecoration: 'none', fontSize: '0.75rem', padding: '0.5rem 0.875rem' }}>
                View →
              </a>
            </div>
          )}

          {/* Raw JSON toggle */}
          <details className="card" style={{ overflow: 'hidden' }}>
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
        <div>Validates any agent · Not affiliated with any single provider</div>
      </footer>

    </div>
  );
}

export default function A2AValidatorPage() {
  return (
    <Suspense fallback={<div className="page-wrap" style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--muted)' }}>Loading…</div>}>
      <A2AValidatorInner />
    </Suspense>
  );
}
