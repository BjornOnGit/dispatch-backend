const pool = require('../src/config/database');
const { createOrder, updateOrderStatus, getOrderById } = require('../src/modules/orders/order.repository');

(async () => {
  try {
    const [[customer]] = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const [[vendor]] = await pool.query('SELECT id FROM vendors LIMIT 1');

    if (!customer || !vendor) {
      throw new Error('Run `npm run seed` first — need at least one customer and one vendor.');
    }

    const order = await createOrder({
      customerId: customer.id,
      vendorId: vendor.id,
      totalAmount: 25.5,
    });
    console.log('Created order:', order.id, order.status);

    await updateOrderStatus(order.id, 'vendor_accepted');

    const updated = await getOrderById(order.id);
    console.log('Order status after update:', updated.status);

    const [historyRows] = await pool.query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at',
      [order.id]
    );
    console.log('History rows:', historyRows.length, historyRows.map((h) => `${h.from_status} -> ${h.to_status}`));

    const statusOk = updated.status === 'vendor_accepted';
    // 2 rows expected: one from createOrder (null -> placed), one from updateOrderStatus (placed -> vendor_accepted)
    const historyOk = historyRows.length === 2;

    if (statusOk && historyOk) {
      console.log('PASS');
      process.exit(0);
    } else {
      console.log('FAIL');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test errored:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();