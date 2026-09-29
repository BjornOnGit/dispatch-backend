const crypto = require('crypto');
const env = require('../../config/env');
const paymentService = require('./payment.service');
const { webhookEventSchema } = require('./payment.schema');
const { sendValidationError } = require('../../middleware/validate.middleware');

const SIGNATURE_HEADER = 'x-signature';

function isValidSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;

  const expected = crypto.createHmac('sha256', env.webhookSecret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signature);

  return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

async function handlePaymentWebhook(req, res) {
  const signature = req.headers[SIGNATURE_HEADER];

  // Signature first: an unauthenticated caller must never learn what the schema looks like
  if (!isValidSignature(req.rawBody, signature)) {
    return res.status(401).json({ error: { message: 'Invalid signature', code: 'INVALID_SIGNATURE' } });
  }

  const parsed = webhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const { event_id: eventId, provider_reference: providerReference, status } = parsed.data;

  const { duplicate } = await paymentService.processWebhookEvent({
    eventId,
    providerReference,
    status,
  });

  res.status(200).json({ received: true, duplicate });
}

module.exports = { handlePaymentWebhook };