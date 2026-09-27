const pool = require('../../config/database');

async function getRiderById(riderId) {
  const [rows] = await pool.query('SELECT * FROM riders WHERE id = ?', [riderId]);
  return rows[0] || null;
}

async function updateAvailability(riderId, isAvailable) {
  await pool.query('UPDATE riders SET is_available = ? WHERE id = ?', [isAvailable, riderId]);
}

module.exports = { getRiderById, updateAvailability };