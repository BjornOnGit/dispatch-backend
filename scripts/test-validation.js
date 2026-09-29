const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const app = require('../src/app');

const uuid = () => crypto.randomUUID();

async function call(base, { method, path, role, body, raw, headers }) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (role) {
    h.Authorization = `Bearer ${jwt.sign({ id: uuid(), role }, env.jwtSecret)}`;
  }

  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) payload = JSON.stringify(body);

  const res = await fetch(base + path, { method, headers: h, body: payload });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const sign = (raw) => crypto.createHmac('sha256', env.webhookSecret).update(raw).digest('hex');
const BAD_WEBHOOK_BODY = JSON.stringify({ event_id: 'evt-x' }); // missing provider_reference + status

// Every case must come back 400 with field-level details (never a 500).
const cases = [
  { name: 'signup: empty body', req: { method: 'POST', path: '/auth/signup', body: {} }, fields: ['role', 'name', 'phone', 'email', 'password'] },
  { name: 'signup: bad role/email/short password', req: { method: 'POST', path: '/auth/signup', body: { role: 'admin', name: 'A', phone: '1', email: 'nope', password: 'short' } }, fields: ['role', 'email', 'password'] },
  { name: 'login: empty body', req: { method: 'POST', path: '/auth/login', body: {} }, fields: ['email', 'password'] },
  { name: 'login: array body', req: { method: 'POST', path: '/auth/login', raw: '[]' }, fields: ['body'] },
  { name: 'login: malformed JSON', req: { method: 'POST', path: '/auth/login', raw: '{"email": ' }, code: 'INVALID_JSON' },
  { name: 'create order: empty body', req: { method: 'POST', path: '/orders', role: 'customer', body: {} }, fields: ['vendorId', 'totalAmount'] },
  { name: 'create order: wrong types', req: { method: 'POST', path: '/orders', role: 'customer', body: { vendorId: 'nope', totalAmount: '12' } }, fields: ['vendorId', 'totalAmount'] },
  { name: 'create order: negative amount', req: { method: 'POST', path: '/orders', role: 'customer', body: { vendorId: uuid(), totalAmount: -5 } }, fields: ['totalAmount'] },
  { name: 'vendor response: bad action', req: { method: 'PATCH', path: `/orders/${uuid()}/vendor-response`, role: 'vendor', body: { action: 'maybe' } }, fields: ['action'] },
  { name: 'rider status: bad status', req: { method: 'PATCH', path: `/orders/${uuid()}/rider-status`, role: 'rider', body: { status: 'placed' } }, fields: ['status'] },
  { name: 'rider location: wrong type', req: { method: 'POST', path: `/riders/${uuid()}/location`, role: 'rider', body: { lat: 'x', lon: 3.3 } }, fields: ['lat'] },
  { name: 'rider location: out of range', req: { method: 'POST', path: `/riders/${uuid()}/location`, role: 'rider', body: { lat: 200, lon: 500 } }, fields: ['lat', 'lon'] },
  { name: 'rider availability: not a boolean', req: { method: 'PATCH', path: `/riders/${uuid()}/availability`, role: 'rider', body: { isAvailable: 'yes' } }, fields: ['isAvailable'] },
  { name: 'menu item create: empty name, negative price', req: { method: 'POST', path: `/vendors/${uuid()}/menu-items`, role: 'vendor', body: { name: '', price: -1 } }, fields: ['name', 'price'] },
  { name: 'menu item update: nothing to update', req: { method: 'PATCH', path: `/vendors/${uuid()}/menu-items/${uuid()}`, role: 'vendor', body: {} }, fields: ['body'] },
  {
    name: 'webhook: valid signature, bad body',
    req: { method: 'POST', path: '/webhooks/payments', raw: BAD_WEBHOOK_BODY, headers: { 'x-signature': sign(BAD_WEBHOOK_BODY) } },
    fields: ['provider_reference', 'status'],
  },
];

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let failures = 0;

  const report = (ok, name, extra = '') => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ` (${extra})` : ''}`);
  };

  try {
    for (const c of cases) {
      const { status, json } = await call(base, c.req);
      const code = json && json.error && json.error.code;
      const got = ((json && json.error && json.error.details) || []).map((d) => d.field);

      const expectedCode = c.code || 'VALIDATION_ERROR';
      const ok = status === 400 && code === expectedCode && (c.fields || []).every((f) => got.includes(f));
      report(ok, c.name, `status ${status}, code ${code}${got.length ? `, fields ${got.join('/')}` : ''}`);
    }

    // An unsigned webhook must still be rejected with 401, even when the body is invalid
    const unsigned = await call(base, { method: 'POST', path: '/webhooks/payments', raw: BAD_WEBHOOK_BODY });
    report(unsigned.status === 401, 'webhook: bad signature stays 401', `status ${unsigned.status}`);

    // Control: a well-formed body gets past validation (unknown rider -> 404 from the service)
    const control = await call(base, {
      method: 'POST',
      path: `/riders/${uuid()}/location`,
      role: 'rider',
      body: { lat: 6.5, lon: 3.3 },
    });
    report(control.status === 404, 'control: valid body passes validation', `status ${control.status}`);
  } catch (err) {
    failures += 1;
    console.error('Test errored:', err.message);
  } finally {
    console.log(failures === 0 ? 'PASS' : 'FAIL');
    server.close();
    process.exit(failures === 0 ? 0 : 1);
  }
})();