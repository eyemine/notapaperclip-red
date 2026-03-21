'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SwarmNode, SwarmEdge, SwarmConnectionGraph } from '../api/swarm/connections/route';

interface SwarmNetworkGraphProps {
  data: SwarmConnectionGraph;
}

const EDGE_COLORS: Record<string, string> = {
  handshake: '#b0805c',
  email:     '#60a5fa',
  a2a:       '#a78bfa',
  poll:      '#34d399',
};

const EDGE_DASH: Record<string, string> = {
  handshake: 'none',
  email:     '6,4',
  a2a:       '2,4',
  poll:      '8,3',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

function roleSymbol(role: string): string {
  if (role === 'coordinator' || role === 'orchestrator') return '◆';
  if (role === 'risk-module') return '⬡';
  return '●';
}

export default function SwarmNetworkGraph({ data }: SwarmNetworkGraphProps) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: SwarmNode } | null>(null);
  const [selected, setSelected] = useState<SwarmNode | null>(null);
  const simRef = useRef<any>(null);

  const W = 800;
  const H = 600;
  const CX = W / 2;
  const CY = H / 2;

  // Lay out nodes deterministically in a circle, coordinator in center
  const positionedNodes = useCallback(() => {
    const sorted = [...data.nodes].sort((a, b) =>
      a.role === 'coordinator' || a.role === 'orchestrator' ? -1 :
      b.role === 'coordinator' || b.role === 'orchestrator' ? 1 : 0
    );
    const [first, ...rest] = sorted;
    const R = Math.min(200, 60 * rest.length);
    return sorted.map((n, i) => {
      if (i === 0) return { ...n, x: CX, y: CY };
      const angle = (2 * Math.PI * (i - 1)) / rest.length - Math.PI / 2;
      return { ...n, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes]);

  const nodes = positionedNodes();
  const nodeById = Object.fromEntries(nodes.map(n => [String(n.agentId), n]));

  const downloadPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-${data.swarmId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const healthColor = data.healthStatus === 'healthy' ? '#22c55e' :
                      data.healthStatus === 'degraded' ? '#eab308' : '#ef4444';

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(176,128,92,0.2)',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
      }}>
        <div><span style={{ color: '#888' }}>Swarm ID: </span><strong style={{ color: '#f2eee4' }}>{data.swarmId}</strong></div>
        <div><span style={{ color: '#888' }}>Agents: </span><strong style={{ color: '#f2eee4' }}>{data.nodes.length}</strong></div>
        <div><span style={{ color: '#888' }}>Connections: </span><strong style={{ color: '#f2eee4' }}>{data.connectionCount}</strong></div>
        <div>
          <span style={{ color: '#888' }}>Avg Alignment: </span>
          <strong style={{ color: scoreColor(data.avgAlignmentScore) }}>
            {data.avgAlignmentScore}/100
          </strong>
        </div>
        <div>
          <span style={{ color: '#888' }}>Status: </span>
          <strong style={{ color: healthColor }}>
            {data.healthStatus === 'healthy' ? '✓ Healthy' :
             data.healthStatus === 'degraded' ? '⚠ Degraded' : '✗ Critical'}
          </strong>
        </div>
      </div>

      {/* SVG graph */}
      <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(176,128,92,0.15)', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', cursor: 'crosshair' }}
          onClick={() => { setSelected(null); setTooltip(null); }}
        >
          <defs>
            <marker id="arrow-handshake" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={EDGE_COLORS.handshake} opacity="0.6" />
            </marker>
            <marker id="arrow-email" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={EDGE_COLORS.email} opacity="0.6" />
            </marker>
            <marker id="arrow-a2a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={EDGE_COLORS.a2a} opacity="0.6" />
            </marker>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(176,128,92,0.3)" />
              <stop offset="100%" stopColor="rgba(176,128,92,0)" />
            </radialGradient>
          </defs>

          {/* Edges */}
          {data.edges.map((edge, i) => {
            const src = nodeById[String(edge.source)];
            const tgt = nodeById[String(edge.target)];
            if (!src || !tgt) return null;
            const color = EDGE_COLORS[edge.type] ?? '#666';
            const dash  = EDGE_DASH[edge.type]  ?? 'none';
            const width = Math.min(1 + edge.frequency * 0.3, 4);
            // Slight curve
            const mx = (src.x + tgt.x) / 2 + (tgt.y - src.y) * 0.15;
            const my = (src.y + tgt.y) / 2 - (tgt.x - src.x) * 0.15;
            return (
              <g key={i}>
                <path
                  d={`M ${src.x} ${src.y} Q ${mx} ${my} ${tgt.x} ${tgt.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={width}
                  strokeDasharray={dash}
                  strokeOpacity={0.55}
                  markerEnd={`url(#arrow-${edge.type})`}
                />
                {/* Frequency label on edge midpoint */}
                {edge.frequency > 1 && (
                  <text x={mx} y={my} textAnchor="middle" fontSize="9" fill={color} opacity={0.7}>
                    ×{edge.frequency}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const r = node.role === 'coordinator' || node.role === 'orchestrator' ? 32 : 22;
            const color = scoreColor(node.alignmentScore);
            const isSelected = selected?.agentId === node.agentId;
            return (
              <g
                key={String(node.agentId)}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(isSelected ? null : node);
                  setTooltip(null);
                }}
                onMouseEnter={(e) => {
                  const svgRect = svgRef.current!.getBoundingClientRect();
                  const scaleX = W / svgRect.width;
                  const scaleY = H / svgRect.height;
                  setTooltip({
                    x: (e.clientX - svgRect.left) * scaleX,
                    y: (e.clientY - svgRect.top)  * scaleY,
                    node,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Glow ring when selected */}
                {isSelected && (
                  <circle r={r + 8} fill="none" stroke={color} strokeWidth={2} opacity={0.4} strokeDasharray="4,3" />
                )}
                {/* Score ring */}
                <circle r={r + 3} fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} />
                {/* Main circle */}
                <circle r={r} fill={`${color}22`} stroke={color} strokeWidth={2} />
                {/* Role symbol */}
                <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.7} fill={color}>
                  {roleSymbol(node.role)}
                </text>
                {/* Agent name below */}
                <text y={r + 14} textAnchor="middle" fontSize="10" fill="#d1c9bc" fontWeight="600">
                  {node.name}
                </text>
                {/* Score below name */}
                <text y={r + 25} textAnchor="middle" fontSize="9" fill={color}>
                  {node.alignmentScore}%
                </text>
              </g>
            );
          })}

          {/* Tooltip in SVG space */}
          {tooltip && (() => {
            const tx = tooltip.x + 12;
            const ty = tooltip.y - 10;
            const adjustX = tx + 160 > W ? tx - 172 : tx;
            const adjustY = ty - 80 < 0  ? ty + 20  : ty;
            return (
              <g transform={`translate(${adjustX},${adjustY})`} style={{ pointerEvents: 'none' }}>
                <rect x={0} y={-14} width={160} height={70} rx={6}
                  fill="#1a1a1a" stroke="rgba(176,128,92,0.4)" strokeWidth={1} />
                <text y={2}  x={8} fontSize="10" fill="#f2eee4" fontWeight="700">{tooltip.node.name}</text>
                <text y={16} x={8} fontSize="9"  fill="#888">{tooltip.node.email}</text>
                <text y={30} x={8} fontSize="9"  fill={scoreColor(tooltip.node.alignmentScore)}>
                  Alignment: {tooltip.node.alignmentScore}/100
                </text>
                <text y={44} x={8} fontSize="9"  fill="#666">
                  {tooltip.node.safeAddress ? tooltip.node.safeAddress.slice(0, 12) + '…' + tooltip.node.safeAddress.slice(-4) : 'No Safe'}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Legend overlay */}
        <div style={{
          position: 'absolute', bottom: '1rem', left: '1rem',
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(176,128,92,0.2)',
          borderRadius: '0.375rem', padding: '0.5rem 0.75rem',
          fontSize: '0.65rem', color: '#888',
          display: 'flex', flexDirection: 'column', gap: '0.2rem',
        }}>
          <div style={{ fontWeight: 700, color: '#aaa', marginBottom: '0.2rem' }}>Legend</div>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="24" height="8">
                <line x1="0" y1="4" x2="24" y2="4"
                  stroke={color} strokeWidth="2"
                  strokeDasharray={EDGE_DASH[type]} />
              </svg>
              <span style={{ textTransform: 'capitalize' }}>{type}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.3rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[{ label: '≥80%', c: '#22c55e' }, { label: '50–79%', c: '#eab308' }, { label: '<50%', c: '#ef4444' }].map(({ label, c }) => (
                <span key={label} style={{ color: c }}>● {label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected node detail panel */}
      {selected && (
        <div style={{
          marginTop: '1rem', padding: '1rem',
          background: 'rgba(0,0,0,0.3)', border: `1px solid ${scoreColor(selected.alignmentScore)}44`,
          borderRadius: '0.5rem', fontSize: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <strong style={{ color: '#f2eee4', fontSize: '0.875rem' }}>{selected.name}</strong>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1rem' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#aaa' }}>
            <div><span style={{ color: '#666' }}>ERC-8004 ID: </span><span style={{ color: '#f2eee4' }}>#{selected.agentId}</span></div>
            <div><span style={{ color: '#666' }}>Role: </span><span style={{ color: '#f2eee4' }}>{selected.role}</span></div>
            <div><span style={{ color: '#666' }}>TLD: </span><span style={{ color: '#b0805c' }}>.{selected.tld}</span></div>
            <div><span style={{ color: '#666' }}>Alignment: </span><span style={{ color: scoreColor(selected.alignmentScore) }}>{selected.alignmentScore}/100</span></div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#666' }}>Email: </span>
              <a href={`https://notapaperclip.red/inbox?address=${selected.email}`} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>{selected.email}</a>
            </div>
            {selected.safeAddress && (
              <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#666' }}>Safe: </span>
                <a href={`https://app.safe.global/home?safe=gno:${selected.safeAddress}`} target="_blank" rel="noopener noreferrer" style={{ color: '#b0805c', fontFamily: 'monospace' }}>
                  {selected.safeAddress.slice(0, 10)}…{selected.safeAddress.slice(-6)}
                </a>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <span style={{ color: '#666' }}>Connections: </span>
              <span style={{ color: '#f2eee4' }}>
                {data.edges.filter(e => String(e.source) === String(selected.agentId) || String(e.target) === String(selected.agentId)).length} edges
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={downloadPNG}
          style={{
            padding: '0.4rem 0.9rem', fontSize: '0.7rem', borderRadius: '0.375rem',
            background: 'rgba(176,128,92,0.1)', border: '1px solid rgba(176,128,92,0.3)',
            color: '#b0805c', cursor: 'pointer',
          }}
        >
          ↓ Download Graph (SVG)
        </button>
        <a
          href={`/swarm/${data.swarmId}`}
          style={{
            padding: '0.4rem 0.9rem', fontSize: '0.7rem', borderRadius: '0.375rem',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}
        >
          View Full Audit ↗
        </a>
      </div>
    </div>
  );
}
