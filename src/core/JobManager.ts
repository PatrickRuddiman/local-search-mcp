import { log } from './Logger.js';
import { ProgressManager } from './ProgressManager.js';

export interface Job {
  id: string;
  type: 'fetch_repo' | 'fetch_file' | 'index_directory';
  status: 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  metadata: {
    [key: string]: any;
  };
}

export interface JobProgress {
  id: string;
  progress: number;
  message?: string;
  metadata?: any;
}

export class JobManager {
  private jobs: Map<string, Job> = new Map();
  private statusCache: Map<string, Job> = new Map();
  private progressManager: ProgressManager;
  private static instance: JobManager;

  private constructor() {
    this.progressManager = ProgressManager.getInstance();
    log.debug('JobManager initialized');
  }

  static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }

  /**
   * Create a new job
   */
  createJob(type: Job['type'], metadata: any = {}): string {
    const id = this.generateJobId();
    const job: Job = {
      id,
      type,
      status: 'running',
      progress: 0,
      startTime: new Date(),
      metadata
    };

    this.jobs.set(id, job);
    log.info(`Job created: ${id}`, { type, metadata });

    return id;
  }

  updateProgress(id: string, progress: number, message?: string, metadata?: any): void {
    const job = this.jobs.get(id);
    if (!job) {
      log.warn(`Attempted to update non-existent job: ${id}`);
      return;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    if (metadata) {
      job.metadata = { ...job.metadata, ...metadata };
    }

    // Update cache for fast retrieval during heavy operations
    this.statusCache.set(id, { ...job });

    // Emit progress event (non-blocking)
    this.progressManager.updateProgress(id, progress, message, metadata);

    log.debug(`Job progress updated: ${id}`, { progress, message });
  }

  completeJob(id: string, result: any): void {
    const job = this.jobs.get(id);
    if (!job) {
      log.warn(`Attempted to complete non-existent job: ${id}`);
      return;
    }

    job.status = 'completed';
    job.progress = 100;
    job.endTime = new Date();
    job.result = result;

    // Update cache
    this.statusCache.set(id, { ...job });

    // Emit completion event (non-blocking)
    this.progressManager.completeJob(id, result);

    log.info(`Job completed: ${id}`, {
      duration: job.endTime.getTime() - job.startTime.getTime(),
      resultKeys: typeof result === 'object' ? Object.keys(result) : 'primitive'
    });
  }

  failJob(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job) {
      log.warn(`Attempted to fail non-existent job: ${id}`);
      return;
    }

    job.status = 'failed';
    job.endTime = new Date();
    job.error = error;

    // Update cache
    this.statusCache.set(id, { ...job });

    // Emit failure event (non-blocking)
    this.progressManager.failJob(id, error);

    log.error(`Job failed: ${id}`, new Error(error));
  }

  /**
   * Get job status (async with immediate response to prevent blocking)
   */
  async getJobAsync(id: string): Promise<Job | undefined> {
    return new Promise(resolve => {
      setTimeout(() => {
        // First try cache for faster response during heavy processing
        const cached = this.statusCache.get(id);
        if (cached) {
          resolve(cached);
          return;
        }

        // Fallback to main job store
        resolve(this.jobs.get(id));
      }, 0);
    });
  }

  /**
   * Get job status (synchronous fallback - kept for backward compatibility)
   */
  getJob(id: string): Job | undefined {
    // Use cache for immediate response to prevent blocking
    const cached = this.statusCache.get(id);
    if (cached) {
      return cached;
    }

    // Quick lookup without iteration
    return this.jobs.get(id);
  }

  /**
   * Get job status from cache only (fastest, for high-load scenarios)
   */
  getJobCached(id: string): Job | undefined {
    return this.statusCache.get(id);
  }

  /**
   * Get all jobs (async to prevent blocking)
   */
  async getAllJobsAsync(): Promise<Job[]> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(Array.from(this.jobs.values()));
      }, 0);
    });
  }

  /**
   * Get all jobs (synchronous fallback)
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get active (running) jobs (async to prevent blocking)
   */
  async getActiveJobsAsync(): Promise<Job[]> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(Array.from(this.jobs.values()).filter(job => job.status === 'running'));
      }, 0);
    });
  }

  /**
   * Get active (running) jobs (synchronous fallback)
   */
  getActiveJobs(): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'running');
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [id, job] of this.jobs.entries()) {
      if (job.status !== 'running' && job.endTime && job.endTime < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }

  /**
   * Cancel a running job
   */
  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'failed';
    job.endTime = new Date();
    job.error = 'Job cancelled by user';

    log.info(`Job cancelled: ${id}`);

    return true;
  }

  /**
   * Get job statistics
   */
  getStatistics(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    averageDuration: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const completed = jobs.filter(j => j.status === 'completed');
    const averageDuration = completed.length > 0
      ? completed.reduce((sum, j) => sum + (j.endTime!.getTime() - j.startTime.getTime()), 0) / completed.length
      : 0;

    return {
      total: jobs.length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: completed.length,
      failed: jobs.filter(j => j.status === 'failed').length,
      averageDuration
    };
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    return `job_${timestamp}_${random}`;
  }
}

export default JobManager;
