/**
 * Refund rule: full refund when cancelled more than `fullRefundHours`
 * (default 24h) before the event starts, otherwise no refund.
 * Injected into BookingService, so a different policy can be swapped in.
 */
class RefundPolicy {
  constructor({ fullRefundHours = 24 } = {}) {
    this.fullRefundHours = fullRefundHours;
  }

  calculate({ amountPaid, eventStartsAt, cancelledAt = new Date() }) {
    const hoursBefore = (new Date(eventStartsAt).getTime() - cancelledAt.getTime()) / 36e5;
    const eligible = hoursBefore > this.fullRefundHours;
    return {
      refundAmount: eligible ? amountPaid : 0,
      refundPercent: eligible ? 100 : 0,
      reason: eligible
        ? `Cancelled more than ${this.fullRefundHours}h before the event: full refund`
        : `Cancelled within ${this.fullRefundHours}h of the event: no refund`,
    };
  }
}

module.exports = RefundPolicy;
