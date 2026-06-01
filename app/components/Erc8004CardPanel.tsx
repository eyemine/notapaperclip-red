'use client';

interface Binding {
  bindingContract: string;
  tokenStandard: string;
  tokenContract: string;
  tokenId: string;
  verified: boolean;
}

interface NormieTraits {
  Type: string; Gender: string; Age: string;
  'Hair Style': string; 'Facial Feature': string;
  Eyes: string; Expression: string; Accessory: string;
}
interface NormieCanvas {
  actionPoints: number; level: number; isCustomized: boolean; delegate: string | null;
}
interface NormieInfo {
  tokenId: number;
  traits: NormieTraits | null;
  canvas: NormieCanvas | null;
  imageUrl: string; svgUrl: string; isAgent: boolean;
}
interface Card {
  agentId: number; chain: string; registry: string; agentURI: string;
  owner: string | null; name: string | null; description: string | null; image: string | null;
  services: Array<{ name: string; endpoint: string; version?: string }> | null;
  skills: Array<{ id?: string; name: string; description?: string; tags?: string[] }> | null;
  a2aEndpoint: string | null; x402Support: boolean | null; explorerUrl: string;
  binding: Binding | null;
  pairedAgent: { name: string; chain: string; agentId: number } | null;
  normies?: NormieInfo | null;
}

const ipfs = (u: string) => u?.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u;
const sh = (a: string) => `${a.slice(0,6)}…${a.slice(-4)}`;
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' };
const m: React.CSSProperties = { color: 'var(--muted)' };
const lk: React.CSSProperties = { color: 'var(--red)', textDecoration: 'none', fontSize: '0.8rem' };
const trunc: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' };

export function Erc8004CardPanel({ card }: { card: Card }) {
  const origin = card.explorerUrl.replace(/\/address\/.*$/, '');
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>ERC-8004 Agent Card</h2>
        <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'var(--bg)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {card.chain} · #{card.agentId}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: card.image ? '120px 1fr' : '1fr' }}>
        {card.image && (
          <img src={ipfs(card.image)} alt={card.name || 'Agent'}
            style={{ width: 120, height: 120, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', minWidth: 0 }}>
          {card.name && <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{card.name}</div>}
          {card.description && <div style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{card.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {card.owner && <div style={row}><span style={m}>Owner</span><a href={`${origin}/address/${card.owner}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ ...lk, color: '#d97706' }}>{sh(card.owner)}</a></div>}
            <div style={row}><span style={m}>Registry</span><a href={card.explorerUrl} target="_blank" rel="noopener noreferrer" className="mono" style={lk}>{sh(card.registry)}</a></div>
            {card.a2aEndpoint && <div style={row}><span style={m}>A2A Endpoint</span><a href={card.a2aEndpoint} target="_blank" rel="noopener noreferrer" style={{ ...lk, ...trunc }}>{card.a2aEndpoint.replace(/^https?:\/\//, '')}</a></div>}
            <div style={row}><span style={m}>Agent URI</span><a href={card.agentURI} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.75rem', ...trunc }}>{card.agentURI.replace(/^https?:\/\//, '').slice(0, 50)}…</a></div>
            {card.x402Support !== null && <div style={row}><span style={m}>x402 Support</span><span style={{ color: card.x402Support ? 'var(--green)' : 'var(--amber)' }}>{card.x402Support ? '✓ Yes' : '— No'}</span></div>}
            {card.pairedAgent && <div style={{ ...row, borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.2rem' }}><span style={m}>Paired (ghostagent.ninja)</span><a href={`https://ghostagent.ninja/agent/${card.pairedAgent.name}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', textDecoration: 'none' }}>{card.pairedAgent.name} ↗</a></div>}
          </div>
        </div>
      </div>
      {card.skills && card.skills.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)', marginBottom: '0.6rem' }}>Skills ({card.skills.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {card.skills.map((s, i) => <span key={i} title={s.description || ''} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>{s.name}</span>)}
          </div>
        </div>
      )}
      {card.services && card.services.length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)', marginBottom: '0.6rem' }}>Services</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
            {card.services.map((s, i) => <div key={i} style={row}><span style={m}>{s.name}{s.version ? ` v${s.version}` : ''}</span><a href={s.endpoint} target="_blank" rel="noopener noreferrer" style={{ ...lk, ...trunc }}>{s.endpoint.replace(/^https?:\/\//, '')}</a></div>)}
          </div>
        </div>
      )}
      {card.normies && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)', margin: 0 }}>
              Normie #{card.normies.tokenId}
            </h3>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {card.normies.canvas && (
                <>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                    Lv {card.normies.canvas.level}
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    {card.normies.canvas.actionPoints} AP
                  </span>
                  {card.normies.canvas.isCustomized && (
                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }}>Customized</span>
                  )}
                </>
              )}
              {card.normies.isAgent && (
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>Agent Type</span>
              )}
            </div>
          </div>
          {card.normies.traits && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.4rem', fontSize: '0.75rem' }}>
              {(Object.entries(card.normies.traits) as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
            <a href={card.normies.svgUrl} target="_blank" rel="noopener noreferrer" style={{ ...lk, fontSize: '0.75rem' }}>SVG ↗</a>
            <a href={`https://normies.art/normie/${card.normies.tokenId}`} target="_blank" rel="noopener noreferrer" style={{ ...lk, fontSize: '0.75rem' }}>View on normies.art ↗</a>
          </div>
        </div>
      )}
      {card.binding && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)', margin: 0 }}>ERC-8048 Binding</h3>
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: card.binding.verified ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: card.binding.verified ? 'var(--green)' : 'var(--amber)', border: `1px solid ${card.binding.verified ? 'var(--green)' : 'var(--amber)'}` }}>
              {card.binding.verified ? '✓ Verified on-chain' : '⚠ Unverified'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
            <div style={row}><span style={m}>Standard</span><span>{card.binding.tokenStandard}</span></div>
            <div style={row}><span style={m}>Token Contract</span><a href={`${origin}/address/${card.binding.tokenContract}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ ...lk, color: '#d97706' }}>{sh(card.binding.tokenContract)}</a></div>
            <div style={row}><span style={m}>Token ID</span><span className="mono" style={{ fontSize: '0.75rem' }}>#{card.binding.tokenId}</span></div>
            <div style={row}><span style={m}>Binding Contract</span><a href={`${origin}/address/${card.binding.bindingContract}`} target="_blank" rel="noopener noreferrer" className="mono" style={lk}>{sh(card.binding.bindingContract)}</a></div>
          </div>
        </div>
      )}
    </div>
  );
}
