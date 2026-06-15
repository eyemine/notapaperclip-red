'use client';

import { useState, useEffect, useCallback } from 'react';

const NORMIES_NFT_CONTRACT    = '0x7Bc1C072742D8391817EB4Eb2317F98dc72C61dB'; // Base
const NORMIES_BINDING_CONTRACT = '0xde152afb7db5373f34876e1499fbd893a82dd336'; // Base
const ERC8048_REGISTRY        = '0x0106341056a8790f4b924c380ed5B81B2a062bCE'; // Gnosis
const BASE_RPC                = 'https://mainnet.base.org';
const GNOSIS_RPC              = 'https://rpc.gnosischain.com';
const BASE_EXPLORER           = 'https://basescan.org';
const GNOSIS_EXPLORER         = 'https://gnosisscan.io';

const mono: React.CSSProperties = { fontFamily: 'var(--mono, monospace)' };
const muted: React.CSSProperties = { color: 'var(--muted)' };
const sh = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

interface BindingState {
  bound: boolean;
  agentWallet: string | null;
  issuedAt: number | null;
  rawResult: string | null;
}

interface Erc8048Entry {
  key: string;
  valueHex: string;
  valueText: string | null;
}

interface SidecarState {
  entries: Erc8048Entry[];
  raw: string | null;
}

// ─── RPC helpers ─────────────────────────────────────────────────────────────

async function ethCall(rpc: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await res.json() as { result?: string; error?: { message?: string } };
    if (d.error) return null;
    return d.result ?? null;
  } catch {
    return null;
  }
}

function decodeAddress(hex: string): string | null {
  if (!hex || hex === '0x' || hex.length < 66) return null;
  const raw = hex.slice(-40);
  const addr = `0x${raw}`;
  if (addr === '0x0000000000000000000000000000000000000000') return null;
  return addr;
}

function decodeUint(hex: string, offset = 0): bigint | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const chunk = clean.slice(offset * 64, offset * 64 + 64);
    if (!chunk || chunk.length < 64) return null;
    return BigInt(`0x${chunk}`);
  } catch {
    return null;
  }
}

function hexToUtf8(hex: string): string | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (!clean) return null;
    const bytes = clean.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [];
    const str = String.fromCharCode(...bytes).replace(/\0.*$/, '').trim();
    return str.length > 0 && str.length < 512 ? str : null;
  } catch {
    return null;
  }
}

function padTokenId(tokenId: string): string {
  return BigInt(tokenId).toString(16).padStart(64, '0');
}

// ─── Pass 1: Normies binding contract ────────────────────────────────────────
// Try common function signatures for agent binding lookups

async function queryNormiesBinding(tokenId: string): Promise<BindingState> {
  const tid = padTokenId(tokenId);

  // Try: getAgentWallet(uint256) → address
  const sig1 = '0x' + encodeURIComponent('getAgentWallet(uint256)').replace(/%../g, '') + tid;
  // Use selector: keccak256("getAgentWallet(uint256)") first 4 bytes
  // Precomputed: 0x3b52f53c
  const r1 = await ethCall(BASE_RPC, NORMIES_BINDING_CONTRACT, `0x3b52f53c${tid}`);
  if (r1 && r1 !== '0x' && r1.length >= 66) {
    const addr = decodeAddress(r1);
    if (addr) return { bound: true, agentWallet: addr, issuedAt: null, rawResult: r1 };
  }

  // Try: agentOf(uint256) → address  selector: 0x56e8f2a7
  const r2 = await ethCall(BASE_RPC, NORMIES_BINDING_CONTRACT, `0x56e8f2a7${tid}`);
  if (r2 && r2 !== '0x' && r2.length >= 66) {
    const addr = decodeAddress(r2);
    if (addr) return { bound: true, agentWallet: addr, issuedAt: null, rawResult: r2 };
  }

  // Try: bindings(uint256) → returns struct  selector: 0xe2ee9267
  const r3 = await ethCall(BASE_RPC, NORMIES_BINDING_CONTRACT, `0xe2ee9267${tid}`);
  if (r3 && r3 !== '0x' && r3.length >= 66) {
    const addr = decodeAddress(r3);
    const ts = decodeUint(r3, 1);
    if (addr) return { bound: true, agentWallet: addr, issuedAt: ts ? Number(ts) : null, rawResult: r3 };
  }

  // Try: getBinding(uint256) → (address, uint256) selector: 0x9a6c4ed7
  const r4 = await ethCall(BASE_RPC, NORMIES_BINDING_CONTRACT, `0x9a6c4ed7${tid}`);
  if (r4 && r4 !== '0x' && r4.length >= 130) {
    const addr = decodeAddress(r4.slice(0, 66));
    const ts = decodeUint(r4, 1);
    if (addr) return { bound: true, agentWallet: addr, issuedAt: ts ? Number(ts) : null, rawResult: r4 };
  }

  // Try: agentIdentities(uint256) selector: 0x0f8b5295
  const r5 = await ethCall(BASE_RPC, NORMIES_BINDING_CONTRACT, `0x0f8b5295${tid}`);
  if (r5 && r5 !== '0x' && r5.length >= 66) {
    const addr = decodeAddress(r5);
    if (addr) return { bound: true, agentWallet: addr, issuedAt: null, rawResult: r5 };
  }

  return { bound: false, agentWallet: null, issuedAt: null, rawResult: r5 ?? r4 ?? r3 ?? r2 ?? r1 ?? null };
}

