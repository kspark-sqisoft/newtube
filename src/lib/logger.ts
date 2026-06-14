/**
 * 환경 분리형 로거.
 * - dev: 사람이 읽기 좋은 콘솔 형식.
 * - prod: JSON 한 줄 (Vercel/CloudWatch 등 stdout 수집기가 파싱하기 좋게).
 *   외부 로깅(Sentry/Axiom 등) 통합 시 여기 한 곳만 교체하면 됨.
 */
const isProd = process.env.NODE_ENV === "production";

type LogContext = Record<string, unknown>;

type Level = "debug" | "info" | "warn" | "error";

const writeProd = (level: Level, message: string, context?: LogContext) => {
  const line = JSON.stringify({
    level,
    msg: message,
    time: new Date().toISOString(),
    ...(context ?? {}),
  });
  // debug 는 prod 에서 생략, 나머지는 stdout/stderr 로
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const writeDev = (level: Level, message: string, context?: LogContext) => {
  const tag = `[${level.toUpperCase()}] ${message}`;
  const args = context && Object.keys(context).length > 0 ? [tag, context] : [tag];
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else if (level === "debug") console.debug(...args);
  else console.info(...args);
};

const write = (level: Level, message: string, context?: LogContext) => {
  if (level === "debug" && isProd) return;
  (isProd ? writeProd : writeDev)(level, message, context);
};

export const logger = {
  debug(message: string, context?: LogContext) {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    const payload: LogContext = { ...context };
    if (error instanceof Error) {
      payload.error = error.message;
      payload.stack = error.stack;
    } else if (error !== undefined) {
      payload.error = error;
    }
    write("error", message, payload);
  },
};
