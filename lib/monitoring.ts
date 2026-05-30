/**
 * Basic monitoring and error tracking for the oracle
 * Provides centralized logging and performance metrics
 */

interface ErrorEvent {
  timestamp: number;
  error: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private errors: ErrorEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private readonly maxErrors = 100;
  private readonly maxMetrics = 200;

  // Log an error event
  logError(error: Error | string, context: string, severity: ErrorEvent['severity'] = 'medium', metadata?: Record<string, any>) {
    const errorEvent: ErrorEvent = {
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : error,
      context,
      severity,
      metadata,
    };

    this.errors.push(errorEvent);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console
    console.error(`[${severity.toUpperCase()}] ${context}:`, errorEvent.error, metadata);

    // Send to external monitoring (if configured)
    this.sendToMonitoring(errorEvent);
  }

  // Log a performance metric
  logMetric(operation: string, duration: number, success: boolean, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      metadata,
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations
    if (duration > 5000) {
      console.warn(`[SLOW] ${operation} took ${duration}ms`, metadata);
    }
  }

  // Measure execution time of a function
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } catch (error) {
      this.logError(error as Error, operation, 'medium', metadata);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.logMetric(operation, duration, success, metadata);
    }
  }

  // Get recent errors
  getRecentErrors(limit: number = 20): ErrorEvent[] {
    return this.errors.slice(-limit);
  }

  // Get recent metrics
  getRecentMetrics(limit: number = 50): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  // Get error summary
  getErrorSummary(): { total: number; bySeverity: Record<string, number>; byContext: Record<string, number> } {
    const bySeverity: Record<string, number> = {};
    const byContext: Record<string, number> = {};

    for (const error of this.errors) {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byContext[error.context] = (byContext[error.context] || 0) + 1;
    }

    return {
      total: this.errors.length,
      bySeverity,
      byContext,
    };
  }

  // Get performance summary
  getPerformanceSummary(): { 
    total: number; 
    averageDuration: number; 
    successRate: number;
    slowestOperations: Array<{ operation: string; duration: number; timestamp: number }>;
  } {
    if (this.metrics.length === 0) {
      return {
        total: 0,
        averageDuration: 0,
        successRate: 0,
        slowestOperations: [],
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = this.metrics.filter(m => m.success).length;
    const slowest = this.metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(m => ({ operation: m.operation, duration: m.duration, timestamp: m.timestamp }));

    return {
      total: this.metrics.length,
      averageDuration: totalDuration / this.metrics.length,
      successRate: (successCount / this.metrics.length) * 100,
      slowestOperations: slowest,
    };
  }

  // Send to external monitoring service
  private sendToMonitoring(errorEvent: ErrorEvent) {
    // Google Analytics (if available)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: errorEvent.error,
        fatal: errorEvent.severity === 'critical',
      });
    }

    // Could add other monitoring services here (Sentry, LogRocket, etc.)
  }

  // Clear all data
  clear() {
    this.errors = [];
    this.metrics = [];
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

// Decorator for automatic error tracking
export function trackErrors(context: string, severity: ErrorEvent['severity'] = 'medium') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        monitoring.logError(error as Error, context, severity, { method: propertyName, args });
        throw error;
      }
    };

    return descriptor;
  };
}

// Extend Window interface for Google Analytics
declare global {
  interface Window {
    gtag?: (command: string, action: string, options?: any) => void;
  }
}
