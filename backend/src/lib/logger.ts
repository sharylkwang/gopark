type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as Level;

function timestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function format(level: Level, tag: string, message: string): string {
  return `${timestamp()} [${level.toUpperCase()}] [${tag}] ${message}`;
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Record<string, unknown>).code;
    const prefix = code ? `[${code}] ` : '';
    return `${prefix}${err.message}`;
  }
  if (typeof err === 'string') return err;
  return String(err);
}

function createLogger(tag: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(format('debug', tag, msg), ...args.map(formatError));
    },
    info: (msg: string, ...args: unknown[]) => {
      if (shouldLog('info')) console.info(format('info', tag, msg), ...args.map(formatError));
    },
    warn: (msg: string, ...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(format('warn', tag, msg), ...args.map(formatError));
    },
    error: (msg: string, ...args: unknown[]) => {
      if (shouldLog('error')) console.error(format('error', tag, msg), ...args.map(formatError));
    },
  };
}

export default createLogger;
