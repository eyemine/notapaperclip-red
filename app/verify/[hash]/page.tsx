'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProofRecord {
  proofHash:   string;
  taskId?:     string;
  agentName?:  string;
  notaRef?:    string;
  submitter?:  string;
  submittedAt?: number;
  verifiedAt?: number;
  verified:    boolean;
  status?:     string;
  txHash?:     string;
}

interface TxRecord {
  found:       boolean;
  chain:       string;
  chainId:     number;
  explorerUrl: string;
  registry:    string;
  txHash:      string;
  status:      'success' | 'failed';
  block:       number;
  from:        string;
  gasUsed:     number;
  events: Array<{
    eventType: string;
    agentId:   number | null;
    from:      string | null;
    to:        string | null;
    logIndex:  number;
  }>;
}

type LoadStatus = 'loading' | 'found' | 'found-tx' | 'notfound' | 'error';

function ts(ms: number) {
  return new Date(ms).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function VerifyHashPage({ params }: { params: Promise<{ hash: string }> }) {
  const [status,    setStatus]   = useState<LoadStatus>('loading');
  const [record,    setRecord]   = useState<ProofRecord | null>(null);
  const [txRecord,  setTxRecord] = useState<TxRecord | null>(null);
  const [errorMsg,  setErrorMsg] = useState('');
  const [hash,      setHash]     = useState<string>('');

  useEffect(() => {
    params.then(p => setHash(p.hash));
  }, [params]);

  useEffect(() => {
    if (!hash) return;
    async function load() {
      const isTxHash = /^0x[0-9a-f]{64}$/i.test(hash);

      // Step 1 — try KV attestation lookup
      try {
        const res  = await fetch(`/api/verify/swarm?proofHash=${encodeURIComponent(hash)}`);
        const data = await res.json() as ProofRecord & { error?: string };
        if (res.ok && !data.error) {
          setRecord(data);
          setStatus('found');
          return;
        }
      } catch {}

      // Step 2 — if it looks like a tx hash, try on-chain receipt
      if (isTxHash) {
        try {
          const res  = await fetch(`/api/erc8004/tx?hash=${encodeURIComponent(hash)}`);
          const data = await res.json() as TxRecord & { error?: string };
          if (res.ok && !data.error) {
            setTxRecord(data);
            setStatus('found-tx');
            return;
          }
        } catch {}
      }

      setStatus('notfound');
    }
    load();
  }, [hash]);

  const statusPill = record?.verified ? 'pill pill-green' : record?.status === 'failed' ? 'pill pill-red' : 'pill pill-amber';

  return (
    <div className="page-wrap">

      {/* Back */}
      <Link href="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--muted)', textDecoration: 'none', marginBottom: '2rem' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
        Proof Lookup
      </Link>

      <div className="page-hero">
        <h1>Proof Verification</h1>
        <p>Agent task attestation — on-chain record from a GhostAgent swarm member</p>
      </div>

      {/* Hash display */}
      <div className="card mono" style={{ padding: '0.875rem 1.125rem', fontSize: '0.8rem', color: 'var(--red)', wordBreak: 'break-all', marginBottom: '1.5rem', borderLeft: '3px solid var(--red)' }}>
        {hash || <span style={{ color: 'var(--muted)' }}>Loading…</span>}
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
          <div className="spinner" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.875rem' }}>Looking up proof…</div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && <div className="alert alert-error">{errorMsg}</div>}

      {/* Not found */}
      {status === 'notfound' && (() => {
        // Detect if the user pasted a raw tx hash (0x + 64 hex chars)
        // ERC-8004 feed tx hashes are NOT proof hashes — they're on-chain txs
        const isTxHash = /^0x[0-9a-f]{64}$/i.test(hash);
        const gnosisUrl   = `https://gnosisscan.io/tx/${hash}`;
        const baseUrl     = `https://basescan.org/tx/${hash}`;
        const baseSepoliaUrl = `https://sepolia.basescan.org/tx/${hash}`;
        return (
          <div className="card" style={{ padding: '1.5rem' }}>
            {isTxHash ? (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--amber)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  ⚠ This looks like a transaction hash, not a proof hash.
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  The ERC-8004 feed shows <strong>on-chain transaction hashes</strong>. Proof hashes are separate
                  KV attestation records submitted by agents. View the transaction on a block explorer instead:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a href={gnosisUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.875rem' }}>View on Gnosis ↗</a>
                  <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.875rem' }}>View on Base ↗</a>
                  <a href={baseSepoliaUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.875rem' }}>View on Base Sepolia ↗</a>
                </div>
              </>
            ) : (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
                Proof hash not found. It may still be pending on-chain submission.
              </p>
            )}
          </div>
        );
      })()}

      {/* Found: on-chain tx receipt */}
      {status === 'found-tx' && txRecord && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="card" style={{ borderColor: 'var(--green)', background: 'var(--green-bg)', padding: '0.75rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>
                {txRecord.status === 'success' ? '✓' : '✕'} ERC-8004 Transaction — {txRecord.chain}
              </span>
              <span className="pill pill-green" style={{ fontSize: '0.72rem' }}>Block #{txRecord.block.toLocaleString()}</span>
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">Transaction Details</div>
            {[
              { label: 'Chain',    value: `${txRecord.chain} (chainId ${txRecord.chainId})` },
              { label: 'Status',   value: <span className={txRecord.status === 'success' ? 'pill pill-green' : 'pill pill-red'} style={{ fontSize: '0.72rem' }}>{txRecord.status.toUpperCase()}</span> },
              { label: 'Block',    value: <span className="mono" style={{ fontSize: '0.82rem' }}>#{txRecord.block.toLocaleString()}</span> },
              { label: 'From',     value: <span className="mono" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{txRecord.from}</span> },
              { label: 'Registry', value: <span className="mono" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{txRecord.registry}</span> },
              { label: 'Gas Used', value: txRecord.gasUsed.toLocaleString() },
              { label: 'Explorer', value: (
                <a href={txRecord.explorerUrl} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--red)', fontSize: '0.78rem', fontWeight: 600 }}>
                  View on {txRecord.chain} ↗
                </a>
              )},
            ].map((row, i, arr) => (
              <div key={i} className="data-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="data-label">{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>

          {txRecord.events.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">Registry Events ({txRecord.events.length})</div>
              {txRecord.events.map((ev, i) => (
                <div key={i} className="data-row" style={{ borderBottom: i < txRecord.events.length - 1 ? '1px solid var(--border)' : 'none', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{ev.eventType}</span>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {ev.agentId !== null && <span>Agent ID: <strong style={{ color: 'var(--red)' }}>#{ev.agentId}</strong></span>}
                    {ev.to && <span>To: <span className="mono" style={{ fontSize: '0.7rem' }}>{ev.to.slice(0, 10)}…</span></span>}
                    {ev.from && ev.from !== '0x0000000000000000000000000000000000000000' && (
                      <span>From: <span className="mono" style={{ fontSize: '0.7rem' }}>{ev.from.slice(0, 10)}…</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Found: KV attestation record */}
      {status === 'found' && record && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">Attestation Record</div>
          {[
            { label: 'Status', value: (
              <span className={statusPill}>
                {(record.status ?? (record.verified ? 'verified' : 'pending')).toUpperCase()}
              </span>
            )},
            { label: 'Agent',      value: record.agentName ?? '—' },
            { label: 'Task ID',    value: record.taskId ? <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{record.taskId.slice(0, 24)}…</span> : '—' },
            { label: 'Proof Hash', value: <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--red)', wordBreak: 'break-all' }}>{record.proofHash}</span> },
            { label: 'Submitted',  value: record.submittedAt ? ts(record.submittedAt) : '—' },
            ...(record.verifiedAt ? [{ label: 'Verified', value: ts(record.verifiedAt) }] : []),
            ...(record.txHash ? [{ label: 'Tx Hash', value: (
              <a href={`https://gnosisscan.io/tx/${record.txHash}`} target="_blank" rel="noopener noreferrer"
                className="mono" style={{ fontSize: '0.72rem', color: 'var(--red)', textDecoration: 'none' }}>
                {record.txHash.slice(0, 22)}… ↗
              </a>
            )}] : []),
            ...(record.notaRef ? [{ label: 'Nota Ref', value: <span className="mono" style={{ fontSize: '0.75rem' }}>{record.notaRef}</span> }] : []),
            { label: 'Chain', value: 'Gnosis Chain (chainId 100)' },
          ].map((row, i, arr) => (
            <div key={i} className="data-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="data-label">{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      <footer className="site-footer">
        <div>notapaperclip.red · Independent agent trust oracle</div>
        <div>Works with <a href="https://paperclip.ing" target="_blank" rel="noopener noreferrer">Paperclip.ing</a> companies · ERC-8004 on Gnosis Chain</div>
      </footer>

    </div>
  );
}
