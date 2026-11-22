const { Notification } = require('../models/Notification');

class NotificationRepository {
  create(data) {
    return Notification.create(data);
  }

  listByUser(userId, limit = 30) {
    return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  unreadCount(userId) {
    return Notification.countDocuments({ user: userId, read: false });
  }

  markRead(userId, id) {
    return Notification.updateOne({ _id: id, user: userId }, { $set: { read: true } });
  }

  markAllRead(userId) {
    return Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
  }
}

module.exports = NotificationRepository;
