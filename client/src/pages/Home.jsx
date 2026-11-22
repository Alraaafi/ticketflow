import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Ticket, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { EVENT_TYPES } from '../lib/format';
import EventCard from '../components/EventCard';
import { EmptyState, PageLoader, TypeIcon } from '../components/ui';

const FILTER_KEYS = ['q', 'city', 'type', 'from', 'to'];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    api.get('/events/cities').then((r) => setCities(unwrap(r))).catch(() => {});
  }, []);

  useEffect(() => {
    const query = { page, limit: 9 };
    FILTER_KEYS.forEach((k) => { if (params.get(k)) query[k] = params.get(k); });
    setLoading(true);
    api.get('/events', { params: query })
      .then((r) => setData(unwrap(r)))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [params, page]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500 px-6 py-12 text-white shadow-xl sm:px-12"
      >
        <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/3 h-60 w-60 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-pink-100">Concerts · Bus & Train · Rooms · Sports</p>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Pick your seat. <br />We hold it for you.</h1>
          <p className="mt-3 text-indigo-100">Choose a seat, it is held for 5 minutes just for you, pay with bKash, Nagad or card. Done.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}
            className="mt-6 flex gap-2 rounded-2xl bg-white p-2 shadow-2xl"
          >
            <div className="flex flex-1 items-center gap-2 px-2 text-slate-400">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, buses, resorts..." className="w-full bg-transparent py-2 text-slate-800 outline-none" />
            </div>
            <button className="btn-primary">Search</button>
          </form>
        </div>
      </motion.section>

      <section className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-2 self-center text-sm font-semibold text-slate-600"><Filter size={16} /> Filters</div>
        <div className="min-w-36 flex-1">
          <label className="label">City</label>
          <select className="input" value={params.get('city') || ''} onChange={(e) => update({ city: e.target.value })}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-36 flex-1">
          <label className="label">From date</label>
          <input type="date" className="input" value={params.get('from') || ''} onChange={(e) => update({ from: e.target.value })} />
        </div>
        <div className="min-w-36 flex-1">
          <label className="label">To date</label>
          <input type="date" className="input" value={params.get('to') || ''} onChange={(e) => update({ to: e.target.value ? `${e.target.value}T23:59:59` : '' })} />
        </div>
        {hasFilters && (
          <button className="btn-ghost" onClick={() => { setQ(''); setParams({}); }}><X size={16} /> Clear</button>
        )}
        <div className="flex w-full flex-wrap gap-2 pt-1">
          <button onClick={() => update({ type: '' })} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${!params.get('type') ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</button>
          {EVENT_TYPES.map((t) => (
            <button key={t.value} onClick={() => update({ type: t.value })} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${params.get('type') === t.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <TypeIcon type={t.value} size={14} /> {t.label}
            </button>
          ))}
        </div>
      </section>

      {loading && !data ? <PageLoader text="Loading events (the free server may need ~30s to wake up)..." /> : (
        <section className={loading ? 'opacity-60 transition' : 'transition'}>
          {data?.items.length === 0 ? (
            <EmptyState icon={Ticket} title="No events found" text="Try another search or clear the filters." />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-500"><b className="text-slate-800">{data?.total}</b> upcoming {data?.total === 1 ? 'event' : 'events'}</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data?.items.map((e, i) => <EventCard key={e._id} event={e} index={i} />)}
              </div>
              {data?.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button className="btn-ghost" disabled={page <= 1} onClick={() => update({ page: page - 1 })}><ChevronLeft size={16} /> Prev</button>
                  <span className="text-sm text-slate-600">Page {page} of {data.totalPages}</span>
                  <button className="btn-ghost" disabled={page >= data.totalPages} onClick={() => update({ page: page + 1 })}>Next <ChevronRight size={16} /></button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
