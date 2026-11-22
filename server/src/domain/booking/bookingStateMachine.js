/**
 * State pattern (table-driven): the single source of truth for which booking
 * status changes are legal.
 *
 *   HELD ──► PENDING_PAYMENT ──► CONFIRMED ──► CANCELLED
 *     │            │
 *     ├──► EXPIRED ◄┘
 *     └──► CANCELLED ◄─ (PENDING_PAYMENT can also be cancelled)
 *
 * EXPIRED and CANCELLED are terminal.
 */
const AppError = require('../../utils/AppError');
const S = require('./BookingStatus');

const TRANSITIONS = Object.freeze({
  [S.HELD]: [S.PENDING_PAYMENT, S.EXPIRED, S.CANCELLED],
  [S.PENDING_PAYMENT]: [S.CONFIRMED, S.EXPIRED, S.CANCELLED],
  [S.CONFIRMED]: [S.CANCELLED],
  [S.EXPIRED]: [],
  [S.CANCELLED]: [],
});

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw AppError.conflict(`Booking cannot move from ${from} to ${to}`, 'INVALID_STATUS_TRANSITION', { from, to });
  }
}

/** Statuses from which a booking may reach `to` (used to build atomic DB filters). */
function allowedSourcesFor(to) {
  return Object.keys(TRANSITIONS).filter((from) => TRANSITIONS[from].includes(to));
}

function isTerminal(status) {
  return (TRANSITIONS[status] || []).length === 0;
}

module.exports = { TRANSITIONS, canTransition, assertTransition, allowedSourcesFor, isTerminal };
