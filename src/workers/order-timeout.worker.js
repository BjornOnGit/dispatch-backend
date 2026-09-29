const { Worker } = require('bullmq');
const env = require('../config/env');
const { connection, dispatchQueue, TIMEOUT_QUEUE_NAME } = require('../lib/queue');
const orderRepository = require('../modules/orders/order.repository');

// Runs when an order's timeout window elapses. If the order never got a rider,
// hand it to the reassignment worker (8.3) via the dispatch queue.
async function processOrderTimeout(job) {
  const { orderId } = job.data;

  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    console.log(`[order-timeout] order ${orderId} not found, skipping`);
    return;
  }

  if (order.status !== 'vendor_accepted') {
    console.log(`[order-timeout] order ${orderId} is ${order.status}, nothing to do`);
    return;
  }

  await dispatchQueue.add(
    'reassign-order',
    { orderId },
    {
      attempts: env.reassignMaxAttempts,
      backoff: { type: 'fixed', delay: env.reassignRetryDelaySeconds * 1000 },
    }
  );
  console.log(`[order-timeout] order ${orderId} still unassigned, enqueued reassignment`);
}

const worker = new Worker(TIMEOUT_QUEUE_NAME, processOrderTimeout, { connection });

worker.on('failed', (job, err) => {
  console.error(`[order-timeout] job ${job && job.id} failed:`, err.message);
});

console.log('[order-timeout] worker started');

module.exports = worker;