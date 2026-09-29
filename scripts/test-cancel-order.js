const crypto = require('crypto');
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

// Resolves to the HTTP status a request would get: 200 on success, err.status on failure.
async function statusOf(promise) {
  try {
    await promise;
    return 200;
  } catch (err) {
    return err.status || 500;
  }
}

(async () => {
  let pass = false;
  let rider;
  let originalIsAvailable;

  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id FROM vendors LIMIT 1');
    [[rider]] = await pool.query('SELECT id, is_available FROM riders LIMIT 1');
    if (!customer || !vendor || !rider) throw new Error('Run `npm run seed` first.');
    originalIsAvailable = rider.is_available;

    // Scenario 1: order with no rider yet (the "no rider found" case)
    const orderNoRider = await makeVendorAcceptedOrder(customer.id, vendor.id);
    const otherCustomerStatus = await statusOf(
      orderService.cancelOrder({ orderId: orderNoRider, customerId: crypto.randomUUID() })
    );
    const ownerStatus = await statusOf(orderService.cancelOrder({ orderId: orderNoRider, customerId: customer.id }));
    const again = await statusOf(orderService.cancelOrder({ orderId: orderNoRider, customerId: customer.id }));
    const cancelled = await orderRepository.getOrderById(orderNoRider);
    const history = await orderRepository.getOrderHistory(orderNoRider);
    const lastHistory = history[history.length - 1];

    console.log('Other customer cancelling:', otherCustomerStatus, '(expect 403)');
    console.log('Owner cancelling:', ownerStatus, '| order status:', cancelled.status, '(expect 200 | cancelled)');
    console.log('Cancelling again:', again, '(expect 409)');
    console.log('Last history row:', `${lastHistory.from_status} -> ${lastHistory.to_status}`, '(expect vendor_accepted -> cancelled)');

    // Scenario 2: rider already assigned -> cancelling frees the rider
    await pool.query('UPDATE riders SET is_available = 1 WHERE id = ?', [rider.id]);
    await redis.geoadd(LOCATIONS_KEY, ORIGIN.lon, ORIGIN.lat, rider.id);
    await redis.sadd(AVAILABLE_KEY, rider.id);

    const orderWithRider = await makeVendorAcceptedOrder(customer.id, vendor.id);
    const dispatched = await dispatchOrder(orderWithRider, ORIGIN.lat, ORIGIN.lon, 50);
    const busy = await redis.sismember(AVAILABLE_KEY, rider.id);

    const cancelWithRiderStatus = await statusOf(
      orderService.cancelOrder({ orderId: orderWithRider, customerId: customer.id })
    );
    const freed = await redis.sismember(AVAILABLE_KEY, rider.id);

    console.log('Rider assigned:', dispatched.assigned, '| in pool while busy:', busy, '(expect true | 0)');
    console.log('Cancel with rider:', cancelWithRiderStatus, '| rider back in pool:', freed, '(expect 200 | 1)');

    pass =
      otherCustomerStatus === 403 &&
      ownerStatus === 200 &&
      cancelled.status === 'cancelled' &&
      again === 409 &&
      lastHistory.from_status === 'vendor_accepted' &&
      lastHistory.to_status === 'cancelled' &&
      dispatched.assigned === true &&
      busy === 0 &&
      cancelWithRiderStatus === 200 &&
      freed === 1;
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