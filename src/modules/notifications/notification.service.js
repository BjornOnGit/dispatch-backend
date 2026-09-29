const orderRepository = require('../orders/order.repository');
const vendorRepository = require('../vendors/vendor.repository');
const notificationRepository = require('./notification.repository');

// Called when every attempt to find a rider has failed. Tells the customer and
// the vendor so they can cancel the order themselves.
async function notifyRiderNotFound(orderId) {
  const order = await orderRepository.getOrderById(orderId);

  // Skip if the order moved on (assigned or cancelled) while retries were running
  if (!order || order.status !== 'vendor_accepted') return;

  const vendor = await vendorRepository.getVendorById(order.vendor_id);

  await notificationRepository.createNotification({
    userId: order.customer_id,
    orderId,
    type: 'no_rider_found',
    message: `We couldn't find a rider for order ${orderId}. Please cancel it and request a refund.`,
  });

  if (vendor) {
    await notificationRepository.createNotification({
      userId: vendor.user_id,
      orderId,
      type: 'no_rider_found',
      message: `No rider could be assigned to order ${orderId}. Please cancel it.`,
    });
  }
}

module.exports = { notifyRiderNotFound };