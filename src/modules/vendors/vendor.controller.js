const vendorService = require('./vendor.service');

async function createMenuItem(req, res) {
  const { name, price } = req.body;

  const item = await vendorService.createMenuItem({
    vendorId: req.params.id,
    requestingUserId: req.user.id,
    name,
    price,
  });

  res.status(201).json(item);
}

async function listMenuItems(req, res) {
  const items = await vendorService.listMenuItems(req.params.id);
  res.status(200).json(items);
}

async function updateMenuItem(req, res) {
  const { name, price } = req.body;

  const item = await vendorService.updateMenuItem({
    vendorId: req.params.id,
    itemId: req.params.itemId,
    requestingUserId: req.user.id,
    name,
    price,
  });

  res.status(200).json(item);
}

async function updateLocation(req, res) {
  const { lat, lon } = req.body;

  const vendor = await vendorService.updateLocation({
    vendorId: req.params.id,
    requestingUserId: req.user.id,
    lat,
    lon,
  });

  res.status(200).json(vendor);
}

module.exports = { createMenuItem, listMenuItems, updateMenuItem, updateLocation };