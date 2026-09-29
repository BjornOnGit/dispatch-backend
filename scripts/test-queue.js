const { Worker } = require('bullmq');
const { dispatchQueue, connection, DISPATCH_QUEUE_NAME } = require('../src/lib/queue');

(async () => {
  let enqueuedAt;
  let worker;

  const done = new Promise((resolve, reject) => {
    worker = new Worker(
      DISPATCH_QUEUE_NAME,
      async (job) => {
        console.log(`Worker picked up job "${job.name}" with data:`, job.data);
        resolve(Date.now() - enqueuedAt);
      },
      { connection }
    );
    worker.on('failed', (job, err) => reject(err));
    setTimeout(() => reject(new Error('Timed out: job not picked up within 5s')), 5000);
  });

  try {
    // Exclude worker boot-up (connections, script loading) from the measurement
    await worker.waitUntilReady();

    enqueuedAt = Date.now();
    await dispatchQueue.add('test-job', { hello: 'world' });

    const elapsedMs = await done;
    console.log(`Picked up ${elapsedMs}ms after enqueue`);
    console.log(elapsedMs <= 1000 ? 'PASS' : 'SLOW (over 1s)');
    process.exitCode = elapsedMs <= 1000 ? 0 : 1;
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    await worker.close();
    await dispatchQueue.close();
  }
})();