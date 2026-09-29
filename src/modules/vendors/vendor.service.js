const pool = require('../../config/database');

async function getVendorById(vendorId) {
  const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [vendorId]);
  return rows[0] || null;
}

async function createMenuItem(vendorId, { name, price }) {
  await pool.query('INSERT INTO menu_items (vendor_id, name, price) VALUES (?, ?, ?)', [
    vendorId,
    name,
    price,
  ]);

  const [rows] = await pool.query(
    'SELECT * FROM menu_items WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 1',
    [vendorId]
  );
  return rows[0];
}

async function getMenuItems(vendorId) {
  const [rows] = await pool.query(
    'SELECT * FROM menu_items WHERE vendor_id = ? ORDER BY created_at ASC',
    [vendorId]
  );
  return rows;
}

async function getMenuItemById(itemId) {
  const [rows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [itemId]);
  return rows[0] || null;
}

async function updateMenuItem(itemId, { name, price }) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push('name = ?');
    values.push(name);
  }
  if (price !== undefined) {
    fields.push('price = ?');
    values.push(price);
  }

  if (fields.length === 0) {
    return getMenuItemById(itemId);
  }

  values.push(itemId);
  await pool.query(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`, values);

  return getMenuItemById(itemId);
}

async function updateLocation({ vendorId, requestingUserId, lat, lon }) {
  await assertOwnership(vendorId, requestingUserId);
  await vendorRepository.updateLocation(vendorId, { lat, lon });
  return vendorRepository.getVendorById(vendorId);
}

module.exports = { getVendorById, createMenuItem, getMenuItems, updateMenuItem, updateLocation };