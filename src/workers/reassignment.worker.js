const { Worker } = require('bullmq');
const { connection, DISPATCH_QUEUE_NAME } = require('../lib/queue');
const orderRepository = require('../modules/orders/order.repository');
const dispatchService = require('../modules/riders/dispatch.service');
const notificationService = require('../modules/notifications/notification.service');

// Consumes reassign-order jobs (enqueued by the order-timeout worker) and
// re-runs dispatch for an order that is still waiting on a rider.
// Throwing when no rider is found makes BullMQ retry the job using the
// attempts/backoff it was enqueued with.
async function processReassignment(job) {
  if (job.name !== 'reassign-order') return;

  const { orderId } = job.data;

  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    console.log(`[reassignment] order ${orderId} not found, skipping`);
    return;
  }

  if (order.status !== 'vendor_accepted') {
    console.log(`[reassignment] order ${orderId} is ${order.status}, nothing to do`);
    return;
  }

  const location = await orderRepository.getVendorLocationById(order.vendor_id);
  if (!location || location.lat === null || location.lon === null) {
    console.log(`[reassignment] vendor ${order.vendor_id} has no location, cannot dispatch order ${orderId}`);
    return;
  }

  const result = await dispatchService.dispatchOrder(orderId, location.lat, location.lon);

  if (!result.assigned) {
    throw new Error(`No available rider for order ${orderId}`);
  }

  console.log(`[reassignment] order ${orderId} assigned to rider ${result.riderId}`);
}

const worker = new Worker(DISPATCH_QUEUE_NAME, processReassignment, { connection });

worker.on('failed', async (job, err) => {
  if (!job) return;

  // A job that will be retried is 'delayed'; one that has used up its attempts is 'failed'.
  const state = await job.getState();

  if (state !== 'failed') {
    console.log(
      `[reassignment] attempt ${job.attemptsMade}/${job.opts.attempts || 1} failed for job ${job.id}: ${err.message}. Will retry.`
    );
    return;
  }

  console.error(`[reassignment] GAVE UP on job ${job.id} after ${job.attemptsMade} attempts: ${err.message}`);

  try {
    await notificationService.notifyRiderNotFound(job.data.orderId);
  } catch (notifyErr) {
    console.error(`[reassignment] failed to notify for order ${job.data.orderId}:`, notifyErr.message);
  }
});

console.log('[reassignment] worker started');

module.exports = worker;