'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateRate, resetRate } from '../lib/rate-manager';

interface Paperclip {
  id: number;
  left: number;
  size: number;
  variant: 'fall' | 'fall-anti' | 'fall-mirror' | 'fall-mirror-anti';
}

const VARIANTS: Paperclip['variant'][] = ['fall', 'fall-anti', 'fall-mirror', 'fall-mirror-anti'];
const MAX_CLIPS = 100;

export default function PaperclipRain() {
  const [clips, setClips] = useState<Paperclip[]>([]);
  const enabledRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // scheduleNext lives in a ref so it is never stale
  const scheduleNextRef = useRef<() => void>(() => {});

  scheduleNextRef.current = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabledRef.current) return;

    const delay = calculateRate();

    timerRef.current = setTimeout(() => {
      setClips(prev => {
        if (prev.length >= MAX_CLIPS) return prev;
        return [...prev, {
          id: Date.now() + Math.random(),
          left: Math.random() * 100,
          size: 37.5 + Math.random() * 15,
          variant: VARIANTS[Math.floor(Math.random() * VARIANTS.length)],
        }];
      });
      scheduleNextRef.current(); // always calls the latest version
    }, delay);
  };

  // Boot once
  useEffect(() => {
    scheduleNextRef.current();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Interaction reset
  useEffect(() => {
    const handle = () => {
      resetRate();
      scheduleNextRef.current();
    };
    const events = ['click', 'scroll', 'input', 'keydown'];
    events.forEach(e => window.addEventListener(e, handle, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, handle));
  }, []);

  // Toggle
  useEffect(() => {
    (window as any).togglePaperclipAnimation = () => {
      enabledRef.current = !enabledRef.current;
      if (enabledRef.current) {
        scheduleNextRef.current();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Remove clip from DOM after its 4s animation ends
  const removeClip = (id: number) => {
    setClips(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="paperclip-rain">
      {clips.map(clip => (
        <img
          key={clip.id}
          src="/paperclip-falling.svg"
          alt=""
          className={`paperclip ${clip.variant}`}
          onAnimationEnd={() => removeClip(clip.id)}
          style={{
            left: `${clip.left}%`,
            width: `${clip.size}px`,
            height: `${clip.size * 0.5}px`,
          }}
        />
      ))}
    </div>
  );
}
