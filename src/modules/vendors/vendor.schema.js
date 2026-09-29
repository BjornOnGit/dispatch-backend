const { z } = require('zod');

// menu_items.price is DECIMAL(10,2)
const MAX_PRICE = 99999999.99;

const menuItemFields = {
  name: z.string().trim().min(1).max(255),
  price: z.number().nonnegative().max(MAX_PRICE),
};

const createMenuItemSchema = z.object(menuItemFields);

const updateMenuItemSchema = z
  .object(menuItemFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one of: name, price',
  });

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

module.exports = { createMenuItemSchema, updateMenuItemSchema, locationSchema };