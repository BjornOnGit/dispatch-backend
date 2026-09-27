const pool = require('../src/config/database');

const PLACEHOLDER_HASH = '$2b$10$placeholderplaceholderplaceholderplacehold';

const SEED_USERS = [
  { role: 'customer', name: 'Seed Customer', phone: '0000000001', email: 'seed-customer@example.com' },
  { role: 'vendor', name: 'Seed Vendor', phone: '0000000002', email: 'seed-vendor@example.com' },
  { role: 'rider', name: 'Seed Rider', phone: '0000000003', email: 'seed-rider@example.com' },
];

async function getOrCreateUser(conn, user) {
  const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [user.email]);
  if (existing.length > 0) {
    return existing[0].id;
  }

  await conn.query(
    'INSERT INTO users (role, name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)',
    [user.role, user.name, user.phone, user.email, PLACEHOLDER_HASH]
  );

  const [created] = await conn.query('SELECT id FROM users WHERE email = ?', [user.email]);
  return created[0].id;
}

async function seedVendor(conn, userId) {
  const [existing] = await conn.query('SELECT id FROM vendors WHERE user_id = ?', [userId]);
  if (existing.length > 0) return;

  await conn.query(
    'INSERT INTO vendors (user_id, business_name, address, is_online) VALUES (?, ?, ?, ?)',
    [userId, 'Seed Business', '1 Seed Street', false]
  );
}

async function seedRider(conn, userId) {
  const [existing] = await conn.query('SELECT id FROM riders WHERE user_id = ?', [userId]);
  if (existing.length > 0) return;

  await conn.query(
    'INSERT INTO riders (user_id, vehicle_type, is_available) VALUES (?, ?, ?)',
    [userId, 'bike', false]
  );
}

async function run() {
  const conn = await pool.getConnection();

  try {
    for (const seedUser of SEED_USERS) {
      const userId = await getOrCreateUser(conn, seedUser);

      if (seedUser.role === 'vendor') {
        await seedVendor(conn, userId);
      } else if (seedUser.role === 'rider') {
        await seedRider(conn, userId);
      }
    }

    console.log('Seed complete.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});