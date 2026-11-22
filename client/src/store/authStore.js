import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Global auth state (persisted in localStorage). */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession: ({ user, token }) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'ticketflow-auth' },
  ),
);

export const useIsOrganizer = () => useAuthStore((s) => s.user?.role === 'ORGANIZER');
