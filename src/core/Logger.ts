import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logFile: string;
  private writeStream: fs.WriteStream | null = null;
  private consoleEnabled = true;
  private fileEnabled = true;

  private constructor() {
    this.logFile = path.join(process.cwd(), 'local-search-mcp.log');

    // Initialize file stream
    try {
      this.writeStream = fs.createWriteStream(this.logFile, {
        flags: 'a', // append mode
        encoding: 'utf8'
      });

      this.writeStream.on('error', (error) => {
        console.error('[LOGGER ERROR] Failed to write to log file:', error.message);
        this.fileEnabled = false;
      });
    } catch (error: any) {
      console.error('[LOGGER ERROR] Failed to create log file stream:', error.message);
      this.fileEnabled = false;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLogEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        } as any
      })
    };

    return JSON.stringify(entry, null, 0); // Compact JSON for log files
  }

  private formatConsoleEntry(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level}:`;
    return `${prefix} ${message}`;
  }

  private writeToFile(message: string): void {
    if (!this.fileEnabled || !this.writeStream) return;

    try {
      this.writeStream.write(message + '\n');
    } catch (error: any) {
      console.error('[LOGGER ERROR] Write to file failed:', error.message);
    }
  }

  private writeToConsole(level: LogLevel, message: string): void {
    if (!this.consoleEnabled) return;

    const formattedMessage = this.formatConsoleEntry(level, message);

    switch (level) {
      case LogLevel.ERROR:
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`); // Red
        break;
      case LogLevel.WARN:
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`); // Yellow
        break;
      case LogLevel.INFO:
        console.info(`\x1b[36m${formattedMessage}\x1b[0m`); // Cyan
        break;
      case LogLevel.DEBUG:
        console.debug(`\x1b[35m${formattedMessage}\x1b[0m`); // Magenta
        break;
      default:
        console.log(formattedMessage);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    const logMessage = this.formatLogEntry(LogLevel.DEBUG, message, context);
    this.writeToFile(logMessage);
    this.writeToConsole(LogLevel.DEBUG, message);
  }

  info(message: string, context?: Record<string, any>): void {
    const logMessage = this.formatLogEntry(LogLevel.INFO, message, context);
    this.writeToFile(logMessage);
    this.writeToConsole(LogLevel.INFO, message);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    const logMessage = this.formatLogEntry(LogLevel.WARN, message, context, error);
    this.writeToFile(logMessage);
    this.writeToConsole(LogLevel.WARN, message);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const logMessage = this.formatLogEntry(LogLevel.ERROR, message, context, error);
    this.writeToFile(logMessage);
    this.writeToConsole(LogLevel.ERROR, message);
  }

  // Performance measurement helper
  time(label: string): () => void {
    const startTime = process.hrtime.bigint();
    this.debug(`Started timing: ${label}`);

    return () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      this.info(`Completed timing: ${label}`, { duration: `${durationMs.toFixed(2)}ms` });
      return durationMs;
    };
  }

  // Utility methods
  enableConsole(enabled = true): void {
    this.consoleEnabled = enabled;
  }

  enableFile(enabled = true): void {
    this.fileEnabled = enabled;
  }

  getLogFile(): string {
    return this.logFile;
  }

  // Check if log file exists and get stats
  getLogStats(): { exists: boolean; size?: number; modified?: Date } {
    try {
      const stats = fs.statSync(this.logFile);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime
      };
    } catch {
      return { exists: false };
    }
  }

  // Close the file stream (for cleanup)
  close(): void {
    if (this.writeStream) {
      try {
        this.writeStream.end();
        this.writeStream = null;
      } catch (error: any) {
        console.error('[LOGGER ERROR] Failed to close log stream:', error.message);
      }
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const log = {
  debug: (message: string, context?: Record<string, any>) => logger.debug(message, context),
  info: (message: string, context?: Record<string, any>) => logger.info(message, context),
  warn: (message: string, context?: Record<string, any>, error?: Error) => logger.warn(message, context, error),
  error: (message: string, error?: Error, context?: Record<string, any>) => logger.error(message, error, context),
  time: (label: string) => logger.time(label)
};
