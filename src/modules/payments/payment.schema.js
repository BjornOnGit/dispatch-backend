const { z } = require('zod');

const webhookEventSchema = z.object({
  event_id: z.string().min(1).max(255),
  provider_reference: z.string().min(1).max(255),
  status: z.enum(['success', 'failed']),
});

module.exports = { webhookEventSchema };