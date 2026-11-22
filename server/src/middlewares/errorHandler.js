const AppError = require('../utils/AppError');
const logger = require('../config/logger');

/** Central error handler: every error leaves the API in the same JSON shape. */
 
function errorHandler(err, req, res, _next) {
  let error = err;
  if (!(error instanceof AppError)) {
    if (err.name === 'CastError') error = AppError.badRequest(`Invalid ${err.path}`);
    else if (err.code === 11000) error = AppError.conflict('Duplicate value', 'DUPLICATE', err.keyValue);
    else if (err.name === 'ValidationError') error = AppError.badRequest('Validation failed', Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })));
    else if (err.name === 'MulterError') error = AppError.badRequest(err.message);
    else if (err.type === 'entity.parse.failed') error = AppError.badRequest('Malformed JSON body');
    else error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }

  if (error.statusCode >= 500) logger.error({ err, path: req.path }, 'Unhandled error');
  else logger.warn({ code: error.code, path: req.path }, error.message);

  res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
}

function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = { errorHandler, notFound };
