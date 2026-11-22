const AppError = require('../utils/AppError');

/** Factory so the middleware gets AuthService injected (no global singletons). */
function makeAuth(authService) {
  const read = (req) => {
    const header = req.headers.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7) : null;
  };

  const authenticate = (req, _res, next) => {
    const token = read(req);
    if (!token) return next(AppError.unauthorized());
    try {
      const payload = authService.verifyToken(token);
      req.user = { id: payload.sub, role: payload.role, name: payload.name };
      return next();
    } catch {
      return next(AppError.unauthorized('Session expired, please log in again'));
    }
  };

  /** Role-based access control. */
  const authorize = (...roles) => (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden(`Only ${roles.join('/')} can do this`));
    return next();
  };

  return { authenticate, authorize };
}

module.exports = makeAuth;
