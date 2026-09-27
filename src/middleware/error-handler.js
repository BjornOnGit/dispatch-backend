// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong';

  console.error(err);

  res.status(status).json({
    error: {
      message,
      code,
    },
  });
}

module.exports = errorHandler;