/** Plain enums with no DB/framework dependency, shared by models, services and tests. */
const SEAT_STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', HELD: 'HELD', BOOKED: 'BOOKED' });

const PAYMENT_STATUS = Object.freeze({ PROCESSING: 'PROCESSING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', REFUNDED: 'REFUNDED' });

const ROLES = Object.freeze({ ORGANIZER: 'ORGANIZER', CUSTOMER: 'CUSTOMER' });

const EVENT_TYPES = Object.freeze(['CONCERT', 'TRANSPORT', 'ROOM', 'SPORTS', 'THEATRE', 'CONFERENCE']);

module.exports = { SEAT_STATUS, PAYMENT_STATUS, ROLES, EVENT_TYPES };
