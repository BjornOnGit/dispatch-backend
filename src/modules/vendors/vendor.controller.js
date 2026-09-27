const vendorService = require('./vendor.service');

async function createMenuItem(req, res) {
  const { name, price } = req.body || {};

  if (!name || price === undefined) {
    return res.status(400).json({
      error: { message: 'name and price are required', code: 'VALIDATION_ERROR' },
    });
  }

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
  const { name, price } = req.body || {};

  const item = await vendorService.updateMenuItem({
    vendorId: req.params.id,
    itemId: req.params.itemId,
    requestingUserId: req.user.id,
    name,
    price,
  });

  res.status(200).json(item);
}

module.exports = { createMenuItem, listMenuItems, updateMenuItem };