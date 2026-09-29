const redis = require('../../config/redis');
const orderRepository = require('../orders/order.repository');
const riderRepository = require('./rider.repository');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';
const lockKey = (orderId) => `order:lock:${orderId}`;

async function findNearestAvailableRiders(lat, lon, radiusKm) {
  const results = await redis.geosearch(
    LOCATIONS_KEY,
    'FROMLONLAT',
    lon,
    lat,
    'BYRADIUS',
    radiusKm,
    'km',
    'ASC',
    'WITHDIST'
  );

  if (results.length === 0) return [];

  const riderIds = results.map(([riderId]) => riderId);
  const availableFlags = await redis.smismember(AVAILABLE_KEY, riderIds);

  return results
    .filter((_, index) => availableFlags[index] === 1)
    .map(([riderId, distanceKm]) => ({ riderId, distanceKm: parseFloat(distanceKm) }));
}

const LOCK_TTL_SECONDS = 10;

async function attemptAssignRider(orderId, riderId) {
  const result = await redis.set(lockKey(orderId), riderId, 'EX', LOCK_TTL_SECONDS, 'NX');
  return result === 'OK';
}

const DEFAULT_RADIUS_KM = 5;

// Runs when an order reaches vendor_accepted: finds nearest available riders,
// tries to lock the top candidate, falls through the ranked list until one
// locks successfully (or none do).
async function dispatchOrder(orderId, lat, lon, radiusKm = DEFAULT_RADIUS_KM) {
  const candidates = await findNearestAvailableRiders(lat, lon, radiusKm);

  for (const candidate of candidates) {
    const locked = await attemptAssignRider(orderId, candidate.riderId);
    if (!locked) continue;

    // SREM returns 1 only for the caller that actually removed the rider, so two
    // orders dispatching at the same moment can't both claim the same rider.
    const claimed = await redis.srem(AVAILABLE_KEY, candidate.riderId);
    if (claimed !== 1) {
      await redis.del(lockKey(orderId));
      continue;
    }

    try {
      await orderRepository.assignRiderToOrder(orderId, candidate.riderId);
    } catch (err) {
      // Put the rider back so a failed DB write doesn't strand them as "busy"
      await redis.sadd(AVAILABLE_KEY, candidate.riderId);
      await redis.del(lockKey(orderId));
      throw err;
    }

    return { assigned: true, riderId: candidate.riderId };
  }

  console.log(`[dispatch] no rider found for order ${orderId}`);
  return { assigned: false };
}

// Called when a rider finishes an order. Only puts them back in the pool if
// they haven't switched themselves offline in the meantime (riders.is_available).
async function releaseRider(riderId) {
  const rider = await riderRepository.getRiderById(riderId);
  if (rider && rider.is_available) {
    await redis.sadd(AVAILABLE_KEY, riderId);
  }
}

module.exports = {
  findNearestAvailableRiders,
  attemptAssignRider,
  dispatchOrder,
  releaseRider,
};