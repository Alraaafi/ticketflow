import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Eye, BarChart3, Calendar, MapPin, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../../lib/api';
import { dateTime, typeLabel } from '../../lib/format';
import { EmptyState, Modal, PageLoader, TypeIcon, EventImage } from '../../components/ui';

function StatBar({ stats }) {
  const total = stats.AVAILABLE + stats.HELD + stats.BOOKED || 1;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: pct(stats.BOOKED) }} />
        <div className="bg-amber-400" style={{ width: pct(stats.HELD) }} />
      </div>
      <p className="text-xs text-slate-500"><b className="text-emerald-600">{stats.BOOKED}</b> booked · <b className="text-amber-600">{stats.HELD}</b> held · {stats.AVAILABLE} free</p>
    </div>
  );
}

export default function Dashboard() {
  const [events, setEvents] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = () => api.get('/organizer/events').then((r) => setEvents(unwrap(r))).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const remove = async () => {
    try {
      await api.delete(`/events/${toDelete._id}`);
      toast.success('Event deleted');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
      setToDelete(null);
    }
  };

  if (!events) return <PageLoader />;
  const totals = events.reduce((a, e) => ({ booked: a.booked + e.stats.BOOKED, held: a.held + e.stats.HELD }), { booked: 0, held: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Organizer dashboard</h1>
          <p className="text-sm text-slate-500">You can only see and manage the events you created.</p>
        </div>
        <Link to="/organizer/events/new" className="btn-primary"><Plus size={16} /> New event</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[['Events', events.length, 'from-indigo-500 to-violet-500'], ['Seats booked', totals.booked, 'from-emerald-500 to-teal-500'], ['Seats on hold now', totals.held, 'from-amber-400 to-orange-500']].map(([label, value, g]) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-br ${g} p-5 text-white shadow-lg`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="No events yet" text="Create your first event with a seat map and prices." action={<Link to="/organizer/events/new" className="btn-primary">Create event</Link>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {events.map((e, i) => (
            <motion.div key={e._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card flex overflow-hidden">
              <EventImage event={e} className="hidden w-32 shrink-0 sm:flex" />
              <div className="flex-1 space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600"><TypeIcon type={e.type} size={13} /> {typeLabel(e.type)} · {e.pricing.strategy === 'EARLY_BIRD' ? 'Early-bird' : 'Base price'}</p>
                    <h3 className="font-bold text-slate-900">{e.title}</h3>
                  </div>
                  {new Date(e.startsAt) < new Date() && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">PAST</span>}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Calendar size={13} /> {dateTime(e.startsAt)}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> {e.venue.name}, {e.venue.city}</p>
                <StatBar stats={e.stats} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to={`/organizer/events/${e._id}`} className="btn-ghost px-3 py-1.5 text-xs"><BarChart3 size={14} /> Manage</Link>
                  <Link to={`/organizer/events/${e._id}/edit`} className="btn-ghost px-3 py-1.5 text-xs"><Pencil size={14} /> Edit</Link>
                  <Link to={`/events/${e._id}`} className="btn-ghost px-3 py-1.5 text-xs"><Eye size={14} /> View</Link>
                  <button onClick={() => setToDelete(e)} className="btn-ghost px-3 py-1.5 text-xs text-rose-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete event?">
        <p className="mb-4 text-sm text-slate-600">&quot;{toDelete?.title}&quot; will be removed. Events with held or booked seats cannot be deleted.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={remove}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}
