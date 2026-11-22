/**
 * Pure functions about seat holds, kept separate so they are trivial to unit test.
 */
function computeHoldExpiry(now, holdMinutes) {
  return new Date(now.getTime() + holdMinutes * 60 * 1000);
}

function isHoldExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

function secondsLeft(expiresAt, now = new Date()) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}

module.exports = { computeHoldExpiry, isHoldExpired, secondsLeft };
