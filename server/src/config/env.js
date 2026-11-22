/**
 * Environment-based configuration.
 * All config is read from process.env once, validated with zod, and exported
 * as a frozen object. If something required is missing the app fails fast.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  DB_NAME: z.string().default('CPS_Pro'),
  COLLECTION_PREFIX: z.string().default('TicketFlow'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  HOLD_MINUTES: z.coerce.number().positive().default(5),
  HOLD_SWEEP_INTERVAL_SECONDS: z.coerce.number().positive().default(10),
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('CPS_Project'),
  REDIS_URL: z.string().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().default(60),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
   
  console.error('Invalid environment configuration:\n', parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

const env = parsed.data;
module.exports = Object.freeze({
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  clientOrigins: env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean),
});
