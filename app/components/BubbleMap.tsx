'use client';

import { useState } from 'react';

interface BubbleMapProps {
  agentId: string;
  chain: 'base' | 'gnosis' | 'base-sepolia';
  title?: string;
  height?: number;
}

const CHAIN_CONFIG = {
  base: { name: 'Base', rpc: 'https://mainnet.base.org' },
  gnosis: { name: 'Gnosis Chain', rpc: 'https://rpc.gnosischain.com' },
  'base-sepolia': { name: 'Base Sepolia', rpc: 'https://sepolia.base.org' },
};

export default function BubbleMap({ agentId, chain, title, height = 700 }: BubbleMapProps) {
  const [selectedChain, setSelectedChain] = useState<'base' | 'gnosis' | 'base-sepolia'>(chain);
  const config = CHAIN_CONFIG[selectedChain];
  
  // Use demo address for "Open in Bubblemaps" if this appears to be a demo
  const displayAddress = agentId.startsWith('0x') ? agentId : '0x833589fCD6eDb6E08f4c7C32D4f71a54fB4D0532';

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, flex: 1 }}>
          {title || `Swarm Network Visualization`}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
          {Object.entries(CHAIN_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedChain(key as 'base' | 'gnosis' | 'base-sepolia')}
              className={`btn-secondary ${selectedChain === key ? 'btn-primary' : ''}`}
              style={{
                fontSize: '0.625rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                background: selectedChain === key ? 'var(--red)' : 'var(--bg)',
                color: selectedChain === key ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {config.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '1rem', background: 'var(--bg)' }}>
        {/* Placeholder for Bubblemaps{/* Chain-specific network visualization */}
        <div style={{
          width: '100%',
          height: `${height}px`,
          border: '2px dashed var(--border-md)',
          borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Demo network visualization */}
          <div style={{ position: 'absolute', top: 20, left: 20, fontSize: '0.7rem', color: 'var(--muted)' }}>
            {config.name} Network Demo
          </div>
          
          {/* Chain-specific network patterns */}
          {selectedChain === 'base' && (
            <>
              {/* Base: Highly centralized pattern */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#0052FF',
                border: '3px solid white',
                boxShadow: '0 4px 12px rgba(0, 82, 255, 0.3)',
                position: 'relative',
                zIndex: 2,
              }} />
              {[
                { top: '20%', left: '10%', size: 25 },
                { top: '25%', right: '15%', size: 20 },
                { bottom: '30%', left: '8%', size: 22 },
                { bottom: '25%', right: '12%', size: 18 },
                { top: '40%', left: '25%', size: 15 },
                { top: '35%', right: '28%', size: 16 },
              ].map((node, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: `${node.size}px`,
                    height: `${node.size}px`,
                    borderRadius: '50%',
                    background: '#0052FF',
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0, 82, 255, 0.2)',
                    opacity: 0.6,
                    ...node,
                  }}
                />
              ))}
            </>
          )}
          
          {selectedChain === 'base-sepolia' && (
            <>
              {/* Base Sepolia: Moderate decentralization */}
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#1A8BFF',
                border: '3px solid white',
                boxShadow: '0 4px 12px rgba(26, 139, 255, 0.3)',
                position: 'relative',
                zIndex: 2,
              }} />
              {[
                { top: '25%', left: '20%', size: 35 },
                { top: '30%', right: '25%', size: 32 },
                { bottom: '35%', left: '15%', size: 38 },
                { bottom: '28%', right: '20%', size: 30 },
                { top: '50%', left: '35%', size: 28 },
                { top: '45%', right: '30%', size: 33 },
                { top: '15%', left: '45%', size: 25 },
                { bottom: '15%', right: '45%', size: 27 },
              ].map((node, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: `${node.size}px`,
                    height: `${node.size}px`,
                    borderRadius: '50%',
                    background: `hsl(${210 + i * 10}, 80%, 60%)`,
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    ...node,
                  }}
                />
              ))}
            </>
          )}
          
          {selectedChain === 'gnosis' && (
            <>
              {/* Gnosis: Highly decentralized pattern */}
              {[
                { top: '20%', left: '15%', size: 40 },
                { top: '25%', right: '20%', size: 35 },
                { bottom: '30%', left: '18%', size: 38 },
                { bottom: '25%', right: '22%', size: 32 },
                { top: '45%', left: '30%', size: 36 },
                { top: '40%', right: '35%', size: 34 },
                { top: '15%', left: '45%', size: 30 },
                { bottom: '15%', right: '40%', size: 33 },
                { top: '60%', left: '25%', size: 28 },
                { bottom: '60%', right: '28%', size: 31 },
                { top: '35%', left: '50%', size: 35 },
                { top: '30%', right: '50%', size: 32 },
              ].map((node, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: `${node.size}px`,
                    height: `${node.size}px`,
                    borderRadius: '50%',
                    background: `hsl(${120 + i * 15}, 70%, 50%)`,
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    ...node,
                  }}
                />
              ))}
            </>
          )}
          
          {/* Connection lines */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {(selectedChain === 'base' ? [
              { x1: '50%', y1: '50%', x2: '10%', y2: '20%' },
              { x1: '50%', y1: '50%', x2: '85%', y2: '25%' },
              { x1: '50%', y1: '50%', x2: '8%', y2: '70%' },
              { x1: '50%', y1: '50%', x2: '88%', y2: '75%' },
              { x1: '50%', y1: '50%', x2: '25%', y2: '40%' },
              { x1: '50%', y1: '50%', x2: '72%', y2: '35%' },
            ] : selectedChain === 'base-sepolia' ? [
              { x1: '50%', y1: '50%', x2: '20%', y2: '25%' },
              { x1: '50%', y1: '50%', x2: '75%', y2: '30%' },
              { x1: '50%', y1: '50%', x2: '15%', y2: '65%' },
              { x1: '50%', y1: '50%', x2: '80%', y2: '72%' },
              { x1: '50%', y1: '50%', x2: '35%', y2: '50%' },
              { x1: '50%', y1: '50%', x2: '70%', y2: '45%' },
              { x1: '50%', y1: '50%', x2: '45%', y2: '15%' },
              { x1: '50%', y1: '50%', x2: '55%', y2: '85%' },
            ] : [
              // Gnosis: Interconnected mesh
              { x1: '15%', y1: '20%', x2: '80%', y2: '25%' },
              { x1: '20%', y1: '70%', x2: '75%', y2: '75%' },
              { x1: '30%', y1: '45%', x2: '70%', y2: '40%' },
              { x1: '45%', y1: '15%', x2: '40%', y2: '85%' },
              { x1: '25%', y1: '60%', x2: '72%', y2: '35%' },
              { x1: '50%', y1: '35%', x2: '50%', y2: '30%' },
              { x1: '50%', y1: '50%', x2: '50%', y2: '32%' },
            ]).map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            ))}
          </svg>
          
          {/* Chain-specific labels */}
          <div style={{ position: 'absolute', bottom: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-2)' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {selectedChain === 'base' && 'Centralized Hub Pattern'}
              {selectedChain === 'base-sepolia' && 'Moderate Decentralization'}
              {selectedChain === 'gnosis' && 'Distributed Mesh Network'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {selectedChain === 'base' && 'Large central hub with satellite nodes'}
              {selectedChain === 'base-sepolia' && 'Balanced hub-and-spoke with multiple centers'}
              {selectedChain === 'gnosis' && 'Highly interconnected peer-to-peer network'}
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <a
            href={`https://bubblemaps.io/map?address=${displayAddress}&chain=${chain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: '0.75rem' }}
          >
            Open in Bubblemaps ↗
          </a>
        </div>
      </div>
    </div>
  );
}
