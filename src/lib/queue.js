const { Queue } = require('bullmq');
const env = require('../config/env');

const DISPATCH_QUEUE_NAME = 'dispatch-queue';
const TIMEOUT_QUEUE_NAME = 'timeout-queue';

// Same Redis server/credentials as config/redis.js. BullMQ workers use blocking
// commands, which require maxRetriesPerRequest: null, so we pass connection
// options rather than sharing the app's ioredis client instance.
const connection = {
  host: env.redis.host,
  port: Number(env.redis.port),
  password: env.redis.password,
  maxRetriesPerRequest: null,
};

const dispatchQueue = new Queue(DISPATCH_QUEUE_NAME, { connection });
const timeoutQueue = new Queue(TIMEOUT_QUEUE_NAME, { connection });

// Delayed job: fires after the timeout window. jobId makes scheduling idempotent per order.
function scheduleOrderTimeout(orderId, delayMs = env.orderTimeoutSeconds * 1000) {
  return timeoutQueue.add(
    'order-timeout',
    { orderId },
    { delay: delayMs, jobId: `order-timeout-${orderId}`, removeOnComplete: true }
  );
}

module.exports = {
  dispatchQueue,
  timeoutQueue,
  connection,
  DISPATCH_QUEUE_NAME,
  TIMEOUT_QUEUE_NAME,
  scheduleOrderTimeout,
};