// ─── Pass 2: ERC-8048 sidecar (Gnosis) ───────────────────────────────────────

const KNOWN_KEYS = ['agent-binding', 'story[ip_id]', 'story[license_id]', 'cdr[vault_id]', 'agent[endpoint]', 'agent[a2a]'];

async function queryErc8048Sidecar(tokenId: string): Promise<SidecarState> {
  const tid = padTokenId(tokenId);
  const entries: Erc8048Entry[] = [];

  await Promise.all(KNOWN_KEYS.map(async (key) => {
    // getMetadata(uint256 tokenId, string key) → bytes
    // Encode: selector + tokenId + offset(64) + key length + key bytes
    const keyBytes = Buffer.from(key, 'utf8');
    const keyLen = keyBytes.length.toString(16).padStart(64, '0');
    const keyHex = Buffer.from(keyBytes).toString('hex').padEnd(Math.ceil(keyBytes.length / 32) * 64, '0');
    const calldata = `0x5f7657c5${tid}0000000000000000000000000000000000000000000000000000000000000040${keyLen}${keyHex}`;

    const r = await ethCall(GNOSIS_RPC, ERC8048_REGISTRY, calldata);
    if (r && r !== '0x' && r.length > 4) {
      const text = hexToUtf8(r.slice(2));
      entries.push({ key, valueHex: r, valueText: text && text.length > 1 ? text : null });
    }
  }));

  return { entries, raw: null };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  tokenId: string;
  nftImageUrl?: string | null;
}

