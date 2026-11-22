/**
 * Interface every notification channel implements.
 * NotificationService depends on this abstraction, not on email/in-app details (DIP).
 */
class NotificationChannel {
  get name() {
    throw new Error('name getter must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async send(message) {
    throw new Error('send() must be implemented');
  }
}

module.exports = NotificationChannel;
