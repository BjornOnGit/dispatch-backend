const pool = require('../../config/database');
const { hashPassword, verifyPassword, signToken } = require('./auth.service');

// Creates the users row, plus the matching vendors/riders profile row when the
// role calls for one, in a single transaction — a vendor/rider account is
// useless without its profile row, so the two must not be able to split.
async function signup(req, res) {
  const { role, name, phone, email, password, businessName, address, vehicleType } = req.body;

  const passwordHash = await hashPassword(password);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO users (role, name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)',
      [role, name, phone, email, passwordHash]
    );

    const [userRows] = await conn.query(
      'SELECT id, role, name, phone, email, created_at FROM users WHERE email = ?',
      [email]
    );
    const user = userRows[0];

    const profile = {};

    if (role === 'vendor') {
      await conn.query('INSERT INTO vendors (user_id, business_name, address) VALUES (?, ?, ?)', [
        user.id,
        businessName,
        address,
      ]);
      const [vendorRows] = await conn.query('SELECT id FROM vendors WHERE user_id = ?', [user.id]);
      profile.vendorId = vendorRows[0].id;
    } else if (role === 'rider') {
      await conn.query('INSERT INTO riders (user_id, vehicle_type) VALUES (?, ?)', [user.id, vehicleType]);
      const [riderRows] = await conn.query('SELECT id FROM riders WHERE user_id = ?', [user.id]);
      profile.riderId = riderRows[0].id;
    }

    await conn.commit();
    res.status(201).json({ ...user, ...profile });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return res.status(401).json({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
  }

  const token = signToken(user);
  res.status(200).json({ token });
}

module.exports = { signup, login };