const express = require('express');
const errorHandler = require('./middleware/error-handler');
const authRoutes = require('./modules/auth/auth.routes');
const orderRoutes = require('./modules/orders/order.routes');
const riderRoutes = require('./modules/riders/rider.routes');
const vendorRoutes = require('./modules/vendors/vendor.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const webhookRoutes = require('./modules/payments/webhook.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/riders', riderRoutes);
app.use('/vendors', vendorRoutes);
app.use('/orders', paymentRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/notifications', notificationRoutes);


app.use(errorHandler);

module.exports = app;