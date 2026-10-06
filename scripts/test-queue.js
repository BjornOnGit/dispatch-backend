const { Queue, Worker } = require('bullmq');
const { connection } = require('../src/lib/queue');

// Uses its own disposable queue, not the real app's dispatch-queue/timeout-queue,
// so it never competes with the actual worker:timeout / worker:reassignment
// processes for jobs if they happen to be running at the same time.
const TEST_QUEUE_NAME = `test-queue-diagnostic-${Date.now()}`;
const testQueue = new Queue(TEST_QUEUE_NAME, { connection });

(async () => {
  let enqueuedAt;
  let worker;
  let timer;

  const done = new Promise((resolve, reject) => {
    worker = new Worker(
      TEST_QUEUE_NAME,
      async (job) => {
        console.log(`Worker picked up job "${job.name}" with data:`, job.data);
        resolve(Date.now() - enqueuedAt);
      },
      { connection }
    );
    worker.on('failed', (job, err) => reject(err));
    worker.on('error', (err) => reject(err));
    timer = setTimeout(() => reject(new Error('Timed out: job not picked up within 5s')), 5000);
  });

  try {
    await worker.waitUntilReady();

    enqueuedAt = Date.now();
    await testQueue.add('test-job', { hello: 'world' });

    const elapsedMs = await done;
    console.log(`Picked up ${elapsedMs}ms after enqueue`);
    console.log(elapsedMs <= 1000 ? 'PASS' : 'SLOW (over 1s)');
    process.exitCode = elapsedMs <= 1000 ? 0 : 1;
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    await worker.close();
    await testQueue.obliterate({ force: true }); // deletes the disposable queue entirely
    process.exit(process.exitCode);
  }
})();