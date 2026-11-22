import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Zap, Users, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import { dateTime, taka, fromNow } from '../../lib/format';
import SeatMap, { SeatLegend } from '../../components/SeatMap';
import { PageLoader, StatusBadge } from '../../components/ui';

export default function EventManage() {
  const { id } = useParams();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState(null);
  const [seats, setSeats] = useState([]);

  useEffect(() => {
    const load = () => Promise.all([api.get(`/organizer/events/${id}`), api.get(`/events/${id}/seats`)])
      .then(([d, s]) => { setData(unwrap(d)); setSeats(unwrap(s)); })
      .catch((err) => toast.error(errorMessage(err)));
    load();
    const socket = getSocket(token);
    const join = () => socket.emit('event:join', id);
    join();
    socket.on('connect', join);
    const onSeats = ({ eventId }) => { if (eventId === id) load(); };
    socket.on('seats:updated', onSeats);
    return () => { socket.off('seats:updated', onSeats); socket.off('connect', join); socket.emit('event:leave', id); };
  }, [id, token]);

  if (!data) return <PageLoader />;
  const { event, stats, bookings, revenue } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/organizer" className="text-sm text-indigo-600">← Dashboard</Link>
          <h1 className="text-2xl font-extrabold text-slate-900">{event.title}</h1>
          <p className="text-sm text-slate-500">{dateTime(event.startsAt)} · {event.venue.name}, {event.venue.city}</p>
        </div>
        <Link to={`/organizer/events/${id}/edit`} className="btn-ghost"><Pencil size={16} /> Edit event</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Revenue (confirmed)</p><p className="flex items-center gap-1.5 text-2xl font-extrabold text-indigo-600"><Wallet size={18} />{taka(revenue)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Booked</p><p className="text-2xl font-extrabold text-emerald-600">{stats.BOOKED}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Held right now</p><p className="text-2xl font-extrabold text-amber-500">{stats.HELD}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Available</p><p className="text-2xl font-extrabold text-slate-700">{stats.AVAILABLE}</p></div>
      </div>

      <div className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Live seat map</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Zap size={13} /> Real-time</span>
        </div>
        <SeatLegend categories={event.categories} />
        <SeatMap layout={event.layout} categories={event.categories} seats={seats} mode="preview" type={event.type} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b p-5"><Users size={18} /><h2 className="font-bold">Bookings ({bookings.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Seats</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">When</th></tr>
            </thead>
            <tbody>
              {bookings.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No bookings yet</td></tr>}
              {bookings.map((b) => (
                <tr key={b._id} className="border-t">
                  <td className="px-5 py-3 font-mono text-xs">{b.code}</td>
                  <td className="px-5 py-3">{b.customer?.name}<p className="text-xs text-slate-400">{b.customer?.email}</p></td>
                  <td className="px-5 py-3">{b.seats.map((s) => s.label).join(', ')}</td>
                  <td className="px-5 py-3 font-semibold">{taka(b.pricing.total)}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fromNow(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