export function NormiesAgentBindingPanel({ tokenId, nftImageUrl }: Props) {
  const [binding, setBinding]   = useState<BindingState | null>(null);
  const [sidecar, setSidecar]   = useState<SidecarState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [done, setDone]         = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setBinding(null); setSidecar(null); setDone(false);
    const [b, s] = await Promise.all([
      queryNormiesBinding(tokenId),
      queryErc8048Sidecar(tokenId),
    ]);
    setBinding(b);
    setSidecar(s);
    setScanning(false);
    setDone(true);
  }, [tokenId]);

  useEffect(() => { runScan(); }, [runScan]);

  const hasSidecar = (sidecar?.entries.length ?? 0) > 0;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {nftImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={nftImageUrl} alt={`Normie #${tokenId}`}
            style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Normie #{tokenId} — Forensic Agent Scan</h2>
            {scanning && <span style={{ fontSize: '0.7rem', ...muted, ...mono }}>scanning…</span>}
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', ...muted, lineHeight: 1.5 }}>
            Dual-pass forensic sweep: proprietary Normies binding contract (Base) vs open ERC-8048 sidecar registry (Gnosis).
          </p>
        </div>
      </div>

      {/* Pass 1 — Normies Proprietary Binding */}
      <div style={{ marginBottom: '1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
            Pass 1 — Proprietary Binding Contract
          </span>
          <a href={`${BASE_EXPLORER}/address/${NORMIES_BINDING_CONTRACT}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', ...mono, color: 'var(--red)', textDecoration: 'none' }}>
            {sh(NORMIES_BINDING_CONTRACT)} ↗
          </a>
        </div>
        {scanning ? (
          <div style={{ fontSize: '0.8rem', ...muted }}>Querying Base mainnet…</div>
        ) : done && binding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={muted}>Agent Binding Status</span>
              <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
                background: binding.bound ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.08)',
                color: binding.bound ? 'var(--green)' : 'var(--amber)',
                border: `1px solid ${binding.bound ? 'var(--green)' : 'var(--amber)'}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {binding.bound ? '✓ Bound' : '— Unbound'}
              </span>
            </div>
            {binding.agentWallet && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={muted}>Agent Wallet</span>
                <a href={`${BASE_EXPLORER}/address/${binding.agentWallet}`} target="_blank" rel="noopener noreferrer"
                  style={{ ...mono, color: '#d97706', fontSize: '0.8rem', textDecoration: 'none' }}>
                  {sh(binding.agentWallet)} ↗
                </a>
              </div>
            )}
            {binding.issuedAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={muted}>Bound At</span>
                <span style={{ ...mono, fontSize: '0.8rem', color: 'var(--text)' }}>
                  {new Date(binding.issuedAt * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC
                </span>
              </div>
            )}
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', ...muted, borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
              Schema: proprietary — token&nbsp;id&nbsp;→&nbsp;agent wallet (single mapping). Cannot be extended without redeployment.
            </div>
            {!binding.bound && binding.rawResult && (
              <details style={{ marginTop: '0.35rem' }}>
                <summary style={{ fontSize: '0.7rem', ...muted, cursor: 'pointer' }}>Raw RPC result</summary>
                <div style={{ ...mono, fontSize: '0.68rem', wordBreak: 'break-all', color: 'var(--muted)', marginTop: '0.25rem' }}>{binding.rawResult}</div>
              </details>
            )}
          </div>
        ) : null}
      </div>

      {/* Pass 2 — ERC-8048 Open Sidecar */}
      <div style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
            Pass 2 — ERC-8048 Open Sidecar Registry
          </span>
          <a href={`${GNOSIS_EXPLORER}/address/${ERC8048_REGISTRY}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', ...mono, color: 'var(--red)', textDecoration: 'none' }}>
            {sh(ERC8048_REGISTRY)} ↗
          </a>
        </div>
        {scanning ? (
          <div style={{ fontSize: '0.8rem', ...muted }}>Querying Gnosis mainnet…</div>
        ) : done ? (
          hasSidecar ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sidecar!.entries.map(e => (
                <div key={e.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ ...mono, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{e.key}</span>
                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', border: '1px solid var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ✓ Set
                    </span>
                  </div>
                  <span style={{ ...mono, fontSize: '0.78rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                    {e.valueText ?? (e.valueHex.length > 34 ? `${e.valueHex.slice(0, 26)}…` : e.valueHex)}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: '0.72rem', ...muted, borderTop: '1px solid var(--border)', paddingTop: '0.35rem', marginTop: '0.25rem' }}>
                Schema: open standard — infinite extensible key/value. Binding contract can be wrapped as <span style={mono}>agent-binding</span> row.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', ...muted }}>
              No ERC-8048 sidecar entries found for token #{tokenId}. This NFT has not yet been enrolled in the open registry.{' '}
              <a href={`https://ghostagent.ninja/dashboard/erc8048?agent=normie.${tokenId}`} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--red)', textDecoration: 'none' }}>
                Enroll sidecar →
              </a>
            </div>
          )
        ) : null}
      </div>

      {/* Comparative footnote */}
      {done && (
        <div style={{ marginTop: '0.875rem', fontSize: '0.7rem', ...muted, borderTop: '1px solid var(--border)', paddingTop: '0.75rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Forensic note:</strong> The Normies binding contract (Pass 1) is a closed, single-purpose identity index — extending it requires a new deployment.
          The ERC-8048 sidecar (Pass 2) is an infinite key-value layer: it can wrap the proprietary binding as a row (<span style={mono}>agent-binding → 0xde15…</span>) while adding Story IP IDs, CDR vault references, and any future field without touching either contract.
        </div>
      )}

      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={runScan} disabled={scanning}
          style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: scanning ? 'not-allowed' : 'pointer' }}>
          {scanning ? 'Scanning…' : '↺ Re-scan'}
        </button>
      </div>
    </div>
  );
}
