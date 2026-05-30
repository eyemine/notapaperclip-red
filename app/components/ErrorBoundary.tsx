'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error for monitoring
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Send to monitoring service (if configured)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
      });
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return (
    <div style={{
      padding: '2rem',
      margin: '1rem',
      border: '1px solid #ff6b6b',
      borderRadius: '8px',
      backgroundColor: '#ffe0e0',
      color: '#d63031',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>
        Something went wrong
      </h3>
      
      {error && (
        <details style={{ marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
            Error details
          </summary>
          <pre style={{
            fontSize: '0.85rem',
            backgroundColor: '#fff',
            padding: '0.5rem',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '200px',
          }}>
            {error.stack || error.message}
          </pre>
        </details>
      )}
      
      <button
        onClick={retry}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#d63031',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

export default ErrorBoundary;
