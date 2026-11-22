import { useState } from 'react';
import { Bell } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotificationStore } from '../store/notificationStore';
import { fromNow } from '../lib/format';

export default function NotificationBell() {
  const { items, unread, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen(!open);
    if (!open && unread) markAllRead();
  };

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-lg p-2 text-indigo-100 hover:bg-white/10 hover:text-white" title="Notifications">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="card absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto p-2"
          >
            <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Notifications</p>
            {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-400">Nothing yet</p>}
            {items.map((n) => (
              <div key={n._id} className={`rounded-xl px-3 py-2.5 ${n.read ? '' : 'bg-indigo-50'}`}>
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{fromNow(n.createdAt)}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
