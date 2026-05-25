/**
 * 환경 분리형 로거.
 * - production 환경에선 info/debug 는 무시하여 노이즈 제거.
 * - error/warn 는 항상 출력.
 *
 * 향후 외부 로깅(Sentry/Axiom 등) 통합 시, 여기 한 곳만 교체하면 됨.
 */
const isProd = process.env.NODE_ENV === "production";

type LogContext = Record<string, unknown>;

const format = (level: string, message: string, context?: LogContext) => {
  if (context && Object.keys(context).length > 0) {
    return [`[${level}] ${message}`, context];
  }
  return [`[${level}] ${message}`];
};

export const logger = {
  debug(message: string, context?: LogContext) {
    if (isProd) return;
    console.debug(...format("DEBUG", message, context));
  },
  info(message: string, context?: LogContext) {
    if (isProd) return;
    console.info(...format("INFO", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(...format("WARN", message, context));
  },
  error(message: string, error?: unknown, context?: LogContext) {
    const payload: LogContext = { ...context };
    if (error instanceof Error) {
      payload.error = error.message;
      payload.stack = error.stack;
    } else if (error !== undefined) {
      payload.error = error;
    }
    console.error(...format("ERROR", message, payload));
  },
};
