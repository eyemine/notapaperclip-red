/**
 * ERC-8048 Metadata Search
 * Separate tab for searching GhostAgentMetadataRegistry without slowing down main OSINT search.
 */

'use client';

import { useState } from 'react';
import { decodeBinding } from '@/lib/erc8048';

interface SearchResult {
  agentId: number;
  metadata: Record<string, string>;
}

export default function Erc8048SearchPage() {
  const [mode, setMode] = useState<'byAgentId' | 'byBinding' | 'byKey'>('byAgentId');
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');

  async function handleSearch() {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const body: any = { mode };

      if (mode === 'byAgentId') {
        if (!agentId.trim()) throw new Error('Agent ID is required');
        body.agentId = parseInt(agentId.trim());
      }

      const res = await fetch('/api/erc8048/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function decodeAgentBinding(raw: string) {
    const binding = decodeBinding(raw);
    if (!binding) return null;
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
        <div><strong>Binding:</strong> {binding.bindingContract.slice(0, 10)}…</div>
        <div><strong>Standard:</strong> {binding.tokenStandard}</div>
        <div><strong>Token:</strong> {binding.tokenContract.slice(0, 10)}…#{binding.tokenId}</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="page-hero" style={{ textAlign: 'center' }}>
        <h1>ERC-8048 Metadata Search</h1>
        <p>
          Search GhostAgentMetadataRegistry for agent metadata, bindings, and Normie agent references.
          Separate from OSINT search to avoid performance impact.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className={mode === 'byAgentId' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
          onClick={() => { setMode('byAgentId'); setAgentId(''); setResults([]); setError(''); }}
        >
          By Agent ID
        </button>
        <button
          className={mode === 'byBinding' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
          onClick={() => { setMode('byBinding'); setAgentId(''); setResults([]); setError(''); }}
          disabled
        >
          By Binding (requires indexer)
        </button>
        <button
          className={mode === 'byKey' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
          onClick={() => { setMode('byKey'); setAgentId(''); setResults([]); setError(''); }}
          disabled
        >
          By Key/Value (requires indexer)
        </button>
      </div>

      {/* Search input */}
      <div className="search-row">
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={mode === 'byAgentId' ? 'ERC-8004 agent ID, e.g. 3199' : 'Search query'}
          className="search-input"
          autoComplete="off" spellCheck={false}
          disabled={mode !== 'byAgentId'}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !agentId.trim() || mode !== 'byAgentId'}
          className="btn-primary"
        >
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results.map((r) => (
        <div key={r.agentId} style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Agent ID: {r.agentId}
          </div>
          {Object.entries(r.metadata).map(([key, value]) => (
            <div key={key} style={{ fontSize: '0.8rem', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{key}</div>
              <div style={{ color: 'var(--text-2)' }}>{value}</div>
              {key === 'agent-binding' && decodeAgentBinding(value)}
            </div>
          ))}
        </div>
      ))}

      {results.length === 0 && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
          Enter an agent ID to search ERC-8048 metadata
        </div>
      )}
    </div>
  );
}
