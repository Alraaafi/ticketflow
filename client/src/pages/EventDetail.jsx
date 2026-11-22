import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Sparkles, Ticket, Zap, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { getSocket } from '../lib/socket';
import { dateTime, taka, typeLabel } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import SeatMap, { SeatLegend } from '../components/SeatMap';
import { EventImage, PageLoader, Spinner, TypeIcon, EmptyState } from '../components/ui';

const MAX_SEATS = 10;

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [quote, setQuote] = useState(null);
  const [holding, setHolding] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const myIdRef = useRef(user?._id);
  myIdRef.current = user?._id;

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setData(unwrap(r))).catch((err) => setError(errorMessage(err)));
  }, [id]);

  // Real-time seat map: other people's holds/bookings appear instantly.
  useEffect(() => {
    const socket = getSocket(token);
    const join = () => socket.emit('event:join', id);
    join();
    socket.on('connect', join);
    const onSeats = ({ eventId, seats }) => {
      if (eventId !== id) return;
      const map = new Map(seats.map((s) => [s.label, s]));
      setData((d) => (d ? { ...d, seats: d.seats.map((s) => ({ ...s, ...(map.get(s.label) || {}) })) } : d));
      const lost = selectedRef.current.filter((l) => map.get(l) && map.get(l).status !== 'AVAILABLE' && map.get(l).heldBy !== myIdRef.current);
      if (lost.length) {
        setSelected((sel) => sel.filter((l) => !lost.includes(l)));
        toast.error(`Seat ${lost.join(', ')} was just taken by someone else`);
      }
    };
    socket.on('seats:updated', onSeats);
    return () => {
      socket.emit('event:leave', id);
      socket.off('seats:updated', onSeats);
      socket.off('connect', join);
    };
  }, [id, token]);

  // Live price quote from the server (pricing strategy lives on the backend).
  useEffect(() => {
    if (!selected.length) { setQuote(null); return undefined; }
    const t = setTimeout(() => {
      api.post(`/events/${id}/quote`, { seats: selected }).then((r) => setQuote(unwrap(r))).catch(() => setQuote(null));
    }, 200);
    return () => clearTimeout(t);
  }, [selected, id]);

  const toggle = (label) => {
    setSelected((sel) => {
      if (sel.includes(label)) return sel.filter((l) => l !== label);
      if (sel.length >= MAX_SEATS) { toast.error(`Max ${MAX_SEATS} seats per booking`); return sel; }
      return [...sel, label];
    });
  };

  const hold = async () => {
    if (!user) { navigate('/login', { state: { from: `/events/${id}` } }); return; }
    setHolding(true);
    try {
      const booking = unwrap(await api.post('/bookings/hold', { eventId: id, seats: selected }));
      toast.success('Seats held for you!');
      navigate(`/checkout/${booking._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      const taken = err.response?.data?.error?.details?.seats;
      if (taken) setSelected((sel) => sel.filter((l) => !taken.includes(l)));
    } finally {
      setHolding(false);
    }
  };

  if (error) return <EmptyState icon={Ticket} title="Event not available" text={error} action={<Link className="btn-primary" to="/">Back to events</Link>} />;
  if (!data) return <PageLoader />;
  const { event, seats } = data;
  const available = seats.filter((s) => s.status === 'AVAILABLE').length;
  const earlyBird = event.pricing?.strategy === 'EARLY_BIRD' && new Date(event.pricing.earlyBirdEndsAt) > new Date();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card overflow-hidden">
          <EventImage event={event} className="h-56 w-full sm:h-72" />
          <div className="space-y-3 p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><TypeIcon type={event.type} size={13} /> {typeLabel(event.type)}</span>
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{event.title}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Calendar size={16} className="text-indigo-500" /> {dateTime(event.startsAt)}</span>
              <span className="flex items-center gap-1.5"><MapPin size={16} className="text-indigo-500" /> {event.venue.name}{event.venue.address ? `, ${event.venue.address}` : ''}, {event.venue.city}</span>
            </div>
            {event.description && <p className="text-sm leading-relaxed text-slate-600">{event.description}</p>}
            {earlyBird && (
              <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                <Sparkles size={16} /> Early-bird: {event.pricing.earlyBirdDiscountPercent}% off until {dateTime(event.pricing.earlyBirdEndsAt)}
              </p>
            )}
          </div>
        </motion.div>

        <div className="card space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Choose your {event.type === 'ROOM' ? 'room' : 'seat'}</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Zap size={13} /> Live · {available} available</span>
          </div>
          <SeatLegend categories={event.categories} />
          <SeatMap layout={event.layout} categories={event.categories} seats={seats} selected={selected} onToggle={toggle} myUserId={user?._id} type={event.type} />
          <div className="flex flex-wrap gap-2">
            {event.categories.map((c) => (
              <span key={c.name} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                <b style={{ color: c.color }}>{c.name}</b> · rows {c.rowFrom}–{c.rowTo} · {taka(c.price)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-4 p-6">
          <h3 className="text-lg font-bold">Your selection</h3>
          {selected.length === 0 ? (
            <p className="text-sm text-slate-500">Tap seats on the map to select up to {MAX_SEATS}.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selected.map((l) => (
                <button key={l} onClick={() => toggle(l)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-600" title="Remove">{l} ×</button>
              ))}
            </div>
          )}
          {quote && (
            <div className="space-y-1.5 border-t border-dashed pt-4 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{taka(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Early-bird discount</span><span>-{taka(quote.discount)}</span></div>}
              <div className="flex justify-between pt-1 text-lg font-extrabold"><span>Total</span><span className="text-indigo-600">{taka(quote.total)}</span></div>
            </div>
          )}
          {user?.role === 'ORGANIZER' ? (
            <p className="flex gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-800"><Info size={16} className="shrink-0" /> You are logged in as an organizer. Log in as a customer to book.</p>
          ) : (
            <button disabled={!selected.length || holding} onClick={hold} className="btn-primary w-full py-3">
              {holding ? <Spinner /> : <Ticket size={16} />} {user ? `Hold ${selected.length || ''} seat${selected.length === 1 ? '' : 's'} for 5 min` : 'Log in to book'}
            </button>
          )}
          <p className="text-center text-[11px] text-slate-400">Held seats are reserved only for you until the timer ends.</p>
        </div>
      </aside>
    </div>
  );
}
