'use client';

import { useAccumulationTracker } from '../lib/accumulation-tracker';

export default function GroundPile() {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { groundClips } = useAccumulationTracker(sessionId);

  return (
    <div className="ground-pile">
      {groundClips.map((clip, index) => (
        <img
          key={clip.id}
          src={`/${clip.type}.svg`}
          alt=""
          className="ground-clip"
          style={{
            transform: `translateX(${clip.left}vw) translateY(-${Math.floor(index / 10) * 3}px) rotate(${(index * 37) % 360}deg)`,
            height: `${clip.size}px`,
            width: `${clip.size * 0.5}px`,
            opacity: clip.opacity,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}
