const redis = require('../../config/redis');
const orderRepository = require('../orders/order.repository');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';

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
  const result = await redis.set(
    `order:lock:${orderId}`,
    riderId,
    'EX',
    LOCK_TTL_SECONDS,
    'NX'
  );
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
    if (locked) {
      await orderRepository.assignRiderToOrder(orderId, candidate.riderId);
      return { assigned: true, riderId: candidate.riderId };
    }
  }

  console.log(`[dispatch] no rider found for order ${orderId}`);
  return { assigned: false };
}

module.exports = { findNearestAvailableRiders, attemptAssignRider, dispatchOrder };