const pool = require('../../config/database');
const { hashPassword, verifyPassword, signToken } = require('./auth.service');

const VALID_ROLES = ['customer', 'vendor', 'rider'];

async function signup(req, res) {
  const { role, name, phone, email, password } = req.body || {};

  if (!role || !name || !phone || !email || !password) {
    return res.status(400).json({
      error: { message: 'role, name, phone, email, and password are required', code: 'VALIDATION_ERROR' },
    });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      error: { message: `role must be one of: ${VALID_ROLES.join(', ')}`, code: 'VALIDATION_ERROR' },
    });
  }

  const passwordHash = await hashPassword(password);

  await pool.query(
    'INSERT INTO users (role, name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)',
    [role, name, phone, email, passwordHash]
  );

  const [rows] = await pool.query(
    'SELECT id, role, name, phone, email, created_at FROM users WHERE email = ?',
    [email]
  );

  res.status(201).json(rows[0]);
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: { message: 'email and password are required', code: 'VALIDATION_ERROR' },
    });
  }

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