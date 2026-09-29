const pool = require('../src/config/database');
const redis = require('../src/config/redis');
const orderRepository = require('../src/modules/orders/order.repository');
const { dispatchQueue, timeoutQueue, scheduleOrderTimeout } = require('../src/lib/queue');
const worker = require('../src/workers/order-timeout.worker');

const TIMEOUT_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let pass = false;

  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id FROM vendors LIMIT 1');
    if (!customer || !vendor) throw new Error('Run `npm run seed` first.');

    // An order stuck in vendor_accepted; no riders are involved, so nothing can assign it.
    const order = await orderRepository.createOrder({
      customerId: customer.id,
      vendorId: vendor.id,
      totalAmount: 10,
    });
    await orderRepository.updateOrderStatus(order.id, 'vendor_accepted');

    await scheduleOrderTimeout(order.id, TIMEOUT_MS);
    console.log(`Scheduled timeout for order ${order.id} in ${TIMEOUT_MS}ms`);

    await sleep(TIMEOUT_MS + 2000);

    const jobs = await dispatchQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const reassignJobs = jobs.filter((j) => j.name === 'reassign-order' && j.data.orderId === order.id);

    console.log('Reassignment jobs found for this order:', reassignJobs.length);
    pass = reassignJobs.length === 1;

    // Clean up so a later run of the reassignment worker doesn't pick up test data
    await Promise.all(reassignJobs.map((j) => j.remove()));
  } catch (err) {
    console.error('Test errored:', err.message);
  } finally {
    console.log(pass ? 'PASS' : 'FAIL');
    await worker.close();
    await timeoutQueue.close();
    await dispatchQueue.close();
    await pool.end();
    await redis.quit();
    process.exit(pass ? 0 : 1);
  }
})();