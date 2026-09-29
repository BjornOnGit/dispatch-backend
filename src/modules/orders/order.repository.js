const pool = require('../../config/database');

async function createOrder({ customerId, vendorId, totalAmount }) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO orders (customer_id, vendor_id, total_amount, status) VALUES (?, ?, ?, ?)',
      [customerId, vendorId, totalAmount, 'placed']
    );

    const [rows] = await conn.query(
      'SELECT * FROM orders WHERE customer_id = ? AND vendor_id = ? ORDER BY created_at DESC LIMIT 1',
      [customerId, vendorId]
    );
    const order = rows[0];

    await conn.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (?, ?, ?)',
      [order.id, null, 'placed']
    );

    await conn.commit();
    return order;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getVendorIdByUserId(userId) {
  const [rows] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [userId]);
  return rows[0] ? rows[0].id : null;
}

async function getRiderIdByUserId(userId) {
  const [rows] = await pool.query('SELECT id FROM riders WHERE user_id = ?', [userId]);
  return rows[0] ? rows[0].id : null;
}

async function getVendorLocationById(vendorId) {
  const [rows] = await pool.query('SELECT lat, lon FROM vendors WHERE id = ?', [vendorId]);
  return rows[0] || null;
}

async function getOrderById(orderId) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0] || null;
}

async function getOrderHistory(orderId) {
  const [rows] = await pool.query(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at ASC',
    [orderId]
  );
  return rows;
}

// Returns the full order row after the write, matching createOrder/getOrderById,
// so every order-returning endpoint has the same response shape.
async function updateOrderStatus(orderId, newStatus) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const currentOrder = rows[0];

    if (!currentOrder) {
      throw new Error(`Order ${orderId} not found`);
    }

    const fromStatus = currentOrder.status;

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);

    await conn.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (?, ?, ?)',
      [orderId, fromStatus, newStatus]
    );

    const [updatedRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);

    await conn.commit();
    return updatedRows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Same shape guarantee as updateOrderStatus — returns the full row, not an
// ad-hoc object, so a dispatched order looks identical whether it came back
// from vendor-accept or from any other order-returning endpoint.
async function assignRiderToOrder(orderId, riderId) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const currentOrder = rows[0];

    if (!currentOrder) {
      throw new Error(`Order ${orderId} not found`);
    }

    const fromStatus = currentOrder.status;

    await conn.query('UPDATE orders SET status = ?, rider_id = ? WHERE id = ?', [
      'rider_assigned',
      riderId,
      orderId,
    ]);

    await conn.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (?, ?, ?)',
      [orderId, fromStatus, 'rider_assigned']
    );

    const [updatedRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);

    await conn.commit();
    return updatedRows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  createOrder,
  getOrderById,
  updateOrderStatus,
  getVendorIdByUserId,
  getRiderIdByUserId,
  getOrderHistory,
  assignRiderToOrder,
  getVendorLocationById,
};