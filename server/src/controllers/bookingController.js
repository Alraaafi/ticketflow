module.exports = ({ bookingService, providerRegistry }) => ({
  providers: (_req, res) => {
    res.json({ success: true, data: providerRegistry.list() });
  },
  hold: async (req, res) => {
    res.status(201).json({ success: true, data: await bookingService.holdSeats(req.user, req.body) });
  },
  checkout: async (req, res) => {
    res.json({ success: true, data: await bookingService.checkout(req.user, req.params.id) });
  },
  pay: async (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');
    const result = await bookingService.pay(req.user, req.params.id, { ...req.body, idempotencyKey });
    res.status(result.replayed ? 200 : 201).json({ success: true, data: result });
  },
  cancel: async (req, res) => {
    res.json({ success: true, data: await bookingService.cancel(req.user, req.params.id) });
  },
  refundPreview: async (req, res) => {
    res.json({ success: true, data: await bookingService.refundPreview(req.user, req.params.id) });
  },
  mine: async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    res.json({ success: true, data: await bookingService.listMine(req.user, { page, limit: 20 }) });
  },
  one: async (req, res) => {
    res.json({ success: true, data: await bookingService.getOne(req.user, req.params.id) });
  },
});
