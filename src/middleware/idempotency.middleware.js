const redis = require('../config/redis');

const TTL_SECONDS = 24 * 60 * 60; // 24h

async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return next();
  }

  const redisKey = `idempotency:${key}`;

  try {
    const cached = await redis.get(redisKey);

    if (cached) {
      const { status, body } = JSON.parse(cached);
      return res.status(status).json(body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      redis
        .set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
        .catch((err) => console.error('Failed to cache idempotent response:', err.message));
      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = idempotencyMiddleware;