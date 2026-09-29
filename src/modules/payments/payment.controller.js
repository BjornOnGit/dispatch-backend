const paymentService = require('./payment.service');

async function initiatePayment(req, res) {
  const payment = await paymentService.initiatePayment({
    orderId: req.params.id,
    requestingUserId: req.user.id,
  });

  res.status(201).json(payment);
}

module.exports = { initiatePayment };