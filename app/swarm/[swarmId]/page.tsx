'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SwarmNetworkGraph from '../../components/SwarmNetworkGraph';
import type { SwarmConnectionGraph } from '../../api/swarm/connections/route';

export default function SwarmMapPage() {
  const params = useParams();
  const swarmId = params.swarmId as string;
  const [graph, setGraph]   = useState<SwarmConnectionGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    async function fetchSwarmData() {
      try {
        const res = await fetch(`/api/swarm/connections?swarmId=${encodeURIComponent(swarmId)}`);
        const data = await res.json() as SwarmConnectionGraph & { error?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setGraph(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    if (swarmId) fetchSwarmData();
  }, [swarmId]);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="page-hero">
          <h1>Swarm Network Map</h1>
          <p className="mono" style={{ opacity: 0.6 }}>{swarmId} · loading…</p>
        </div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="page-wrap-wide">
        <div className="page-hero" style={{ textAlign: 'center' }}>
          <h1>Swarm Network Map</h1>
          <p>No swarm data found for <span className="mono">{swarmId}</span>.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
            Create a swarm by minting a <span className="mono">vault.gno</span> agent and registering
            <span className="mono"> picoclaw.gno</span> members via <span className="mono">/api/swarm/enable</span>.
          </p>
        </div>
        {error && (
          <div className="alert alert-warn" style={{ marginTop: '1.5rem' }}>
            {error}
          </div>
        )}
        <footer className="site-footer" style={{ marginTop: '3rem' }}>
          <div>notapaperclip.red · Agent trust oracle · ERC-8004 on Gnosis Chain</div>
        </footer>
      </div>
    );
  }

  return (
    <div className="page-wrap-wide">
      <div className="page-hero" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1>Swarm Network Map</h1>
        <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '0.875rem' }}>
          Visual trust audit for <span className="mono">{graph.swarmId}</span>.
          Nodes = agents · Edges = verified connections · Color = alignment score.
        </p>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <SwarmNetworkGraph data={graph} />
      </div>

      {/* What this shows */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">What This Map Reveals</div>
        <div style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
            <div>🔍 <strong>Centralization Risk</strong> — large single nodes = control concentration</div>
            <div>🕸️ <strong>Sybil Clusters</strong> — identical edge patterns across many nodes</div>
            <div>🤝 <strong>Trust Networks</strong> — solid lines = verified GhostWire handshakes</div>
            <div>⚠️ <strong>Bostrom Risk</strong> — rapidly expanding nodes = resource extraction</div>
            <div>📧 <strong>Email Channels</strong> — dashed lines = nftmail.box messages</div>
            <div>🔵 <strong>A2A Links</strong> — dotted lines = agent-to-agent protocol calls</div>
          </div>
        </div>
      </div>

      <footer className="site-footer" style={{ marginTop: '3rem' }}>
        <div>notapaperclip.red · Agent trust oracle · ERC-8004 on Gnosis Chain</div>
      </footer>
    </div>
  );
}
