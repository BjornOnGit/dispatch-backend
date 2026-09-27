const riderService = require('./rider.service');

async function updateLocation(req, res) {
  const { lat, lon } = req.body || {};

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return res.status(400).json({
      error: { message: 'lat and lon must be numbers', code: 'VALIDATION_ERROR' },
    });
  }

  await riderService.updateLocation({
    riderId: req.params.id,
    requestingUserId: req.user.id,
    lat,
    lon,
  });

  res.status(200).json({ status: 'ok' });
}

async function setAvailability(req, res) {
  const { isAvailable } = req.body || {};

  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({
      error: { message: 'isAvailable must be a boolean', code: 'VALIDATION_ERROR' },
    });
  }

  await riderService.setAvailability({
    riderId: req.params.id,
    requestingUserId: req.user.id,
    isAvailable,
  });

  res.status(200).json({ status: 'ok', isAvailable });
}

module.exports = { updateLocation, setAvailability };