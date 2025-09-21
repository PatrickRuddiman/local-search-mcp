import { EventEmitter } from 'events';
import { log } from './Logger.js';

export interface ProgressEvent {
  jobId: string;
  progress: number; // 0-100
  message?: string;
  metadata?: any;
  timestamp: Date;
}

export interface ProgressSubscription {
  jobId: string;
  callback: (event: ProgressEvent) => void;
}

/**
 * Event-driven progress monitoring system (2025 MCP best practices)
 * Uses EventEmitter patterns for real-time, non-blocking progress updates
 */
export class ProgressManager extends EventEmitter {
  private static instance: ProgressManager;
  private subscriptions: Map<string, Set<(event: ProgressEvent) => void>> = new Map();
  private progressCache: Map<string, ProgressEvent> = new Map();

  private constructor() {
    super();
    log.debug('ProgressManager initialized with EventEmitter pattern');
  }

  static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  /**
   * Subscribe to progress updates for a specific job
   * @param jobId Job identifier
   * @param callback Progress update callback
   * @returns Unsubscribe function
   */
  subscribe(jobId: string, callback: (event: ProgressEvent) => void): () => void {
    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, new Set());
    }
    
    this.subscriptions.get(jobId)!.add(callback);
    
    // Send cached progress if available (immediate response)
    const cachedProgress = this.progressCache.get(jobId);
    if (cachedProgress) {
      setImmediate(() => callback(cachedProgress));
    }
    
    log.debug('Progress subscription added', { jobId });
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscriptions.get(jobId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscriptions.delete(jobId);
        }
      }
      log.debug('Progress subscription removed', { jobId });
    };
  }

  /**
   * Emit progress update (non-blocking)
   * @param jobId Job identifier
   * @param progress Progress percentage (0-100)
   * @param message Optional progress message
   * @param metadata Optional metadata
   */
  updateProgress(jobId: string, progress: number, message?: string, metadata?: any): void {
    const event: ProgressEvent = {
      jobId,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      metadata,
      timestamp: new Date()
    };

    // Cache for immediate response to new subscribers
    this.progressCache.set(jobId, event);

    // Emit using setImmediate to prevent blocking (2025 best practice)
    setImmediate(() => {
      // Emit to specific job subscribers
      const subscribers = this.subscriptions.get(jobId);
      if (subscribers && subscribers.size > 0) {
        subscribers.forEach(callback => {
          try {
            callback(event);
          } catch (error: any) {
            log.error('Progress callback error', error, { jobId });
          }
        });
      }

      // Emit global event
      this.emit('progress', event);
      this.emit(`progress:${jobId}`, event);
    });

    log.debug('Progress updated', { 
      jobId, 
      progress, 
      message,
      subscriberCount: this.subscriptions.get(jobId)?.size || 0
    });
  }

  /**
   * Mark job as completed and clean up
   * @param jobId Job identifier
   * @param result Optional completion result
   */
  completeJob(jobId: string, result?: any): void {
    this.updateProgress(jobId, 100, 'Completed', { result });
    
    // Clean up after a delay to allow final notifications
    setTimeout(() => {
      this.subscriptions.delete(jobId);
      this.progressCache.delete(jobId);
      log.debug('Progress tracking cleaned up', { jobId });
    }, 5000); // 5 second delay for cleanup
  }

  /**
   * Mark job as failed and clean up
   * @param jobId Job identifier
   * @param error Error message or object
   */
  failJob(jobId: string, error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error;
    this.updateProgress(jobId, 0, `Failed: ${errorMessage}`, { error: errorMessage });
    
    // Clean up after a delay
    setTimeout(() => {
      this.subscriptions.delete(jobId);
      this.progressCache.delete(jobId);
      log.debug('Progress tracking cleaned up (failed job)', { jobId });
    }, 5000);
  }

  /**
   * Get current progress for a job (immediate, cached response)
   * @param jobId Job identifier
   * @returns Current progress event or null
   */
  getCurrentProgress(jobId: string): ProgressEvent | null {
    return this.progressCache.get(jobId) || null;
  }

  /**
   * Get all active progress tracking
   * @returns Array of active progress events
   */
  getAllActiveProgress(): ProgressEvent[] {
    return Array.from(this.progressCache.values());
  }

  /**
   * Clean up old completed jobs from cache
   * @param maxAge Maximum age in milliseconds (default: 1 hour)
   */
  cleanup(maxAge: number = 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [jobId, event] of this.progressCache.entries()) {
      if (event.timestamp < cutoff && event.progress === 100) {
        this.progressCache.delete(jobId);
        this.subscriptions.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`Cleaned up ${cleaned} old progress entries`);
    }

    return cleaned;
  }

  /**
   * Get statistics about progress tracking
   */
  getStatistics(): {
    activeJobs: number;
    totalSubscriptions: number;
    cacheSize: number;
  } {
    const totalSubscriptions = Array.from(this.subscriptions.values())
      .reduce((sum, subscribers) => sum + subscribers.size, 0);

    return {
      activeJobs: this.subscriptions.size,
      totalSubscriptions,
      cacheSize: this.progressCache.size
    };
  }
}

export default ProgressManager;
