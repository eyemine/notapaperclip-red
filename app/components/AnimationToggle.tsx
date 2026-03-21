'use client';

import { useState, useEffect } from 'react';

export default function AnimationToggle() {
  const [isEnabled, setIsEnabled] = useState(true);

  const toggleAnimation = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    
    // Call the global toggle function
    if ((window as any).togglePaperclipAnimation) {
      (window as any).togglePaperclipAnimation();
    }
  };

  // Sync with global state
  useEffect(() => {
    // Check initial state
    const checkState = () => {
      // This will be updated by PaperclipRain component
    };
    checkState();
  }, []);

  return (
    <button
      onClick={toggleAnimation}
      style={{
        position: 'fixed',
        top: '90px', // Below navbar (72px + some margin)
        right: '20px',
        width: '120px', // Fixed width
        padding: '6px 8px',
        borderRadius: '4px',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
        color: 'var(--muted)',
        fontSize: '8pt',
        fontWeight: '500',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'all 0.2s ease',
        fontFamily: 'Inter, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: 'left',
        justifyContent: 'flex-start'
      }}
      title={isEnabled ? 'Stop Deluge' : 'Go Deluge'}
    >
      {isEnabled ? 'DELUGE | STOP' : 'DELUGE | START'}
    </button>
  );
}
