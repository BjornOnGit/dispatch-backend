const vendorRepository = require('./vendor.repository');
const HttpError = require('../../lib/http-error');

async function assertOwnership(vendorId, requestingUserId) {
  const vendor = await vendorRepository.getVendorById(vendorId);
  if (!vendor) {
    throw new HttpError(404, 'Vendor not found', 'NOT_FOUND');
  }
  if (vendor.user_id !== requestingUserId) {
    throw new HttpError(403, 'You do not own this vendor profile', 'FORBIDDEN');
  }
}

async function createMenuItem({ vendorId, requestingUserId, name, price }) {
  await assertOwnership(vendorId, requestingUserId);
  return vendorRepository.createMenuItem(vendorId, { name, price });
}

async function listMenuItems(vendorId) {
  const vendor = await vendorRepository.getVendorById(vendorId);
  if (!vendor) {
    throw new HttpError(404, 'Vendor not found', 'NOT_FOUND');
  }
  return vendorRepository.getMenuItems(vendorId);
}

async function updateMenuItem({ vendorId, itemId, requestingUserId, name, price }) {
  await assertOwnership(vendorId, requestingUserId);

  const item = await vendorRepository.getMenuItemById(itemId);
  if (!item || item.vendor_id !== vendorId) {
    throw new HttpError(404, 'Menu item not found', 'NOT_FOUND');
  }

  return vendorRepository.updateMenuItem(itemId, { name, price });
}

module.exports = { createMenuItem, listMenuItems, updateMenuItem };