module.exports = ({ authService }) => ({
  register: async (req, res) => {
    const { user, token } = await authService.register(req.body);
    res.status(201).json({ success: true, data: { user, token } });
  },
  login: async (req, res) => {
    const { user, token } = await authService.login(req.body);
    res.json({ success: true, data: { user, token } });
  },
  me: async (req, res) => {
    res.json({ success: true, data: await authService.me(req.user.id) });
  },
});
