const crypto = require('crypto');
const pool = require('../../config/database');
const orderRepository = require('../orders/order.repository');
const HttpError = require('../../lib/http-error');

async function initiatePayment({ orderId, requestingUserId }) {
  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }

  if (order.customer_id !== requestingUserId) {
    throw new HttpError(403, 'You do not own this order', 'FORBIDDEN');
  }

  const providerReference = `mock_${crypto.randomUUID()}`;

  await pool.query(
    'INSERT INTO payments (order_id, provider, amount, status, provider_reference) VALUES (?, ?, ?, ?, ?)',
    [orderId, 'mock', order.total_amount, 'pending', providerReference]
  );

  const [rows] = await pool.query('SELECT * FROM payments WHERE provider_reference = ?', [
    providerReference,
  ]);
  return rows[0];
}

// Records the event id and updates the payment in one transaction.
// Inserting the event id first leans on its UNIQUE constraint, so two
// concurrent deliveries of the same event can't both get through.
async function processWebhookEvent({ eventId, providerReference, status }) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    try {
      await conn.query('INSERT INTO processed_webhook_events (event_id) VALUES (?)', [eventId]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        return { duplicate: true };
      }
      throw err;
    }

    const [result] = await conn.query('UPDATE payments SET status = ? WHERE provider_reference = ?', [
      status,
      providerReference,
    ]);

    if (result.affectedRows === 0) {
      throw new HttpError(404, 'Payment not found for provider_reference', 'NOT_FOUND');
    }

    await conn.commit();
    return { duplicate: false };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { initiatePayment, processWebhookEvent };