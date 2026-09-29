// Turns a zod error into the API's standard error shape, with one entry per bad field.
function sendValidationError(res, zodError) {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : 'body',
    message: issue.message,
  }));

  return res.status(400).json({
    error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details },
  });
}

// Validates req.body against a zod schema. On success, req.body is replaced with
// the parsed data (trimmed strings, unknown keys stripped).
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body === undefined ? {} : req.body);

    if (!result.success) {
      return sendValidationError(res, result.error);
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validate, sendValidationError };