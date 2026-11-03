export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  traceId?: string;
  userId?: string;
  businessId?: string;
  module?: string;
  [key: string]: unknown;
}

export class AppLogger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private format(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      module: this.module,
      message,
      ...context,
    });
  }

  info(message: string, context?: LogContext): void {
    console.log(this.format("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.format("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack,
          }
        : { error };
    console.error(
      this.format("error", message, { ...context, ...errorDetails }),
    );
  }

  debug(message: string, context?: LogContext): void {
    if (process.env["NODE_ENV"] !== "production") {
      console.debug(this.format("debug", message, context));
    }
  }
}

export function createLogger(moduleName: string): AppLogger {
  return new AppLogger(moduleName);
}
