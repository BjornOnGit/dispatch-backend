const pool = require('../src/config/database');

(async () => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result');
    console.log('DB pool OK:', rows);
    process.exit(0);
  } catch (err) {
    console.error('DB pool FAILED:', err.message);
    process.exit(1);
  }
})();