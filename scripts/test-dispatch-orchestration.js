const pool = require('../src/config/database');
const redis = require('../src/config/redis');
const orderRepository = require('../src/modules/orders/order.repository');
const { dispatchOrder } = require('../src/modules/riders/dispatch.service');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';
const ORIGIN = { lat: 6.4541, lon: 3.3947 };

async function makeVendorAcceptedOrder(customerId, vendorId) {
  const order = await orderRepository.createOrder({ customerId, vendorId, totalAmount: 10 });
  await orderRepository.updateOrderStatus(order.id, 'vendor_accepted');
  return order.id;
}

async function run() {
  const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
  const [[vendor]] = await pool.query('SELECT id FROM vendors LIMIT 1');
  const [[rider]] = await pool.query('SELECT id FROM riders LIMIT 1');

  if (!customer || !vendor || !rider) {
    throw new Error('Run `npm run seed` first — need at least one customer, vendor, and rider.');
  }

  let pass = true;

  // Scenario 1: one available rider seeded -> order should end in rider_assigned
  // (using a real riders.id, since orders.rider_id has a FK constraint to riders)
  await redis.del(LOCATIONS_KEY, AVAILABLE_KEY);
  await redis.geoadd(LOCATIONS_KEY, ORIGIN.lon, ORIGIN.lat, rider.id);
  await redis.sadd(AVAILABLE_KEY, rider.id);

  const orderId1 = await makeVendorAcceptedOrder(customer.id, vendor.id);
  const result1 = await dispatchOrder(orderId1, ORIGIN.lat, ORIGIN.lon, 50);
  const order1 = await orderRepository.getOrderById(orderId1);

  console.log('Scenario 1 (1 available rider):', result1, '-> order status:', order1.status, 'rider_id:', order1.rider_id);
  const scenario1Ok = result1.assigned === true && order1.status === 'rider_assigned' && order1.rider_id === rider.id;
  console.log(scenario1Ok ? 'Scenario 1 PASS' : 'Scenario 1 FAIL');
  pass = pass && scenario1Ok;

  // Scenario 2: no available riders -> order stays vendor_accepted
  await redis.del(LOCATIONS_KEY, AVAILABLE_KEY);

  const orderId2 = await makeVendorAcceptedOrder(customer.id, vendor.id);
  const result2 = await dispatchOrder(orderId2, ORIGIN.lat, ORIGIN.lon, 50);
  const order2 = await orderRepository.getOrderById(orderId2);

  console.log('Scenario 2 (0 available riders):', result2, '-> order status:', order2.status);
  const scenario2Ok = result2.assigned === false && order2.status === 'vendor_accepted';
  console.log(scenario2Ok ? 'Scenario 2 PASS' : 'Scenario 2 FAIL');
  pass = pass && scenario2Ok;

  return pass;
}

run()
  .then((pass) => {
    console.log(pass ? 'PASS' : 'FAIL');
    process.exit(pass ? 0 : 1);
  })
  .catch((err) => {
    console.error('Test errored:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await redis.quit();
  });