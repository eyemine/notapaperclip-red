'use client';

import type { AlignmentResult, AlignmentComponent } from '@/app/services/alignment-calculator';

function levelColor(level: AlignmentResult['level']) {
  if (level === 'green') return 'var(--green)';
  if (level === 'amber') return 'var(--amber)';
  return 'var(--red)';
}

function levelBg(level: AlignmentResult['level']) {
  if (level === 'green') return 'var(--green-bg)';
  if (level === 'amber') return 'var(--amber-bg)';
  return 'var(--red-light)';
}

function statusPill(status: AlignmentComponent['status']) {
  if (status === 'good') return 'pill pill-green';
  if (status === 'warn') return 'pill pill-amber';
  return 'pill pill-red';
}

function statusIcon(status: AlignmentComponent['status']) {
  if (status === 'good') return '✓';
  if (status === 'warn') return '⚠';
  return '✕';
}

interface Props {
  result:  AlignmentResult;
  compact?: boolean;
}

export default function AlignmentScore({ result, compact = false }: Props) {
  const color = levelColor(result.level);
  const bg    = levelBg(result.level);

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        background: bg, border: `1px solid ${color}`,
        borderRadius: 'var(--radius)', padding: '0.3rem 0.75rem',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          {result.level === 'green' && <path d="m9 12 2 2 4-4"/>}
        </svg>
        <span style={{ fontWeight: 700, color, fontSize: '0.85rem' }}>
          {result.alignmentScore}/100
        </span>
        <span style={{ fontSize: '0.75rem', color, opacity: 0.85 }}>{result.label}</span>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Score header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        borderLeft: `4px solid ${color}`,
        background: bg,
      }}>
        {/* Dial */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="6"/>
            <circle cx="36" cy="36" r="30" fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 30 * result.alignmentScore / 100} ${2 * Math.PI * 30}`}
              strokeDashoffset={2 * Math.PI * 30 * 0.25}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>
              {result.alignmentScore}
            </span>
            <span style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              /100
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>
            {result.label}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            Alignment Score · computed {new Date(result.computedAt).toLocaleTimeString('en-AU')}
          </div>
          {result.level === 'red' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: '0.4rem', fontWeight: 600 }}>
              ⚠ Potential paperclip maximiser risk — review agent behaviour
            </div>
          )}
        </div>
      </div>

      {/* Component breakdown */}
      <div className="card-header" style={{ fontSize: '0.7rem' }}>Score Breakdown</div>
      {result.components.map((c, i, arr) => (
        <div key={c.name} className="data-row" style={{
          borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          gap: '0.75rem', alignItems: 'flex-start',
        }}>
          <span className={statusPill(c.status)} style={{ marginTop: '0.1rem', flexShrink: 0 }}>
            {statusIcon(c.status)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>
                {c.rawScore}/100
                <span style={{ fontSize: '0.6rem', fontWeight: 400, marginLeft: '0.25rem' }}>
                  ×{Math.round(c.weight * 100)}%
                  {' = '}
                  <strong style={{ color: 'var(--text)' }}>{c.weightedScore}pts</strong>
                </span>
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, marginTop: '0.35rem', marginBottom: '0.35rem', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${c.rawScore}%`,
                background: c.status === 'good' ? 'var(--green)' : c.status === 'warn' ? 'var(--amber)' : 'var(--red)',
                borderRadius: 99,
                transition: 'width 0.5s ease',
              }}/>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.5 }}>{c.detail}</div>
          </div>
        </div>
      ))}

      {/* CTA for low scores */}
      {result.level !== 'green' && (
        <div style={{
          padding: '0.875rem 1.25rem',
          background: 'var(--red-light)',
          borderTop: '1px solid var(--red-mid)',
          fontSize: '0.75rem',
          color: 'var(--red)',
          display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span>
            Low alignment score? Deploy HITL gates, budget modules, and swarm attestations via{' '}
            <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--red)', fontWeight: 700, textDecoration: 'none' }}>
              GhostAgent.ninja ↗
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
