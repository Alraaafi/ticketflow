const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const pinoHttp = require('pino-http');
const buildRoutes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimiters');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

function createApp(container) {
  const { env, logger } = container;
  const app = express();

  app.set('trust proxy', 1); // Render / Vercel sit behind a proxy
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(mongoSanitize()); // strips $ and . keys -> blocks NoSQL injection
  app.use(hpp());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.get('/', (_req, res) => res.json({ name: 'TicketFlow API', docs: '/api/health' }));
  app.use('/api', apiLimiter, buildRoutes(container));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
