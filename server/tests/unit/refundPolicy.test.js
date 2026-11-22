const RefundPolicy = require('../../src/domain/refund/RefundPolicy');

describe('RefundPolicy (full refund if > 24h before event, else none)', () => {
  const policy = new RefundPolicy();
  const eventStartsAt = new Date('2030-06-10T18:00:00Z');
  const at = (hoursBefore) => new Date(eventStartsAt.getTime() - hoursBefore * 36e5);

  test('full refund 48h before', () => {
    expect(policy.calculate({ amountPaid: 3000, eventStartsAt, cancelledAt: at(48) })).toMatchObject({ refundAmount: 3000, refundPercent: 100 });
  });

  test('full refund 24h + 1 minute before', () => {
    expect(policy.calculate({ amountPaid: 3000, eventStartsAt, cancelledAt: at(24 + 1 / 60) }).refundAmount).toBe(3000);
  });

  test('no refund exactly 24h before (boundary)', () => {
    expect(policy.calculate({ amountPaid: 3000, eventStartsAt, cancelledAt: at(24) })).toMatchObject({ refundAmount: 0, refundPercent: 0 });
  });

  test('no refund 2h before', () => {
    const r = policy.calculate({ amountPaid: 3000, eventStartsAt, cancelledAt: at(2) });
    expect(r.refundAmount).toBe(0);
    expect(r.reason).toMatch(/no refund/);
  });

  test('threshold is configurable', () => {
    const p = new RefundPolicy({ fullRefundHours: 72 });
    expect(p.calculate({ amountPaid: 100, eventStartsAt, cancelledAt: at(48) }).refundAmount).toBe(0);
  });
});
