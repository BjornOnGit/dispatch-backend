const { z } = require('zod');

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

module.exports = { locationSchema, availabilitySchema };