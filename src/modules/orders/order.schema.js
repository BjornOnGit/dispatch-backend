const { z } = require('zod');

// orders.total_amount is DECIMAL(10,2)
const MAX_AMOUNT = 99999999.99;

const createOrderSchema = z.object({
  vendorId: z.string().uuid(),
  totalAmount: z.number().positive().max(MAX_AMOUNT),
});

const vendorResponseSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

const riderStatusSchema = z.object({
  status: z.enum(['picked_up', 'delivered']),
});

module.exports = { createOrderSchema, vendorResponseSchema, riderStatusSchema };