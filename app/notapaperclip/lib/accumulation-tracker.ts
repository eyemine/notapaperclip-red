'use client';

import { useEffect, useState } from 'react';

interface FallingClip {
  id: number;
  startY: number;
  currentY: number;
  opacity: number;
  speed: number;
  left: number;
  size: number;
  type: string;
}

interface GroundClip {
  id: number;
  timestamp: number;
  left: number;
  size: number;
  type: string;
  opacity: number;
  layerIndex: number;
}

export function useAccumulationTracker(sessionId: string) {
  const [fallingClips, setFallingClips] = useState<FallingClip[]>([]);
  const [groundClips, setGroundClips] = useState<GroundClip[]>([]);

  const addFallingClip = (clip: any) => {
    const newFallingClip: FallingClip = {
      id: clip.id,
      startY: -100,
      currentY: -100,
      opacity: 0.4,
      speed: (window.innerHeight + 100) / (clip.duration * 1000), // pixels per ms
      left: clip.left,
      size: clip.size,
      type: clip.type,
    };
    setFallingClips(prev => [...prev.slice(-2), newFallingClip]); // Max 3 falling
  };

  const updateFallingClips = (deltaTime: number) => {
    setFallingClips(prev => {
      const updated = prev.map(clip => ({
        ...clip,
        currentY: clip.currentY + (clip.speed * deltaTime),
        opacity: clip.currentY > window.innerHeight - 400 ? 0.4 * (1 - (clip.currentY - (window.innerHeight - 400)) / 200) : 0.4,
      }));

      // Check for clips reaching bottom
      const reachedBottom = updated.filter(clip => clip.currentY >= window.innerHeight - 200);
      const stillFalling = updated.filter(clip => clip.currentY < window.innerHeight - 200);

      // Transfer to ground pile
      reachedBottom.forEach(clip => {
        transferToGround(clip);
      });

      return stillFalling;
    });
  };

  const transferToGround = (fallingClip: FallingClip) => {
    const groundClip: GroundClip = {
      id: fallingClip.id,
      timestamp: Date.now(),
      left: fallingClip.left,
      size: fallingClip.size,
      type: fallingClip.type,
      opacity: 0.3 + Math.min(0.3, groundClips.length * 0.015), // Age-based opacity
      layerIndex: groundClips.length,
    };

    setGroundClips(prev => {
      const updated = [...prev, groundClip];
      // Keep max 20, remove oldest
      if (updated.length >= 20) {
        return updated.slice(-20);
      }
      return updated;
    });

    // Log to GlassBox
    fetch('/api/paperclip/accumulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        clipId: fallingClip.id,
        timestamp: Date.now(),
        groundCount: groundClips.length + 1,
      })
    }).catch(() => {}); // Silent fail
  };

  const resetFallingClips = () => {
    setFallingClips([]); // Reset only falling, ground persists
  };

  // Animation loop
  useEffect(() => {
    let lastTime = Date.now();
    const animationFrame = () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      updateFallingClips(deltaTime);
      requestAnimationFrame(animationFrame);
    };

    const frameId = requestAnimationFrame(animationFrame);
    return () => cancelAnimationFrame(frameId);
  }, [groundClips.length]);

  return {
    fallingClips,
    groundClips,
    addFallingClip,
    resetFallingClips,
  };
}
