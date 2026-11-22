const AppError = require('../utils/AppError');

/** Validates req[source] with a zod schema and replaces it with the parsed value. */
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(AppError.badRequest('Validation failed', details));
  }
  if (source === 'body') req.body = result.data;
  else if (source === 'query') req.validatedQuery = result.data; // req.query is read-only in newer Express
  return next();
};
