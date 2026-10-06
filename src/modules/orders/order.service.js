const orderRepository = require('./order.repository');
const { isValidTransition } = require('./order.state-machine');
const HttpError = require('../../lib/http-error');
const dispatchService = require('../riders/dispatch.service');
const { scheduleOrderTimeout } = require('../../lib/queue');

const ACTION_TO_STATUS = {
  accept: 'vendor_accepted',
  reject: 'cancelled',
};

async function createOrder({ customerId, vendorId, totalAmount }) {
  return orderRepository.createOrder({ customerId, vendorId, totalAmount });
}

async function respondToOrder({ orderId, vendorUserId, action }) {
  const targetStatus = ACTION_TO_STATUS[action];
  if (!targetStatus) {
    throw new HttpError(400, "action must be 'accept' or 'reject'", 'VALIDATION_ERROR');
  }

  const vendorId = await orderRepository.getVendorIdByUserId(vendorUserId);
  if (!vendorId) {
    throw new HttpError(403, 'No vendor profile for this account', 'FORBIDDEN');
  }

  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }

  if (order.vendor_id !== vendorId) {
    throw new HttpError(403, 'You do not own this order', 'FORBIDDEN');
  }

  if (!isValidTransition(order.status, targetStatus)) {
    throw new HttpError(
      409,
      `Cannot transition from ${order.status} to ${targetStatus}`,
      'INVALID_TRANSITION'
    );
  }

  const updated = await orderRepository.updateOrderStatus(orderId, targetStatus);

  if (targetStatus === 'vendor_accepted') {
    await scheduleOrderTimeout(orderId);

    const vendorLocation = await orderRepository.getVendorLocationById(vendorId);

    if (vendorLocation && vendorLocation.lat !== null && vendorLocation.lon !== null) {
      await dispatchService.dispatchOrder(orderId, vendorLocation.lat, vendorLocation.lon);
      // dispatchOrder may have just moved the order to rider_assigned — re-fetch so the
      // response reflects that instead of the stale vendor_accepted snapshot above.
      return orderRepository.getOrderById(orderId);
    }

    console.log(`[dispatch] vendor ${vendorId} has no location set, skipping auto-dispatch`);
  }

  return updated;
}

async function isOwner(order, requestingUserId, requestingRole) {
  if (requestingRole === 'customer') {
    return order.customer_id === requestingUserId;
  }
  if (requestingRole === 'vendor') {
    const vendorId = await orderRepository.getVendorIdByUserId(requestingUserId);
    return vendorId !== null && vendorId === order.vendor_id;
  }
  if (requestingRole === 'rider') {
    const riderId = await orderRepository.getRiderIdByUserId(requestingUserId);
    return riderId !== null && riderId === order.rider_id;
  }
  return false;
}

async function getOrderWithHistory({ orderId, requestingUserId, requestingRole }) {
  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }

  const owner = await isOwner(order, requestingUserId, requestingRole);
  if (!owner) {
    throw new HttpError(403, 'You do not have access to this order', 'FORBIDDEN');
  }

  const history = await orderRepository.getOrderHistory(orderId);
  return { ...order, history };
}

const RIDER_ALLOWED_STATUSES = ['picked_up', 'delivered'];

async function updateRiderStatus({ orderId, riderUserId, toStatus }) {
  if (!RIDER_ALLOWED_STATUSES.includes(toStatus)) {
    throw new HttpError(400, `status must be one of: ${RIDER_ALLOWED_STATUSES.join(', ')}`, 'VALIDATION_ERROR');
  }

  const riderId = await orderRepository.getRiderIdByUserId(riderUserId);
  if (!riderId) {
    throw new HttpError(403, 'No rider profile for this account', 'FORBIDDEN');
  }

  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }

  if (order.rider_id !== riderId) {
    throw new HttpError(403, 'You are not the assigned rider for this order', 'FORBIDDEN');
  }

  if (!isValidTransition(order.status, toStatus)) {
    throw new HttpError(409, `Cannot transition from ${order.status} to ${toStatus}`, 'INVALID_TRANSITION');
  }

  const updated = await orderRepository.updateOrderStatus(orderId, toStatus);

  if (toStatus === 'delivered') {
    await dispatchService.releaseRider(riderId);
  }

  return updated;
}

async function cancelOrder({ orderId, customerId }) {
  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }

  if (order.customer_id !== customerId) {
    throw new HttpError(403, 'You do not own this order', 'FORBIDDEN');
  }

  if (!isValidTransition(order.status, 'cancelled')) {
    throw new HttpError(409, `Cannot cancel an order that is ${order.status}`, 'INVALID_TRANSITION');
  }

  const updated = await orderRepository.updateOrderStatus(orderId, 'cancelled');

  // If a rider was already assigned, free them up for other orders
  if (order.rider_id) {
    await dispatchService.releaseRider(order.rider_id);
  }

  return updated;
}

module.exports = { createOrder, respondToOrder, getOrderWithHistory, updateRiderStatus, cancelOrder };