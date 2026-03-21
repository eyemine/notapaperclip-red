'use client';

import { useEffect, useState, useCallback } from 'react';

export function useInteractionTracker() {
  const [interactionCount, setInteractionCount] = useState(0);
  const [paperclipRate, setPaperclipRate] = useState(100);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const resetFallingRate = useCallback(() => {
    setInteractionCount(prev => prev + 1);
    setPaperclipRate(Math.max(5, 100 - Math.floor(interactionCount * 2))); // Decrease rate with interactions
    setLastInteraction(Date.now());
    
    // Log to GlassBox
    fetch('/api/interaction/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        interactionCount: interactionCount + 1,
        paperclipRate: Math.max(5, 100 - Math.floor(interactionCount * 2)),
        timestamp: Date.now()
      })
    }).catch(() => {}); // Silent fail for logging
  }, [interactionCount, sessionId]);

  useEffect(() => {
    const handleInteraction = () => {
      resetFallingRate();
    };

    const events = ['click', 'scroll', 'keydown', 'input', 'navigation'];
    events.forEach(event => {
      if (event === 'navigation') {
        window.addEventListener('popstate', handleInteraction);
      } else {
        window.addEventListener(event, handleInteraction, { passive: true });
      }
    });

    return () => {
      events.forEach(event => {
        if (event === 'navigation') {
          window.removeEventListener('popstate', handleInteraction);
        } else {
          window.removeEventListener(event, handleInteraction);
        }
      });
    };
  }, [resetFallingRate]);

  return { 
    interactionCount, 
    paperclipRate, 
    lastInteraction, 
    resetFallingRate,
    sessionId 
  };
}
