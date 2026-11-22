const S = require('../../src/domain/booking/BookingStatus');
const { canTransition, assertTransition, allowedSourcesFor, isTerminal } = require('../../src/domain/booking/bookingStateMachine');

describe('Booking status transitions', () => {
  test.each([
    [S.HELD, S.PENDING_PAYMENT],
    [S.HELD, S.EXPIRED],
    [S.HELD, S.CANCELLED],
    [S.PENDING_PAYMENT, S.CONFIRMED],
    [S.PENDING_PAYMENT, S.EXPIRED],
    [S.PENDING_PAYMENT, S.CANCELLED],
    [S.CONFIRMED, S.CANCELLED],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  test.each([
    [S.HELD, S.CONFIRMED], // cannot skip payment
    [S.CONFIRMED, S.EXPIRED], // paid booking never expires
    [S.CONFIRMED, S.HELD],
    [S.EXPIRED, S.CONFIRMED],
    [S.EXPIRED, S.HELD],
    [S.CANCELLED, S.CONFIRMED],
    [S.PENDING_PAYMENT, S.HELD],
  ])('rejects %s -> %s with a 409', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(expect.objectContaining({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' }));
  });

  test('EXPIRED and CANCELLED are terminal', () => {
    expect(isTerminal(S.EXPIRED)).toBe(true);
    expect(isTerminal(S.CANCELLED)).toBe(true);
    expect(isTerminal(S.HELD)).toBe(false);
  });

  test('lists the statuses that can reach CONFIRMED', () => {
    expect(allowedSourcesFor(S.CONFIRMED)).toEqual([S.PENDING_PAYMENT]);
  });

  test('unknown status cannot transition', () => {
    expect(canTransition('NOPE', S.HELD)).toBe(false);
  });
});
