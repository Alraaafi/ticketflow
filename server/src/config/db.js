const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME, serverSelectionTimeoutMS: 15000 });
  logger.info(`MongoDB connected (db: ${env.DB_NAME})`);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

/** All collections live under one prefix, e.g. "TicketFlow_bookings". */
const collection = (name) => `${env.COLLECTION_PREFIX}_${name}`;

module.exports = { connectDB, disconnectDB, collection };
