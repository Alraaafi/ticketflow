/** Thin controllers: HTTP in, service call, HTTP out. No business rules here (SRP). */
module.exports = ({ eventService }) => ({
  search: async (req, res) => {
    res.json({ success: true, data: await eventService.search(req.validatedQuery) });
  },
  cities: async (_req, res) => {
    res.json({ success: true, data: await eventService.cities() });
  },
  detail: async (req, res) => {
    res.json({ success: true, data: await eventService.getDetail(req.params.id) });
  },
  seats: async (req, res) => {
    res.json({ success: true, data: await eventService.seatMap(req.params.id) });
  },
  quote: async (req, res) => {
    res.json({ success: true, data: await eventService.quote(req.params.id, req.body.seats.map((s) => s.toUpperCase())) });
  },
  create: async (req, res) => {
    res.status(201).json({ success: true, data: await eventService.create(req.user, req.body) });
  },
  update: async (req, res) => {
    res.json({ success: true, data: await eventService.update(req.params.id, req.user, req.body) });
  },
  remove: async (req, res) => {
    await eventService.remove(req.params.id, req.user);
    res.json({ success: true, data: { deleted: true } });
  },
  uploadImage: async (req, res) => {
    res.json({ success: true, data: await eventService.uploadImage(req.params.id, req.user, req.file) });
  },
  mine: async (req, res) => {
    res.json({ success: true, data: await eventService.listMine(req.user) });
  },
  mineDetail: async (req, res) => {
    res.json({ success: true, data: await eventService.getMineDetail(req.params.id, req.user) });
  },
});
