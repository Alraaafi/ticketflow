import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

/** Listens for per-user socket events (notifications, hold expiry) app-wide. */
export default function RealtimeBridge() {
  const token = useAuthStore((s) => s.token);
  const { load, push } = useNotificationStore();

  useEffect(() => {
    if (!token) return undefined;
    load();
    const socket = getSocket(token);
    const onNote = (n) => {
      push(n);
      toast(n.title, { icon: '🔔' });
    };
    socket.on('notification:new', onNote);
    return () => socket.off('notification:new', onNote);
  }, [token, load, push]);

  return null;
}
