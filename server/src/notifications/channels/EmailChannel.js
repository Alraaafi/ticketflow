const NotificationChannel = require('./NotificationChannel');

/** Mock email: writes the email to the log (allowed by the brief). Swap for SMTP later. */
class EmailChannel extends NotificationChannel {
  constructor({ logger }) {
    super();
    this.logger = logger;
  }

  get name() { return 'email'; }

  async send({ user, title, message }) {
    this.logger.info({ to: user.email, subject: title }, `[EMAIL] To: ${user.email} | ${title} | ${message}`);
    return { delivered: true };
  }
}

module.exports = EmailChannel;
