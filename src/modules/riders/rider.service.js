const redis = require('../../config/redis');
const riderRepository = require('./rider.repository');
const HttpError = require('../../lib/http-error');

const LOCATIONS_KEY = 'riders:locations';
const AVAILABLE_KEY = 'riders:available';

async function updateLocation({ riderId, requestingUserId, lat, lon }) {
  const rider = await riderRepository.getRiderById(riderId);
  if (!rider) {
    throw new HttpError(404, 'Rider not found', 'NOT_FOUND');
  }

  if (rider.user_id !== requestingUserId) {
    throw new HttpError(403, 'You do not own this rider profile', 'FORBIDDEN');
  }

  await redis.geoadd(LOCATIONS_KEY, lon, lat, riderId);
}

async function setAvailability({ riderId, requestingUserId, isAvailable }) {
  const rider = await riderRepository.getRiderById(riderId);
  if (!rider) {
    throw new HttpError(404, 'Rider not found', 'NOT_FOUND');
  }

  if (rider.user_id !== requestingUserId) {
    throw new HttpError(403, 'You do not own this rider profile', 'FORBIDDEN');
  }

  await riderRepository.updateAvailability(riderId, isAvailable);

  if (isAvailable) {
    await redis.sadd(AVAILABLE_KEY, riderId);
  } else {
    await redis.srem(AVAILABLE_KEY, riderId);
  }
}

module.exports = { updateLocation, setAvailability };