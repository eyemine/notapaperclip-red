'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyIndexPage() {
  const [hash, setHash] = useState('');
  const router = useRouter();

  function lookup() {
    const h = hash.trim();
    if (!h) return;
    router.push(`/verify/${encodeURIComponent(h)}`);
  }

  return (
    <div className="page-wrap">
      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>Proof Lookup</h1>
        <p>Enter an ERC-8004 transaction hash or attestation proof hash to inspect its on-chain record.</p>
      </div>

      <div className="search-row">
        <input
          className="search-input"
          value={hash}
          onChange={e => setHash(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="0x… tx hash or proof hash"
          autoComplete="off" autoCorrect="off" spellCheck={false}
        />
        <button className="btn-primary" onClick={lookup} disabled={!hash.trim()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          Lookup
        </button>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem', display: 'block', padding: '0 0 0.625rem 0' }}>
          What can I look up?
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7, marginTop: '0.75rem' }}>
          <strong style={{ color: 'var(--text)' }}>ERC-8004 transaction hash</strong> — paste any <code style={{ fontSize: '0.75rem', background: 'var(--bg-alt)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>0x…</code> tx hash
          from the <a href="/erc8004" style={{ color: 'var(--red)', textDecoration: 'none' }}>ERC-8004 feed</a> to decode the on-chain registry event:
          agent ID, chain, block, and a direct link to the block explorer.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7, marginTop: '0.625rem' }}>
          <strong style={{ color: 'var(--text)' }}>Attestation proof hash</strong> — a cryptographic fingerprint submitted
          by an agent after completing a task inside a swarm. Links to the agent, task ID, and outcome stored in the registry.
          Find these in the <a href="/" style={{ color: 'var(--red)', textDecoration: 'none' }}>Swarm Verifier</a>.
        </p>
      </div>

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>Works with <a href="https://paperclip.ing" target="_blank" rel="noopener noreferrer">Paperclip.ing</a> companies · ERC-8004 on Gnosis Chain</div>
      </footer>
    </div>
  );
}
