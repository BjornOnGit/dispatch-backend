const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const pool = require('../src/config/database');
const app = require('../src/app');
const { dispatchQueue, timeoutQueue } = require('../src/lib/queue');
const redis = require('../src/config/redis');

const ORIGIN = { lat: 6.4541, lon: 3.3947 };
const unique = (prefix) => `${prefix}-${crypto.randomUUID()}@example.com`;

let server;
let base;
let createdOrderId; // for cleanup of its scheduled timeout job

function url(path) {
  return `${base}${path}`;
}

async function postJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url(path), { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

async function patchJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url(path), { method: 'PATCH', headers, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

async function getJson(path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url(path), { headers });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (createdOrderId) {
    const job = await timeoutQueue.getJob(`order-timeout-${createdOrderId}`);
    if (job) await job.remove();
  }
  await new Promise((resolve) => server.close(resolve));
  await dispatchQueue.close();
  await timeoutQueue.close();
  await redis.quit();
  await pool.end();
});

test('full order lifecycle: signup -> login -> create -> accept -> dispatch -> pickup -> delivered', async () => {
  // --- Signup ---
  const customerSignup = await postJson('/auth/signup', {
    role: 'customer',
    name: 'Lifecycle Customer',
    phone: '08010000001',
    email: unique('customer'),
    password: 'password123',
  });
  assert.equal(customerSignup.status, 201);

  const vendorEmail = unique('vendor');
  const vendorSignup = await postJson('/auth/signup', {
    role: 'vendor',
    name: 'Lifecycle Vendor',
    phone: '08010000002',
    email: vendorEmail,
    password: 'password123',
    businessName: 'Lifecycle Kitchen',
    address: '1 Lifecycle Street',
  });
  assert.equal(vendorSignup.status, 201);
  assert.ok(vendorSignup.json.vendorId, 'signup should return a vendorId for role: vendor');

  const riderEmail = unique('rider');
  const riderSignup = await postJson('/auth/signup', {
    role: 'rider',
    name: 'Lifecycle Rider',
    phone: '08010000003',
    email: riderEmail,
    password: 'password123',
    vehicleType: 'bike',
  });
  assert.equal(riderSignup.status, 201);
  assert.ok(riderSignup.json.riderId, 'signup should return a riderId for role: rider');

  const vendorId = vendorSignup.json.vendorId;
  const riderId = riderSignup.json.riderId;

  // --- Login ---
  const customerLogin = await postJson('/auth/login', { email: customerSignup.json.email, password: 'password123' });
  const vendorLogin = await postJson('/auth/login', { email: vendorEmail, password: 'password123' });
  const riderLogin = await postJson('/auth/login', { email: riderEmail, password: 'password123' });
  assert.equal(customerLogin.status, 200);
  assert.equal(vendorLogin.status, 200);
  assert.equal(riderLogin.status, 200);

  const customerToken = customerLogin.json.token;
  const vendorToken = vendorLogin.json.token;
  const riderToken = riderLogin.json.token;

  // --- Vendor sets their location, rider sets location + availability ---
  const vendorLocationRes = await patchJson(`/vendors/${vendorId}/location`, { lat: ORIGIN.lat, lon: ORIGIN.lon }, vendorToken);
  assert.equal(vendorLocationRes.status, 200);

  const locationRes = await postJson(`/riders/${riderId}/location`, { lat: ORIGIN.lat, lon: ORIGIN.lon }, riderToken);
  assert.equal(locationRes.status, 200);

  const availabilityRes = await patchJson(`/riders/${riderId}/availability`, { isAvailable: true }, riderToken);
  assert.equal(availabilityRes.status, 200);

  // --- Create order ---
  const createRes = await postJson('/orders', { vendorId, totalAmount: 25.5 }, customerToken);
  assert.equal(createRes.status, 201);
  assert.equal(createRes.json.status, 'placed');

  const orderId = createRes.json.id;
  createdOrderId = orderId;

  // --- Vendor accepts (dispatch runs synchronously inside this call) ---
  const acceptRes = await patchJson(`/orders/${orderId}/vendor-response`, { action: 'accept' }, vendorToken);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.json.status, 'rider_assigned');
  assert.equal(acceptRes.json.rider_id, riderId);

  // --- Rider: pickup ---
  const pickupRes = await patchJson(`/orders/${orderId}/rider-status`, { status: 'picked_up' }, riderToken);
  assert.equal(pickupRes.status, 200);
  assert.equal(pickupRes.json.status, 'picked_up');

  // --- Rider: delivered ---
  const deliveredRes = await patchJson(`/orders/${orderId}/rider-status`, { status: 'delivered' }, riderToken);
  assert.equal(deliveredRes.status, 200);
  assert.equal(deliveredRes.json.status, 'delivered');

  // --- Final check: order + full history, as the customer ---
  const getRes = await getJson(`/orders/${orderId}`, customerToken);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.json.status, 'delivered');
  assert.equal(getRes.json.rider_id, riderId);

  const transitions = getRes.json.history.map((h) => `${h.from_status ?? 'null'}->${h.to_status}`);
  assert.deepEqual(transitions, [
    'null->placed',
    'placed->vendor_accepted',
    'vendor_accepted->rider_assigned',
    'rider_assigned->picked_up',
    'picked_up->delivered',
  ]);

  // --- Rider should be back in the available pool after delivery ---
  const inPool = await redis.sismember('riders:available', riderId);
  assert.equal(inPool, 1);
});