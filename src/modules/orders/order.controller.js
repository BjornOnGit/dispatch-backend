const orderService = require('./order.service');

async function createOrder(req, res) {
  const { vendorId, totalAmount } = req.body || {};

  if (!vendorId || totalAmount === undefined) {
    return res.status(400).json({
      error: { message: 'vendorId and totalAmount are required', code: 'VALIDATION_ERROR' },
    });
  }

  const order = await orderService.createOrder({
    customerId: req.user.id,
    vendorId,
    totalAmount,
  });

  res.status(201).json(order);
}

async function vendorResponse(req, res) {
  const { action } = req.body || {};

  const updated = await orderService.respondToOrder({
    orderId: req.params.id,
    vendorUserId: req.user.id,
    action,
  });

  res.status(200).json(updated);
}

async function getOrder(req, res) {
  const order = await orderService.getOrderWithHistory({
    orderId: req.params.id,
    requestingUserId: req.user.id,
    requestingRole: req.user.role,
  });

  res.status(200).json(order);
}

async function riderStatus(req, res) {
  const { status } = req.body || {};

  const updated = await orderService.updateRiderStatus({
    orderId: req.params.id,
    riderUserId: req.user.id,
    toStatus: status,
  });

  res.status(200).json(updated);
}

module.exports = { createOrder, vendorResponse, getOrder, riderStatus };