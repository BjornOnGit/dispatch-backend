require('dotenv').config();

const REQUIRED_VARS = [
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
  'WEBHOOK_SECRET',
];

function loadEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`
    );
  }

  return {
    port: process.env.PORT,
    db: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      url: process.env.REDIS_URL,
    },
    jwtSecret: process.env.JWT_SECRET,
    webhookSecret: process.env.WEBHOOK_SECRET,
    orderTimeoutSeconds: Number(process.env.ORDER_TIMEOUT_SECONDS) || 30,
    reassignMaxAttempts: Number(process.env.REASSIGN_MAX_ATTEMPTS) || 5,
    reassignRetryDelaySeconds: Number(process.env.REASSIGN_RETRY_DELAY_SECONDS) || 15,
  };
}

module.exports = loadEnv();