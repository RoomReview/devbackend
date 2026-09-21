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

const serializeData = (data: unknown): unknown => {
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }
  if (Array.isArray(data)) return data.map(serializeData);
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeData(value)]));
  }
  return data;
};

const formatLog = (
  level: LogLevel,
  message: string,
  context?: LogContext,
  data?: unknown,
): string => {
  return JSON.stringify({
    type: 'application_log',
    timestamp: new Date().toISOString(),
    level,
    service: context?.service,
    function: context?.function,
    message,
    ...(data === undefined ? {} : { data: serializeData(data) }),
  });
};

const logger = {
  info: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.INFO)) {
      console.log(formatLog(LogLevel.INFO, message, context, data), data);
    }
  },

  warn: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatLog(LogLevel.WARN, message, context, data), data);
    }
  },

  error: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(formatLog(LogLevel.ERROR, message, context, data), data);
    }
  },

  debug: (context: LogContext, message: string, data?: unknown) => {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(formatLog(LogLevel.DEBUG, message, context, data), data);
    }
  },
};

export default logger;
