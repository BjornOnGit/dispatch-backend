const riderService = require('./rider.service');

async function updateLocation(req, res) {
  const { lat, lon } = req.body;

  await riderService.updateLocation({
    riderId: req.params.id,
    requestingUserId: req.user.id,
    lat,
    lon,
  });

  res.status(200).json({ status: 'ok' });
}

async function setAvailability(req, res) {
  const { isAvailable } = req.body;

  await riderService.setAvailability({
    riderId: req.params.id,
    requestingUserId: req.user.id,
    isAvailable,
  });

  res.status(200).json({ status: 'ok', isAvailable });
}

module.exports = { updateLocation, setAvailability };