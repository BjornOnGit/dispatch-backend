const { z } = require('zod');

const signupSchema = z
  .object({
    role: z.enum(['customer', 'vendor', 'rider']),
    name: z.string().trim().min(1).max(255),
    phone: z.string().trim().min(1).max(20),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(72),
    // Required for role: vendor
    businessName: z.string().trim().min(1).max(255).optional(),
    address: z.string().trim().min(1).max(255).optional(),
    // Required for role: rider
    vehicleType: z.string().trim().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'vendor') {
      if (!data.businessName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['businessName'], message: 'businessName is required for vendor signup' });
      }
      if (!data.address) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'address is required for vendor signup' });
      }
    }
    if (data.role === 'rider' && !data.vehicleType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vehicleType'], message: 'vehicleType is required for rider signup' });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

module.exports = { signupSchema, loginSchema };