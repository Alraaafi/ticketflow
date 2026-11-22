import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Ticket, LogOut, LayoutDashboard, Menu, X, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const resetNotes = useNotificationStore((s) => s.reset);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = () => {
    logout();
    resetNotes();
    toast.success('Logged out');
    navigate('/');
  };

  const link = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-indigo-100 hover:text-white'}`;

  const links = (
    <>
      <NavLink to="/" end className={link} onClick={() => setOpen(false)}>Browse</NavLink>
      {user?.role === 'CUSTOMER' && <NavLink to="/bookings" className={link} onClick={() => setOpen(false)}><span className="inline-flex items-center gap-1.5"><Receipt size={15} /> My Bookings</span></NavLink>}
      {user?.role === 'ORGANIZER' && <NavLink to="/organizer" className={link} onClick={() => setOpen(false)}><span className="inline-flex items-center gap-1.5"><LayoutDashboard size={15} /> Dashboard</span></NavLink>}
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 shadow-lg">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-white">
          <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 p-1.5"><Ticket size={20} /></span>
          Ticket<span className="text-pink-400">Flow</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">{links}</div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-white">{user.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-pink-300">{user.role}</p>
              </div>
              <button onClick={onLogout} className="rounded-lg p-2 text-indigo-100 hover:bg-white/10 hover:text-white" title="Log out"><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-100 hover:text-white">Log in</Link>
              <Link to="/register" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Sign up</Link>
            </>
          )}
          <button className="rounded-lg p-2 text-white md:hidden" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </nav>
      {open && <div className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 md:hidden">{links}</div>}
    </header>
  );
}
