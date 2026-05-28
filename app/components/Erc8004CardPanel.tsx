'use client';

interface Card {
  agentId: number; chain: string; registry: string; agentURI: string;
  owner: string | null; name: string | null; description: string | null; image: string | null;
  services: Array<{ name: string; endpoint: string; version?: string }> | null;
  skills: Array<{ id?: string; name: string; description?: string; tags?: string[] }> | null;
  a2aEndpoint: string | null; x402Support: boolean | null; explorerUrl: string;
  pairedAgent: { name: string; chain: string; agentId: number } | null;
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
    </div>
  );
}
