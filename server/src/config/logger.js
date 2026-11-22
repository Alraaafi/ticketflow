const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/** Structured JSON logs in production, pretty logs in development. */
const logger = pino({
  level: isTest ? 'silent' : level,
  redact: ['req.headers.authorization', 'password', '*.password'],
  transport: isProd || isTest ? undefined : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

module.exports = logger;
