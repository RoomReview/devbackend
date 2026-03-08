const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG',
} as const;

type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LogContext {
  service: string;
  function: string;
}

const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  const validLevels = Object.values(LogLevel);
  return validLevels.includes(envLevel as LogLevel)
    ? (envLevel as LogLevel)
    : LogLevel.INFO;
};

const shouldLog = (level: LogLevel): boolean => {
  const levels: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };
  return levels[level] >= levels[getCurrentLogLevel()];
};

const formatLog = (
  level: LogLevel,
  message: string,
  context?: LogContext,
): string => {
  return `${context?.service && `[${context?.service}]`} ${context?.function && `[${context?.function}]`} [${new Date().toISOString()}] [${level}] ${message}`;
};

const logger = {
  info: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.INFO)) {
      console.log(formatLog(LogLevel.INFO, message, context), data);
    }
  },

  warn: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatLog(LogLevel.WARN, message, context), data);
    }
  },

  error: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(formatLog(LogLevel.ERROR, message, context), data);
    }
  },

  debug: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(formatLog(LogLevel.DEBUG, message, context), data);
    }
  },
};

export default logger;
