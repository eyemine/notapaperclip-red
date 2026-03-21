'use client';

import type { DriftResult, DriftSnapshot } from '@/app/services/goal-drift-detector';

function statusColor(status: DriftSnapshot['status']) {
  if (status === 'stable') return 'var(--green)';
  if (status === 'warn')   return 'var(--amber)';
  return 'var(--red)';
}

interface Props {
  result:  DriftResult;
  compact?: boolean;
}

export default function GoalDriftTimeline({ result, compact = false }: Props) {
  const color = result.status === 'stable' ? 'var(--green)'
    : result.status === 'warn' ? 'var(--amber)' : 'var(--red)';
  const pillClass = result.status === 'stable' ? 'pill pill-green'
    : result.status === 'warn' ? 'pill pill-amber' : 'pill pill-red';

  if (compact) {
    return (
      <span className={pillClass}>
        {result.status === 'drift' ? '⚡ ' : result.status === 'warn' ? '⚠ ' : '✓ '}
        Drift {result.currentDriftPct}%
      </span>
    );
  }

  // Build SVG stability graph
  const snaps    = result.snapshots;
  const W        = 560;
  const H        = 80;
  const padding  = { top: 10, bottom: 10, left: 8, right: 32 };
  const innerW   = W - padding.left - padding.right;
  const innerH   = H - padding.top - padding.bottom;

  // Y axis: 0% at bottom, 100% at top — drift goes UP = bad
  const toY = (pct: number) => padding.top + innerH - (pct / 100) * innerH;
  const toX = (i: number)   => padding.left + (snaps.length <= 1 ? innerW / 2 : (i / (snaps.length - 1)) * innerW);

  const points = snaps.map((s, i) => `${toX(i).toFixed(1)},${toY(s.driftPct).toFixed(1)}`).join(' ');
  const areaPoints = snaps.length > 0
    ? `${toX(0).toFixed(1)},${(H - padding.bottom).toFixed(1)} ${points} ${toX(snaps.length - 1).toFixed(1)},${(H - padding.bottom).toFixed(1)}`
    : '';

  // Threshold lines at 20% and 50%
  const y20 = toY(20);
  const y50 = toY(50);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Goal Drift — Bostrom Detector</span>
        <span className={pillClass} style={{ fontSize: '0.7rem' }}>
          {result.label}
        </span>
      </div>

      {/* Stability graph */}
      <div style={{ padding: '0.75rem 1.25rem 0' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.375rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Goal drift % over time (flat = good, spikes = rogue re-optimisation)</span>
          <span>{snaps.length} snapshots</span>
        </div>
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
            {/* Threshold fill zones */}
            <rect x={padding.left} y={padding.top} width={innerW} height={y20 - padding.top}
              fill="rgba(220,20,20,0.06)"/>
            <rect x={padding.left} y={y20} width={innerW} height={y50 - y20}
              fill="rgba(180,83,9,0.05)"/>

            {/* Threshold lines */}
            <line x1={padding.left} y1={y20} x2={W - padding.right} y2={y20}
              stroke="var(--amber)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6"/>
            <line x1={padding.left} y1={y50} x2={W - padding.right} y2={y50}
              stroke="var(--red)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6"/>

            {/* Threshold labels — inside right padding */}
            <text x={W - padding.right + 2} y={y20 + 3} fontSize="8" fill="var(--amber)" opacity="0.8">20%</text>
            <text x={W - padding.right + 2} y={y50 + 3} fontSize="8" fill="var(--red)"   opacity="0.8">50%</text>

            {/* Area fill */}
            {snaps.length > 1 && (
              <polygon points={areaPoints} fill={color} opacity="0.12"/>
            )}

            {/* Line */}
            {snaps.length > 1 && (
              <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            )}

            {/* Data points */}
            {snaps.map((s, i) => (
              <circle key={i} cx={toX(i)} cy={toY(s.driftPct)} r="3"
                fill={statusColor(s.status)} stroke="white" strokeWidth="1"/>
            ))}
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0, borderTop: '1px solid var(--border)',
        marginTop: '0.5rem',
      }}>
        {[
          { label: 'Current drift', value: `${result.currentDriftPct}%`, color },
          { label: 'Max drift',     value: `${result.maxDriftPct}%`,     color: result.maxDriftPct >= 50 ? 'var(--red)' : result.maxDriftPct >= 20 ? 'var(--amber)' : 'var(--green)' },
          { label: 'Avg drift',     value: `${result.avgDriftPct}%`,     color: 'var(--text)' },
        ].map((stat, i, arr) => (
          <div key={stat.label} style={{
            padding: '0.625rem 1rem', textAlign: 'center',
            borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Baseline */}
      {result.baseline && (
        <div style={{
          padding: '0.625rem 1.25rem',
          borderTop: '1px solid var(--border)',
          fontSize: '0.7rem', color: 'var(--muted)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Baseline goal: </span>
          <span className="mono" style={{ fontSize: '0.68rem' }}>
            {result.baseline.length > 120 ? result.baseline.slice(0, 120) + '…' : result.baseline}
          </span>
        </div>
      )}

      {/* Alert for high drift */}
      {result.status !== 'stable' && (
        <div style={{
          padding: '0.75rem 1.25rem',
          background: result.status === 'drift' ? 'var(--red-light)' : 'var(--amber-bg)',
          borderTop: `1px solid ${result.status === 'drift' ? 'var(--red-mid)' : 'rgba(180,83,9,0.2)'}`,
          fontSize: '0.75rem',
          color: result.status === 'drift' ? 'var(--red)' : 'var(--amber)',
        }}>
          {result.status === 'drift'
            ? '⚡ Goal drift exceeds 50% — agent may be re-interpreting its objective. This is the Bostrom maximiser signal.'
            : '⚠ Goal drift between 20–50% — monitor for further divergence from original objective.'}
        </div>
      )}
    </div>
  );
}
