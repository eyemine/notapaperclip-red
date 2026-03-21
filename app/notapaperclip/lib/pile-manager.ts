'use client';

import { useState } from 'react';

export function usePileManager() {
  const [interactionCount, setInteractionCount] = useState(0);

  const cleanupPile = (currentClips: any[]) => {
    // Remove oldest 10 clips, keep newest 10
    const cleanedClips = currentClips.slice(-10);
    
    // Reset interaction count
    setInteractionCount(0);
    
    return cleanedClips;
  };

  const incrementInteraction = () => {
    setInteractionCount(prev => prev + 1);
  };

  return { 
    cleanupPile, 
    interactionCount, 
    incrementInteraction 
  };
}
