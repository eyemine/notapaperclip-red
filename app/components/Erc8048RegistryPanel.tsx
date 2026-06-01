'use client';

interface AuditEntry {
  key: string;
  valueHex: string;
  valueText: string | null;
  verified: boolean;
  setAtBlock: number | null;
  setAt: number | null;
  operator: string | null;
  txHash: string | null;
}

interface AuditData {
  tokenId: number;
  registry: string;
  chain: string;
  explorer: string;
  entries: AuditEntry[];
}

const sh = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const m: React.CSSProperties = { color: 'var(--muted)' };
const mono: React.CSSProperties = { fontFamily: 'var(--mono, monospace)' };

function fmtTs(ts: number | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return '—';
  }
}

function displayValue(e: AuditEntry): string {
  if (e.valueText) return e.valueText;
  if (e.valueHex && e.valueHex !== '0x') {
    return e.valueHex.length > 26 ? `${e.valueHex.slice(0, 18)}…${e.valueHex.slice(-6)}` : e.valueHex;
  }
  return '—';
}

export function Erc8048RegistryPanel({ audit }: { audit: AuditData }) {
  const verifiedCount = audit.entries.filter(e => e.verified).length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>EIP-8048 Key-Value Registry State</h2>
        <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'var(--bg)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {audit.chain} · token #{audit.tokenId}
        </span>
      </div>

      <p style={{ ...m, fontSize: '0.8rem', margin: '0 0 1rem' }}>
        Neutral on-chain sweep of the ERC-8048 metadata registry{' '}
        <a href={`${audit.explorer}/address/${audit.registry}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none', ...mono }}>
          {sh(audit.registry)}
        </a>
        . Key definitions are matched against a public dictionary and verified against current chain state.
      </p>

      {audit.entries.length === 0 ? (
        <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
          No recognised ERC-8048 key definitions detected for token #{audit.tokenId} on this registry.
        </div>
      ) : (
        <>
          <div style={{ ...mono, fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>
            🔎 {verifiedCount} ON-CHAIN METADATA DEFINITION{verifiedCount === 1 ? '' : 'S'} DETECTED
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {audit.entries.map((e) => (
              <div
                key={e.key}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                  padding: '0.75rem 0.875rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ ...mono, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{e.key}</span>
                  <span style={{
                    fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 999,
                    background: e.verified ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: e.verified ? 'var(--green)' : 'var(--amber)',
                    border: `1px solid ${e.verified ? 'var(--green)' : 'var(--amber)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {e.verified ? '✓ Verified' : '⚠ Historical'}
                  </span>
                </div>

                <div style={{ ...mono, fontSize: '0.82rem', color: 'var(--text)', wordBreak: 'break-all', marginTop: '0.35rem' }}>
                  {displayValue(e)}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.72rem', ...m }}>
                  <span>Set: {fmtTs(e.setAt)}</span>
                  {e.setAtBlock != null && <span>Block: {e.setAtBlock}</span>}
                  {e.operator && (
                    <span>
                      Operator:{' '}
                      <a href={`${audit.explorer}/address/${e.operator}`} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706', textDecoration: 'none', ...mono }}>
                        {sh(e.operator)}
                      </a>
                    </span>
                  )}
                  {e.txHash && (
                    <a href={`${audit.explorer}/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'none' }}>
                      tx ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ ...m, fontSize: '0.7rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        Independent oracle view — un-opinionated audit of any project writing to the ERC-8048 standard.
      </div>
    </div>
  );
}
