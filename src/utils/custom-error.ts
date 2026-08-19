const ErrorCodes = {
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

type ErrorCode = keyof typeof ErrorCodes;
class CustomError<C extends string> extends Error {
  message: string;
  statusCode?: number;
  code?: C;
  data?: unknown;

  constructor({
    message,
    statusCode,
    code,
    data,
  }: {
    message: string;
    statusCode?: number;
    code?: C;
    data?: unknown;
  }) {
    super();
    this.message = message;
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
  }
}

class EntityNotFoundError extends CustomError<ErrorCode> {
  statusCode: number = 404;
}
class InternalServerError extends CustomError<ErrorCode> {
  statusCode: number = 500;
}
class RouteNotFoundError extends CustomError<ErrorCode> {
  statusCode: number = 404;
}
class ValidationError extends CustomError<ErrorCode> {
  statusCode: number = 400;
}
class UnauthorizedError extends CustomError<ErrorCode> {
  statusCode: number = 401;

  constructor({
    message,
    statusCode,
    code,
    data,
  }: {
    message: string;
    statusCode?: number;
    code?: ErrorCode;
    data?: unknown;
  }) {
    super({
      message,
      statusCode,
      code: code ?? 'UNAUTHORIZED',
      data,
    });
    this.statusCode = statusCode ?? 401;
  }
}
class ForbiddenError extends CustomError<ErrorCode> {
  statusCode: number = 403;

  constructor({
    message,
    statusCode,
    code,
    data,
  }: {
    message: string;
    statusCode?: number;
    code?: ErrorCode;
    data?: unknown;
  }) {
    super({
      message,
      statusCode,
      code: code ?? 'FORBIDDEN',
      data,
    });
    this.statusCode = statusCode ?? 403;
  }
}

export {
  EntityNotFoundError,
  InternalServerError,
  RouteNotFoundError,
  ValidationError,
  ErrorCodes,
  CustomError,
  UnauthorizedError,
  ForbiddenError,
};
