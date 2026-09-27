const redis = require('../src/config/redis');
const { attemptAssignRider } = require('../src/modules/riders/dispatch.service');

const ORDER_ID = 'test-order-lock';

(async () => {
  try {
    await redis.del(`order:lock:${ORDER_ID}`);

    const [resultA, resultB] = await Promise.all([
      attemptAssignRider(ORDER_ID, 'rider-a'),
      attemptAssignRider(ORDER_ID, 'rider-b'),
    ]);

    console.log('rider-a succeeded:', resultA);
    console.log('rider-b succeeded:', resultB);

    const exactlyOneSucceeded = [resultA, resultB].filter(Boolean).length === 1;

    if (exactlyOneSucceeded) {
      console.log('PASS');
      process.exit(0);
    } else {
      console.log('FAIL');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test errored:', err.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
})();