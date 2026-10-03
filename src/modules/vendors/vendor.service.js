const vendorRepository = require('./vendor.repository');
const redis = require('../../config/redis');
const HttpError = require('../../lib/http-error');

const MENU_CACHE_TTL_SECONDS = 60;
const menuCacheKey = (vendorId) => `vendor:${vendorId}:menu-items`;

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
  const item = await vendorRepository.createMenuItem(vendorId, { name, price });
  await redis.del(menuCacheKey(vendorId));
  return item;
}

async function listMenuItems(vendorId) {
  const cacheKey = menuCacheKey(vendorId);
  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log(`[cache] hit for ${cacheKey}`);
    return JSON.parse(cached);
  }

  console.log(`[cache] miss for ${cacheKey}`);

  const vendor = await vendorRepository.getVendorById(vendorId);
  if (!vendor) {
    throw new HttpError(404, 'Vendor not found', 'NOT_FOUND');
  }

  const items = await vendorRepository.getMenuItems(vendorId);
  await redis.set(cacheKey, JSON.stringify(items), 'EX', MENU_CACHE_TTL_SECONDS);
  return items;
}

async function updateMenuItem({ vendorId, itemId, requestingUserId, name, price }) {
  await assertOwnership(vendorId, requestingUserId);

  const item = await vendorRepository.getMenuItemById(itemId);
  if (!item || item.vendor_id !== vendorId) {
    throw new HttpError(404, 'Menu item not found', 'NOT_FOUND');
  }

  const updated = await vendorRepository.updateMenuItem(itemId, { name, price });
  await redis.del(menuCacheKey(vendorId));
  return updated;
}

async function updateLocation({ vendorId, requestingUserId, lat, lon }) {
  await assertOwnership(vendorId, requestingUserId);
  await vendorRepository.updateLocation(vendorId, { lat, lon });
  return vendorRepository.getVendorById(vendorId);
}

module.exports = { createMenuItem, listMenuItems, updateMenuItem, updateLocation };