import { create } from 'zustand';
import { api, unwrap } from '../lib/api';

export const useNotificationStore = create((set, get) => ({
  items: [],
  unread: 0,
  load: async () => {
    try {
      const data = unwrap(await api.get('/notifications'));
      set({ items: data.items, unread: data.unread });
    } catch {
      /* ignore */
    }
  },
  push: (n) => set({ items: [n, ...get().items].slice(0, 30), unread: get().unread + 1 }),
  markAllRead: async () => {
    set({ items: get().items.map((i) => ({ ...i, read: true })), unread: 0 });
    await api.patch('/notifications/read-all').catch(() => {});
  },
  reset: () => set({ items: [], unread: 0 }),
}));
