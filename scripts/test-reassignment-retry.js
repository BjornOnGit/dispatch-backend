const pool = require('../src/config/database');
const redis = require('../src/config/redis');
const orderRepository = require('../src/modules/orders/order.repository');
const { dispatchQueue } = require('../src/lib/queue');
const worker = require('../src/workers/reassignment.worker');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';
const DEFAULT_VENDOR_LOCATION = { lat: 6.4541, lon: 3.3947 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeVendorAcceptedOrder(customerId, vendorId) {
  const order = await orderRepository.createOrder({ customerId, vendorId, totalAmount: 10 });
  await orderRepository.updateOrderStatus(order.id, 'vendor_accepted');
  return order.id;
}

(async () => {
  let pass = false;
  let riderId;

  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id, lat, lon FROM vendors LIMIT 1');
    const [[rider]] = await pool.query('SELECT id FROM riders LIMIT 1');
    if (!customer || !vendor || !rider) throw new Error('Run `npm run seed` first.');
    riderId = rider.id;

    let { lat, lon } = vendor;
    if (lat === null || lon === null) {
      ({ lat, lon } = DEFAULT_VENDOR_LOCATION);
      await pool.query('UPDATE vendors SET lat = ?, lon = ? WHERE id = ?', [lat, lon, vendor.id]);
    }

    await redis.zrem(LOCATIONS_KEY, riderId);
    await redis.srem(AVAILABLE_KEY, riderId);

    // Scenario A: no rider at first, one shows up mid-retry -> assigned on a later attempt.
    const orderA = await makeVendorAcceptedOrder(customer.id, vendor.id);
    const jobA = await dispatchQueue.add(
      'reassign-order',
      { orderId: orderA },
      { attempts: 6, backoff: { type: 'fixed', delay: 500 } }
    );
    console.log('A: queued with no rider available');

    await sleep(1200);
    await redis.geoadd(LOCATIONS_KEY, lon, lat, riderId);
    await redis.sadd(AVAILABLE_KEY, riderId);
    console.log('A: rider became available');

    let updatedA;
    for (let i = 0; i < 24; i += 1) {
      await sleep(250);
      updatedA = await orderRepository.getOrderById(orderA);
      if (updatedA.status === 'rider_assigned') break;
    }
    const finishedJobA = await dispatchQueue.getJob(jobA.id);
    console.log('A: status =', updatedA.status, '| failed attempts before success =', finishedJobA.attemptsMade);
    const [notifsA] = await pool.query('SELECT id FROM notifications WHERE order_id = ?', [orderA]);
    console.log('A: notifications sent =', notifsA.length, '(expect 0)');
    const scenarioAOk =
      updatedA.status === 'rider_assigned' && finishedJobA.attemptsMade >= 1 && notifsA.length === 0;

    // Scenario B: no rider ever (the only one is now busy) -> retries run out, job left failed.
    const orderB = await makeVendorAcceptedOrder(customer.id, vendor.id);
    const jobB = await dispatchQueue.add(
      'reassign-order',
      { orderId: orderB },
      { attempts: 2, backoff: { type: 'fixed', delay: 300 } }
    );

    let stateB;
    for (let i = 0; i < 24; i += 1) {
      await sleep(250);
      stateB = await jobB.getState();
      if (stateB === 'failed') break;
    }
    const finishedJobB = await dispatchQueue.getJob(jobB.id);
    const updatedB = await orderRepository.getOrderById(orderB);
    console.log('B: job state =', stateB, '| attempts =', finishedJobB.attemptsMade, '| order status =', updatedB.status);

    // The customer and the vendor should both have been notified.
    const [[vendorRow]] = await pool.query('SELECT user_id FROM vendors WHERE id = ?', [vendor.id]);
    let notifsB = [];
    for (let i = 0; i < 12; i += 1) {
      [notifsB] = await pool.query('SELECT user_id, type FROM notifications WHERE order_id = ?', [orderB]);
      if (notifsB.length >= 2) break;
      await sleep(250);
    }
    const notifiedUsers = notifsB.map((n) => n.user_id);
    console.log('B: notifications sent =', notifsB.length, '(expect 2: customer + vendor)');

    const scenarioBOk =
      stateB === 'failed' &&
      finishedJobB.attemptsMade >= 2 &&
      updatedB.status === 'vendor_accepted' &&
      notifsB.length === 2 &&
      notifiedUsers.includes(customer.id) &&
      notifiedUsers.includes(vendorRow.user_id) &&
      notifsB.every((n) => n.type === 'no_rider_found');

    // Tidy up the failed test job so it doesn't linger in the queue
    await finishedJobB.remove();

    pass = scenarioAOk && scenarioBOk;
  } catch (err) {
    console.error('Test errored:', err.message);
  } finally {
    console.log(pass ? 'PASS' : 'FAIL');
    if (riderId) {
      await redis.zrem(LOCATIONS_KEY, riderId);
      await redis.srem(AVAILABLE_KEY, riderId);
    }
    await worker.close();
    await dispatchQueue.close();
    await pool.end();
    await redis.quit();
    process.exit(pass ? 0 : 1);
  }
})();