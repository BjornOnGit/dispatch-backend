const notificationRepository = require('./notification.repository');

async function listNotifications(req, res) {
  const notifications = await notificationRepository.listNotificationsForUser(req.user.id);
  res.status(200).json(notifications);
}

module.exports = { listNotifications };