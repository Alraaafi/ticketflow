/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Thrown anywhere in the app and turned into a JSON response by errorHandler.
 */
class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) { return new AppError(400, 'BAD_REQUEST', message, details); }
  static unauthorized(message = 'Authentication required') { return new AppError(401, 'UNAUTHORIZED', message); }
  static forbidden(message = 'You are not allowed to do this') { return new AppError(403, 'FORBIDDEN', message); }
  static notFound(message = 'Resource not found') { return new AppError(404, 'NOT_FOUND', message); }
  static conflict(message, code = 'CONFLICT', details) { return new AppError(409, code, message, details); }
}

module.exports = AppError;
