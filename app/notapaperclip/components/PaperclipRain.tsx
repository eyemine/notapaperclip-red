'use client';

import { useEffect, useState, useRef } from 'react';

interface Paperclip {
  id: number;
  left: number;
  duration: number;
  size: number;
  type: string;
}

export default function PaperclipRain() {
  const [fallingClips, setFallingClips] = useState<Paperclip[]>([]);
  const [releaseRate, setReleaseRate] = useState(2000); // Initial rate: 2 seconds
  const [clipCount, setClipCount] = useState(0);
  const lastInteraction = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  // Exponential increase to max 80 clips
  const calculateNextRate = () => {
    const timeSinceInteraction = Date.now() - lastInteraction.current;
    const exponentialFactor = Math.min(80, 1 + (timeSinceInteraction / 10000) * 2); // Grow exponentially
    return Math.max(200, 2000 / exponentialFactor); // Faster rate = smaller interval
  };

  useEffect(() => {
    const types = ['paperclip-falling', 'paperclip-closed', 'paperclip-tight'];
    
    // Start with 1 paperclip
    const initialClip = {
      id: Date.now(),
      left: 50,
      duration: 2,
      size: 45,
      type: 'paperclip-falling',
    };
    setFallingClips([initialClip]);

    // Add clips with exponential rate
    const addClip = () => {
      setFallingClips(prev => {
        if (prev.length >= 80) return prev; // Max 80 clips
        const newClip = {
          id: Date.now(),
          left: Math.random() * 100,
          duration: 2 + Math.random() * 1,
          size: 37.5 + Math.random() * 22.5,
          type: types[Math.floor(Math.random() * types.length)],
        };
        setClipCount(prev => prev + 1);
        return [...prev, newClip];
      });

      // Schedule next clip with exponential rate
      const nextRate = calculateNextRate();
      intervalRef.current = setTimeout(addClip, nextRate);
    };

    // Start the exponential release
    intervalRef.current = setTimeout(addClip, releaseRate);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  // User interaction resets rate
  useEffect(() => {
    const handleInteraction = () => {
      lastInteraction.current = Date.now();
      setReleaseRate(2000); // Reset to original rate
      
      // Clear and restart with reset rate
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      intervalRef.current = setTimeout(() => {
        setFallingClips(prev => {
          if (prev.length >= 80) return prev;
          const types = ['paperclip-falling', 'paperclip-closed', 'paperclip-tight'];
          const newClip = {
            id: Date.now(),
            left: Math.random() * 100,
            duration: 2 + Math.random() * 1,
            size: 37.5 + Math.random() * 22.5,
            type: types[Math.floor(Math.random() * types.length)],
          };
          setClipCount(prev => prev + 1);
          return [...prev, newClip];
        });
      }, 2000);
    };

    const events = ['click', 'scroll', 'keydown', 'mousemove'];
    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, []);

  return (
    <div className="paperclip-rain">
      {fallingClips.map(clip => (
        <img
          key={clip.id}
          src={`/${clip.type}.svg`}
          alt=""
          className="paperclip falling"
          style={{
            transform: `translateX(${clip.left}vw)`,
            height: `${clip.size}px`,
            width: `${clip.size * 0.5}px`,
            animationDuration: `${clip.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
