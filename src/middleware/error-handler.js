// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // body-parser throws this for unparseable JSON; don't leak its internal message
  const isBadJson = err.type === 'entity.parse.failed';

  const status = isBadJson ? 400 : err.status || err.statusCode || 500;
  const code = isBadJson ? 'INVALID_JSON' : err.code || 'INTERNAL_ERROR';
  const message = isBadJson ? 'Malformed JSON body' : err.message || 'Something went wrong';

  console.error(err);

  res.status(status).json({
    error: {
      message,
      code,
    },
  });
}

module.exports = errorHandler;