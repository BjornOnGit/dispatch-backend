const pool = require('../src/config/database');
const redis = require('../src/config/redis');
const orderRepository = require('../src/modules/orders/order.repository');
const { dispatchQueue } = require('../src/lib/queue');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';
const DEFAULT_VENDOR_LOCATION = { lat: 6.4541, lon: 3.3947 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let pass = false;
  let worker;
  let riderId;

  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id, lat, lon FROM vendors LIMIT 1');
    const [[rider]] = await pool.query('SELECT id FROM riders LIMIT 1');
    if (!customer || !vendor || !rider) throw new Error('Run `npm run seed` first.');
    riderId = rider.id;

    // Dispatch needs an origin, so make sure the vendor has a location.
    let { lat, lon } = vendor;
    if (lat === null || lon === null) {
      ({ lat, lon } = DEFAULT_VENDOR_LOCATION);
      await pool.query('UPDATE vendors SET lat = ?, lon = ? WHERE id = ?', [lat, lon, vendor.id]);
    }

    // No rider available yet.
    await redis.zrem(LOCATIONS_KEY, riderId);
    await redis.srem(AVAILABLE_KEY, riderId);

    // Order stuck in vendor_accepted, with the reassignment job already queued
    // (as if the timeout had just fired) and no worker running yet.
    const order = await orderRepository.createOrder({
      customerId: customer.id,
      vendorId: vendor.id,
      totalAmount: 10,
    });
    await orderRepository.updateOrderStatus(order.id, 'vendor_accepted');
    await dispatchQueue.add('reassign-order', { orderId: order.id });
    console.log(`Queued reassignment for order ${order.id} (no rider available yet)`);

    // A rider becomes available AFTER the job was queued.
    await redis.geoadd(LOCATIONS_KEY, lon, lat, riderId);
    await redis.sadd(AVAILABLE_KEY, riderId);
    console.log('Rider is now available near the vendor');

    // Start the worker only now, so it picks up the already-queued job.
    worker = require('../src/workers/reassignment.worker');

    let updated;
    for (let i = 0; i < 20; i += 1) {
      await sleep(250);
      updated = await orderRepository.getOrderById(order.id);
      if (updated.status === 'rider_assigned') break;
    }

    console.log('Order status:', updated.status, '| rider_id:', updated.rider_id);
    pass = updated.status === 'rider_assigned' && updated.rider_id === riderId;
  } catch (err) {
    console.error('Test errored:', err.message);
  } finally {
    console.log(pass ? 'PASS' : 'FAIL');
    if (riderId) {
      await redis.zrem(LOCATIONS_KEY, riderId);
      await redis.srem(AVAILABLE_KEY, riderId);
    }
    if (worker) await worker.close();
    await dispatchQueue.close();
    await pool.end();
    await redis.quit();
    process.exit(pass ? 0 : 1);
  }
})();