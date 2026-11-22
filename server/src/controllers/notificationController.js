module.exports = ({ notificationRepository }) => ({
  list: async (req, res) => {
    const [items, unread] = await Promise.all([
      notificationRepository.listByUser(req.user.id),
      notificationRepository.unreadCount(req.user.id),
    ]);
    res.json({ success: true, data: { items, unread } });
  },
  markRead: async (req, res) => {
    await notificationRepository.markRead(req.user.id, req.params.id);
    res.json({ success: true, data: { ok: true } });
  },
  markAllRead: async (req, res) => {
    await notificationRepository.markAllRead(req.user.id);
    res.json({ success: true, data: { ok: true } });
  },
});
