const levels = ['debug', 'info', 'warn', 'error'];
const envIdx = levels.indexOf(process.env.LOG_LEVEL ?? 'info'), min = envIdx < 0 ? levels.length : envIdx;

const fmtArg = (a: unknown) => {
  if (!(a instanceof Error)) return typeof a === 'string' ? a : String(a);
  const code = (a as Error & { code?: unknown }).code;
  return code ? `[${code}] ${a.message}` : a.message;
};

function createLogger(tag: string) {
  const emit = (i: number, write: (...out: unknown[]) => void, msg: string, args: unknown[]) => {
    if (i >= min) write(`${new Date().toISOString()} [${levels[i].toUpperCase()}] [${tag}] ${msg}`, ...args.map(fmtArg));
  };
  return {
    debug: (msg: string, ...args: unknown[]) => emit(0, console.debug, msg, args),
    info: (msg: string, ...args: unknown[]) => emit(1, console.info, msg, args),
    warn: (msg: string, ...args: unknown[]) => emit(2, console.warn, msg, args),
    error: (msg: string, ...args: unknown[]) => emit(3, console.error, msg, args),
  };
}

export default createLogger;
