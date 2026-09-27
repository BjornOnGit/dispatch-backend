const redis = require('../src/config/redis');

(async () => {
  try {
    await redis.set('ping', 'pong');
    const value = await redis.get('ping');
    console.log('Redis client OK:', value);
    process.exit(0);
  } catch (err) {
    console.error('Redis client FAILED:', err.message);
    process.exit(1);
  }
})();