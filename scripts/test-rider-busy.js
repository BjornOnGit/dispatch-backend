const pool = require('../src/config/database');
const redis = require('../src/config/redis');
const orderRepository = require('../src/modules/orders/order.repository');
const orderService = require('../src/modules/orders/order.service');
const { dispatchOrder } = require('../src/modules/riders/dispatch.service');
const { dispatchQueue, timeoutQueue } = require('../src/lib/queue');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';
const ORIGIN = { lat: 6.4541, lon: 3.3947 };

async function makeVendorAcceptedOrder(customerId, vendorId) {
  const order = await orderRepository.createOrder({ customerId, vendorId, totalAmount: 10 });
  await orderRepository.updateOrderStatus(order.id, 'vendor_accepted');
  return order.id;
}

(async () => {
  let pass = false;
  let rider;
  let originalIsAvailable;

  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id FROM vendors LIMIT 1');
    [[rider]] = await pool.query('SELECT id, user_id, is_available FROM riders LIMIT 1');
    if (!customer || !vendor || !rider) throw new Error('Run `npm run seed` first.');
    originalIsAvailable = rider.is_available;

    // One available rider (online in MySQL and in the Redis pool), two orders waiting.
    await pool.query('UPDATE riders SET is_available = 1 WHERE id = ?', [rider.id]);
    await redis.geoadd(LOCATIONS_KEY, ORIGIN.lon, ORIGIN.lat, rider.id);
    await redis.sadd(AVAILABLE_KEY, rider.id);

    const orderA = await makeVendorAcceptedOrder(customer.id, vendor.id);
    const orderB = await makeVendorAcceptedOrder(customer.id, vendor.id);

    // Both orders dispatch at the same moment; only one may get the rider.
    const [resultA, resultB] = await Promise.all([
      dispatchOrder(orderA, ORIGIN.lat, ORIGIN.lon, 50),
      dispatchOrder(orderB, ORIGIN.lat, ORIGIN.lon, 50),
    ]);
    const assignedCount = [resultA, resultB].filter((r) => r.assigned).length;
    console.log('Concurrent dispatch: assigned count =', assignedCount, '(expect 1)');

    const inPoolWhileBusy = await redis.sismember(AVAILABLE_KEY, rider.id);
    console.log('Rider still in available pool while busy:', inPoolWhileBusy, '(expect 0)');

    // Deliver the assigned order; the rider should return to the pool.
    const [assignedOrderId, waitingOrderId] = resultA.assigned ? [orderA, orderB] : [orderB, orderA];
    await orderService.updateRiderStatus({ orderId: assignedOrderId, riderUserId: rider.user_id, toStatus: 'picked_up' });
    await orderService.updateRiderStatus({ orderId: assignedOrderId, riderUserId: rider.user_id, toStatus: 'delivered' });

    const inPoolAfterDelivery = await redis.sismember(AVAILABLE_KEY, rider.id);
    console.log('Rider back in available pool after delivery:', inPoolAfterDelivery, '(expect 1)');

    // The waiting order can now be dispatched to the same rider.
    const retry = await dispatchOrder(waitingOrderId, ORIGIN.lat, ORIGIN.lon, 50);
    console.log('Waiting order dispatched after release:', retry.assigned, '(expect true)');

    pass =
      assignedCount === 1 &&
      inPoolWhileBusy === 0 &&
      inPoolAfterDelivery === 1 &&
      retry.assigned === true;
  } catch (err) {
    console.error('Test errored:', err.message);
  } finally {
    console.log(pass ? 'PASS' : 'FAIL');
    if (rider) {
      await pool.query('UPDATE riders SET is_available = ? WHERE id = ?', [originalIsAvailable, rider.id]);
      await redis.zrem(LOCATIONS_KEY, rider.id);
      await redis.srem(AVAILABLE_KEY, rider.id);
    }
    await dispatchQueue.close();
    await timeoutQueue.close();
    await pool.end();
    await redis.quit();
    process.exit(pass ? 0 : 1);
  }
})();