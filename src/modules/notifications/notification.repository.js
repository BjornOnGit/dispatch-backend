const pool = require('../../config/database');

async function createNotification({ userId, orderId, type, message }) {
  await pool.query(
    'INSERT INTO notifications (user_id, order_id, type, message) VALUES (?, ?, ?, ?)',
    [userId, orderId, type, message]
  );
}

async function listNotificationsForUser(userId) {
  const [rows] = await pool.query(
    'SELECT id, order_id, type, message, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

module.exports = { createNotification, listNotificationsForUser };