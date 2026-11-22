import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, History, Receipt, ChevronRight, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { dateTime, taka, fromNow } from '../lib/format';
import { EmptyState, Modal, PageLoader, Spinner, StatusBadge, EventImage } from '../components/ui';

function Timeline({ history }) {
  return (
    <ol className="relative ml-2 space-y-3 border-l-2 border-slate-200 pl-5">
      {history.map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-100" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={h.to} />
            <span className="text-xs text-slate-400">{dateTime(h.at)}</span>
          </div>
          {h.reason && <p className="mt-0.5 text-xs text-slate-500">{h.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function MyBookings() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/bookings').then((r) => setData(unwrap(r))).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const askCancel = async (b) => {
    setCancelTarget(b);
    setPreview(null);
    try {
      setPreview(unwrap(await api.get(`/bookings/${b._id}/refund-preview`)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    try {
      const { refund } = unwrap(await api.post(`/bookings/${cancelTarget._id}/cancel`));
      toast.success(refund ? `Cancelled. Refund: ${taka(refund.refundAmount)}` : 'Hold released');
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">My bookings</h1>
        <p className="text-sm text-slate-500">Every booking keeps a full status history.</p>
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={Receipt} title="No bookings yet" text="Find something you like and grab a seat." action={<Link to="/" className="btn-primary">Browse events</Link>} />
      ) : (
        <div className="space-y-4">
          {data.items.map((b, i) => {
            const active = ['HELD', 'PENDING_PAYMENT'].includes(b.status) && new Date(b.expiresAt) > new Date();
            const canCancel = b.status === 'CONFIRMED' && new Date(b.event?.startsAt) > new Date();
            return (
              <motion.div key={b._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {b.event && <EventImage event={b.event} className="h-32 w-full sm:h-auto sm:w-44" />}
                  <div className="flex-1 space-y-2 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{b.code} · {fromNow(b.createdAt)}</p>
                        <h3 className="text-lg font-bold">{b.event?.title || 'Deleted event'}</h3>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    {b.event && (
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {dateTime(b.event.startsAt)}</span>
                        <span className="flex items-center gap-1.5"><MapPin size={14} /> {b.event.venue.name}, {b.event.venue.city}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-500">Seats:</span>
                      {b.seats.map((s) => <span key={s.label} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold">{s.label}</span>)}
                      <span className="ml-auto text-lg font-extrabold text-indigo-600">{taka(b.pricing.total)}</span>
                    </div>
                    {b.payment && <p className="text-xs text-slate-400">Paid via {b.payment.provider} · ref {b.payment.providerRef}</p>}
                    {b.refund?.reason && <p className="text-xs font-medium text-emerald-700">Refund {taka(b.refund.amount)}: {b.refund.reason}</p>}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button onClick={() => setOpen(open === b._id ? null : b._id)} className="btn-ghost py-1.5 text-xs"><History size={14} /> Status history</button>
                      {active && <Link to={`/checkout/${b._id}`} className="btn-primary py-1.5 text-xs">Continue payment <ChevronRight size={14} /></Link>}
                      {(active || canCancel) && <button onClick={() => askCancel(b)} className="btn-ghost py-1.5 text-xs text-rose-600"><XCircle size={14} /> {active ? 'Release hold' : 'Cancel booking'}</button>}
                    </div>
                    {open === b._id && <div className="pt-3"><Timeline history={b.statusHistory} /></div>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={`Cancel ${cancelTarget?.code}?`}>
        {!preview ? <Spinner /> : (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 ${preview.refundAmount > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              <p className="text-2xl font-extrabold">{taka(preview.refundAmount)} refund</p>
              <p className="text-sm">{preview.reason}</p>
            </div>
            <p className="text-xs text-slate-500">Rule: full refund if you cancel more than 24 hours before the event, otherwise no refund.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCancelTarget(null)}>Keep booking</button>
              <button className="btn-danger" disabled={busy} onClick={confirmCancel}>{busy && <Spinner />} Yes, cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
