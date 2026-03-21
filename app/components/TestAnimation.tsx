'use client';

import { useState, useEffect } from 'react';

export default function TestAnimation() {
  const [count, setCount] = useState(0);

  // Simple counter
  useEffect(() => {
    console.log('Setting up interval...');
    const timer = setInterval(() => {
      console.log('Interval tick');
      setCount(c => c + 1);
    }, 1000);
    
    return () => {
      console.log('Cleaning up interval');
      clearInterval(timer);
    };
  }, []);

  // Click handler
  useEffect(() => {
    const handleClick = () => {
      console.log('CLICKED!');
    };
    
    console.log('Adding click listener');
    window.addEventListener('click', handleClick);
    
    return () => {
      console.log('Removing click listener');
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '20px',
      background: 'red',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: 1000,
      border: '2px solid white'
    }}>
      <div>TEST BOX</div>
      <div>Count: {count}</div>
      <div>Time: {new Date().toLocaleTimeString()}</div>
      <div>Click anywhere!</div>
    </div>
  );
}
