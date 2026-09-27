// Wraps an async route handler so rejected promises are passed to next(err),
// since Express 4 doesn't do this automatically.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;