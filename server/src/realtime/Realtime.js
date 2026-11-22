const { Server } = require('socket.io');

/**
 * Socket.IO wrapper (bonus: real-time seat map).
 *  - room "event:<id>" : everyone looking at an event's seat map
 *  - room "user:<id>"  : a logged-in user's private notifications
 * Emitting before attach() is a no-op, which keeps unit tests simple.
 */
class Realtime {
  constructor({ authService, origins, logger }) {
    this.authService = authService;
    this.origins = origins;
    this.logger = logger;
    this.io = null;
  }

  attach(httpServer) {
    this.io = new Server(httpServer, { cors: { origin: this.origins, credentials: true } });
    this.io.on('connection', (socket) => {
      const token = socket.handshake.auth?.token;
      if (token) {
        try {
          const payload = this.authService.verifyToken(token);
          socket.join(`user:${payload.sub}`);
        } catch {
          /* anonymous viewer */
        }
      }
      socket.on('event:join', (eventId) => socket.join(`event:${eventId}`));
      socket.on('event:leave', (eventId) => socket.leave(`event:${eventId}`));
    });
    this.logger.info('Socket.IO ready');
  }

  toUser(userId, name, payload) {
    this.io?.to(`user:${userId}`).emit(name, payload);
  }

  toEvent(eventId, name, payload) {
    this.io?.to(`event:${eventId}`).emit(name, payload);
  }
}

module.exports = Realtime;
