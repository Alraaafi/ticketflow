const NotificationChannel = require('./NotificationChannel');

/** Saves the notification and pushes it live to the user's socket room. */
class InAppChannel extends NotificationChannel {
  constructor({ notificationRepository, realtime }) {
    super();
    this.repo = notificationRepository;
    this.realtime = realtime;
  }

  get name() { return 'in-app'; }

  async send({ user, type, title, message, data }) {
    const doc = await this.repo.create({ user: user._id, type, title, message, data });
    this.realtime?.toUser(String(user._id), 'notification:new', doc);
    return { delivered: true, id: doc._id };
  }
}

module.exports = InAppChannel;
