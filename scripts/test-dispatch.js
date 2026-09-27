const redis = require('../src/config/redis');
const { findNearestAvailableRiders } = require('../src/modules/riders/dispatch.service');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';

// Centered near Lagos Island; rider-near < rider-mid < rider-far by distance.
// rider-unavailable is closest of all but excluded via availability.
const RIDERS = [
  { id: 'rider-unavailable', lon: 3.3900, lat: 6.4550, available: false },
  { id: 'rider-near', lon: 3.3950, lat: 6.4600, available: true },
  { id: 'rider-mid', lon: 3.4200, lat: 6.4700, available: true },
  { id: 'rider-far', lon: 3.5000, lat: 6.5200, available: true },
];

const ORIGIN = { lat: 6.4541, lon: 3.3947 }; // near rider-unavailable / rider-near

(async () => {
  try {
    await redis.del(LOCATIONS_KEY, AVAILABLE_KEY);

    for (const rider of RIDERS) {
      await redis.geoadd(LOCATIONS_KEY, rider.lon, rider.lat, rider.id);
      if (rider.available) {
        await redis.sadd(AVAILABLE_KEY, rider.id);
      }
    }

    const results = await findNearestAvailableRiders(ORIGIN.lat, ORIGIN.lon, 50);
    console.log('Results:', results);

    const ids = results.map((r) => r.riderId);
    const excludesUnavailable = !ids.includes('rider-unavailable');
    const orderedByDistance = results.every(
      (r, i) => i === 0 || results[i - 1].distanceKm <= r.distanceKm
    );
    const hasAllAvailable = ['rider-near', 'rider-mid', 'rider-far'].every((id) => ids.includes(id));

    if (excludesUnavailable && orderedByDistance && hasAllAvailable) {
      console.log('PASS');
      process.exit(0);
    } else {
      console.log('FAIL', { excludesUnavailable, orderedByDistance, hasAllAvailable });
      process.exit(1);
    }
  } catch (err) {
    console.error('Test errored:', err.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
})();