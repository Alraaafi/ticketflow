const http = require('http');
const buildContainer = require('./container');
const createApp = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

async function main() {
  const container = buildContainer();
  const { env, logger, realtime, holdExpiryService } = container;

  await connectDB();
  const app = createApp(container);
  const server = http.createServer(app);
  realtime.attach(server);
  holdExpiryService.start();

  server.listen(env.PORT, () => logger.info(`TicketFlow API listening on :${env.PORT} (${env.NODE_ENV})`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    holdExpiryService.stop();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
}

main().catch((err) => {
   
  console.error('Failed to start server:', err);
  process.exit(1);
});
