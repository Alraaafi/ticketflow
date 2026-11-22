import { useCallback, useEffect, useRef, useState } from 'react';
//hj
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Wallet, XCircle, Calendar, MapPin, Ticket, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { getSocket } from '../lib/socket';
import { dateTime, taka } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import Countdown from '../components/Countdown';
import { PageLoader, Spinner, StatusBadge, EmptyState } from '../components/ui';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const PROVIDER_STYLE = {
  bkash: { color: 'bg-pink-600', ring: 'ring-pink-500', icon: Wallet, hint: 'Any valid number works. 01700000000 simulates "insufficient balance".' },
  nagad: { color: 'bg-orange-500', ring: 'ring-orange-500', icon: Wallet, hint: 'Any valid 11-digit Bangladeshi number.' },
  card: { color: 'bg-slate-800', ring: 'ring-slate-700', icon: CreditCard, hint: 'Use 4242 4242 4242 4242. 4000 0000 0000 0002 is declined.' },
};

export default function Checkout() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [booking, setBooking] = useState(null);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('bkash');
  const [details, setDetails] = useState({ walletNumber: '01712345678', cardNumber: '4242 4242 4242 4242', cardName: '' });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  // One idempotency key per payment attempt. Re-sent unchanged if the network fails,
  // so the server can never charge twice for the same click.
  const idemKey = useRef(newKey());

  const load = useCallback(async () => {
    try {
      let b = unwrap(await api.get(`/bookings/${bookingId}`));
      if (b.status === 'HELD') b = { ...b, ...unwrap(await api.post(`/bookings/${bookingId}/checkout`)), event: b.event };
      setBooking(b);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [bookingId]);

  useEffect(() => {
    load();
    api.get('/payments/providers').then((r) => setProviders(unwrap(r))).catch(() => {});
  }, [load]);

  useEffect(() => {
    const socket = getSocket(token);
    const onExpired = ({ bookingId: id }) => {
      if (id === bookingId) {
        toast.error('Your hold expired and the seats were released');
        load();
      }
    };
    socket.on('booking:expired', onExpired);
    return () => socket.off('booking:expired', onExpired);
  }, [token, bookingId, load]);

  const pay = async () => {
    setPaying(true);
    try {
      const body = { provider, details: provider === 'card' ? { cardNumber: details.cardNumber, cardName: details.cardName } : { walletNumber: details.walletNumber } };
      const res = unwrap(await api.post(`/bookings/${bookingId}/pay`, body, { headers: { 'Idempotency-Key': idemKey.current } }));
      setBooking((b) => ({ ...b, ...res.booking, event: b.event, payment: res.payment }));
      toast.success('Payment successful. Booking confirmed!');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'PAYMENT_FAILED') idemKey.current = newKey(); // a real new attempt gets a new key
      toast.error(errorMessage(err, 'Payment failed'));
      if (code === 'HOLD_EXPIRED') load();
    } finally {
      setPaying(false);
    }
  };

  const release = async () => {
    try {
      await api.post(`/bookings/${bookingId}/cancel`);
      toast.success('Hold released');
      navigate(`/events/${booking.event._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error) return <EmptyState icon={Ticket} title="Booking not found" text={error} action={<Link to="/" className="btn-primary">Browse events</Link>} />;
  if (!booking) return <PageLoader text="Preparing checkout..." />;

  const { event } = booking;
  const summary = (
    <div className="card space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking {booking.code}</p>
          <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-slate-600"><Calendar size={15} /> {dateTime(event.startsAt)}</p>
      <p className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={15} /> {event.venue.name}, {event.venue.city}</p>
      <div className="space-y-1.5 border-t border-dashed pt-3 text-sm">
        {booking.seats.map((s) => (
          <div key={s.label} className="flex justify-between text-slate-600"><span>Seat <b>{s.label}</b> · {s.category}</span><span>{taka(s.price)}</span></div>
        ))}
        {booking.pricing.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Early-bird discount</span><span>-{taka(booking.pricing.discount)}</span></div>}
        <div className="flex justify-between pt-2 text-lg font-extrabold"><span>Total</span><span className="text-indigo-600">{taka(booking.pricing.total)}</span></div>
      </div>
    </div>
  );

  if (booking.status === 'CONFIRMED') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg space-y-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="mx-auto w-fit rounded-full bg-emerald-100 p-4 text-emerald-600">
          <CheckCircle2 size={48} />
        </motion.div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">You&apos;re going!</h1>
          <p className="mt-1 text-slate-500">A confirmation was sent by email and in-app notification.</p>
        </div>
        <div className="text-left">{summary}</div>
        <div className="flex justify-center gap-3">
          <Link to="/bookings" className="btn-primary">My bookings</Link>
          <Link to="/" className="btn-ghost">Browse more</Link>
        </div>
      </motion.div>
    );
  }

  if (['EXPIRED', 'CANCELLED'].includes(booking.status)) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="mx-auto w-fit rounded-full bg-rose-100 p-4 text-rose-600"><XCircle size={48} /></div>
        <h1 className="text-2xl font-extrabold">This booking is {booking.status.toLowerCase()}</h1>
        <p className="text-slate-500">The seats were released. You can pick seats again.</p>
        <Link to={`/events/${event._id}`} className="btn-primary">Pick seats again</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-extrabold">Complete your payment</h1>
            <p className="text-sm text-slate-500">Your seats are held only for you until the timer ends.</p>
          </div>
          {booking.expiresAt && <Countdown expiresAt={booking.expiresAt} onExpire={() => setTimeout(load, 1500)} />}
        </div>

        <div className="card space-y-5 p-6">
          <h2 className="font-bold">Payment method</h2>
          <div className="grid grid-cols-3 gap-3">
            {providers.map((p) => {
              const st = PROVIDER_STYLE[p.id] || PROVIDER_STYLE.card;
              const Icon = st.icon;
              return (
                <button key={p.id} onClick={() => setProvider(p.id)} className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-semibold transition ${provider === p.id ? `border-transparent ring-2 ${st.ring} bg-slate-50` : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className={`rounded-xl p-2 text-white ${st.color}`}><Icon size={18} /></span>
                  {p.name}
                </button>
              );
            })}
          </div>

          {provider === 'card' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label">Card number</label><input className="input font-mono" value={details.cardNumber} onChange={(e) => setDetails({ ...details, cardNumber: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Name on card</label><input className="input" value={details.cardName} onChange={(e) => setDetails({ ...details, cardName: e.target.value })} /></div>
            </div>
          ) : (
            <div><label className="label">{provider === 'bkash' ? 'bKash' : 'Nagad'} wallet number</label><input className="input font-mono" value={details.walletNumber} onChange={(e) => setDetails({ ...details, walletNumber: e.target.value })} /></div>
          )}
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">🧪 Test mode. {PROVIDER_STYLE[provider]?.hint}</p>

          <button disabled={paying} onClick={pay} className="btn-primary w-full py-3 text-base">
            {paying ? <Spinner /> : <CreditCard size={18} />} Pay {taka(booking.pricing.total)}
          </button>
          <button onClick={release} className="btn-ghost w-full"><Undo2 size={16} /> Release seats</button>
        </div>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">{summary}</aside>
    </div>
  );
}
