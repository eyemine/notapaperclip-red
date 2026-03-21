'use client';

import { useInteractionTracker } from '../lib/interaction-tracker';

export default function InteractionCounter() {
  const { interactionCount, paperclipRate, lastInteraction } = useInteractionTracker();

  return (
    <div className="interaction-counter" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'monospace',
      zIndex: 1000,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      <div style={{ marginBottom: '4px' }}>
        Interaction Count: <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{interactionCount}</span>
      </div>
      <div style={{ marginBottom: '4px' }}>
        Paperclip Rate: <span style={{ 
          color: paperclipRate > 50 ? '#ff6b6b' : paperclipRate > 20 ? '#ffd93d' : '#6bcf7f',
          fontWeight: 'bold' 
        }}>{paperclipRate}%</span>
      </div>
      {interactionCount > 0 && (
        <div style={{ 
          fontSize: '11px', 
          color: '#888',
          animation: 'pulse 2s infinite'
        }}>
          ✓ Rate Reset
        </div>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
