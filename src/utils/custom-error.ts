const ErrorCodes = {
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
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
}
class ForbiddenError extends CustomError<ErrorCode> {
  statusCode: number = 403;
}
class RequestTimeoutError extends CustomError<ErrorCode> {
  statusCode: number = 408;
}

export {
  EntityNotFoundError,
  InternalServerError,
  RequestTimeoutError,
  RouteNotFoundError,
  ValidationError,
  ErrorCodes,
  CustomError,
  UnauthorizedError,
  ForbiddenError,
};
