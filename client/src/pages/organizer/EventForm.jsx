import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, Upload, Sparkles, Tag, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../../lib/api';
import { EVENT_TYPES, toInputDateTime } from '../../lib/format';
import SeatMap, { SeatLegend } from '../../components/SeatMap';
import { PageLoader, Spinner } from '../../components/ui';

const BD_CITIES = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh', "Cox's Bazar", 'Cumilla', 'Gazipur'];
const COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#0ea5e9', '#f43f5e', '#6366f1'];
const letter = (i) => String.fromCharCode(65 + i);

const EMPTY = {
  title: '', description: '', type: 'CONCERT',
  venue: { name: '', address: '', city: 'Dhaka' },
  startsAt: '',
  imageUrl: '',
  layout: { rows: 6, seatsPerRow: 10 },
  categories: [
    { name: 'VIP', price: 2000, color: '#f59e0b', rowFrom: 'A', rowTo: 'B' },
    { name: 'General', price: 800, color: '#10b981', rowFrom: 'C', rowTo: 'F' },
  ],
  pricing: { strategy: 'BASE', earlyBirdDiscountPercent: 15, earlyBirdEndsAt: '' },
  isPublished: true,
};

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.get(`/organizer/events/${id}`).then((r) => {
      const e = unwrap(r).event;
      const f = {
        title: e.title, description: e.description, type: e.type, venue: { address: '', ...e.venue }, startsAt: toInputDateTime(e.startsAt),
        imageUrl: e.imageUrl, layout: e.layout, categories: e.categories, isPublished: e.isPublished,
        pricing: { strategy: e.pricing.strategy, earlyBirdDiscountPercent: e.pricing.earlyBirdDiscountPercent || 15, earlyBirdEndsAt: toInputDateTime(e.pricing.earlyBirdEndsAt) },
      };
      setForm(f);
      setOriginal(f);
    }).catch((err) => toast.error(errorMessage(err))).finally(() => setLoading(false));
  }, [id, editing]);

  const set = (path, value) => setForm((f) => {
    const next = structuredClone(f);
    const keys = path.split('.');
    keys.slice(0, -1).reduce((o, k) => o[k], next)[keys.at(-1)] = value;
    return next;
  });

  const setCat = (i, key, value) => setForm((f) => ({ ...f, categories: f.categories.map((c, j) => (j === i ? { ...c, [key]: value } : c)) }));
  const addCat = () => setForm((f) => {
    const last = letter(f.layout.rows - 1);
    return { ...f, categories: [...f.categories, { name: `Zone ${f.categories.length + 1}`, price: 500, color: COLORS[f.categories.length % COLORS.length], rowFrom: last, rowTo: last }] };
  });
  const removeCat = (i) => setForm((f) => ({ ...f, categories: f.categories.filter((_, j) => j !== i) }));

  const rowOptions = useMemo(() => Array.from({ length: Number(form.layout.rows) || 1 }, (_, i) => letter(i)), [form.layout.rows]);

  const coverageError = useMemo(() => {
    const count = new Array(Number(form.layout.rows) || 0).fill(0);
    form.categories.forEach((c) => {
      for (let r = c.rowFrom.charCodeAt(0) - 65; r <= c.rowTo.charCodeAt(0) - 65; r += 1) if (r < count.length) count[r] += 1;
    });
    const missing = count.map((n, i) => (n === 0 ? letter(i) : null)).filter(Boolean);
    const dup = count.map((n, i) => (n > 1 ? letter(i) : null)).filter(Boolean);
    if (missing.length) return `Rows without a category: ${missing.join(', ')}`;
    if (dup.length) return `Rows in more than one category: ${dup.join(', ')}`;
    return null;
  }, [form.layout.rows, form.categories]);

  const submit = async (e) => {
    e.preventDefault();
    if (coverageError) { toast.error(coverageError); return; }
    setSaving(true);
    const body = {
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      layout: { rows: Number(form.layout.rows), seatsPerRow: Number(form.layout.seatsPerRow) },
      categories: form.categories.map((c) => ({ ...c, price: Number(c.price) })),
      pricing: form.pricing.strategy === 'EARLY_BIRD'
        ? { strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: Number(form.pricing.earlyBirdDiscountPercent), earlyBirdEndsAt: form.pricing.earlyBirdEndsAt ? new Date(form.pricing.earlyBirdEndsAt).toISOString() : undefined }
        : { strategy: 'BASE' },
    };
    if (!body.imageUrl) delete body.imageUrl;
    if (editing && original && JSON.stringify(original.layout) === JSON.stringify(form.layout) && JSON.stringify(original.categories) === JSON.stringify(form.categories)) {
      delete body.layout; // unchanged seat map: do not touch seats
      delete body.categories;
    }
    try {
      const saved = unwrap(editing ? await api.patch(`/events/${id}`, body) : await api.post('/events', body));
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        await api.post(`/events/${saved._id}/image`, fd).catch((err) => toast.error(`Saved, but image upload failed: ${errorMessage(err)}`));
      }
      toast.success(editing ? 'Event updated' : 'Event created');
      navigate('/organizer');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save event'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{editing ? 'Edit event' : 'Create event'}</h1>
        <button disabled={saving} className="btn-primary">{saving ? <Spinner /> : <Save size={16} />} {editing ? 'Save changes' : 'Publish event'}</button>
      </div>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Basics</h2>
        <div className="sm:col-span-2"><label className="label">Title</label><input required minLength={3} className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Dhaka → Sylhet AC Bus, Fri night" /></div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>{EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </div>
        <div><label className="label">Date & time</label><input required type="datetime-local" className="input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={3} className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">Venue</h2>
        <div><label className="label">Venue name</label><input required className="input" value={form.venue.name} onChange={(e) => set('venue.name', e.target.value)} /></div>
        <div><label className="label">Address / area</label><input className="input" value={form.venue.address} onChange={(e) => set('venue.address', e.target.value)} /></div>
        <div>
          <label className="label">City</label>
          <input required list="bd-cities" className="input" value={form.venue.city} onChange={(e) => set('venue.city', e.target.value)} />
          <datalist id="bd-cities">{BD_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-bold"><ImageIcon size={18} /> Cover image</h2>
        <div className="flex flex-wrap items-center gap-4">
          {(file || form.imageUrl) && <img src={file ? URL.createObjectURL(file) : form.imageUrl} alt="" className="h-24 w-40 rounded-xl object-cover" />}
          <label className="btn-ghost cursor-pointer"><Upload size={16} /> {file ? file.name : 'Upload image (Cloudinary)'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <span className="text-xs text-slate-400">or paste a URL:</span>
          <input className="input max-w-xs flex-1" placeholder="https://..." value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Seat map & categories</h2>
          {editing && <p className="text-xs text-amber-600">The seat map is locked once any seat is held or booked.</p>}
        </div>
        <div className="grid max-w-sm grid-cols-2 gap-4">
          <div><label className="label">Rows (max 26)</label><input type="number" min={1} max={26} className="input" value={form.layout.rows} onChange={(e) => set('layout.rows', Math.min(26, Math.max(1, Number(e.target.value))))} /></div>
          <div><label className="label">Seats per row (max 40)</label><input type="number" min={1} max={40} className="input" value={form.layout.seatsPerRow} onChange={(e) => set('layout.seatsPerRow', Math.min(40, Math.max(1, Number(e.target.value))))} /></div>
        </div>
        <div className="space-y-3">
          {form.categories.map((c, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.5fr_1fr_70px_80px_80px_40px]">
              <div><label className="label"><Tag size={11} className="inline" /> Category</label><input required className="input" value={c.name} onChange={(e) => setCat(i, 'name', e.target.value)} /></div>
              <div><label className="label">Price (৳)</label><input required type="number" min={0} className="input" value={c.price} onChange={(e) => setCat(i, 'price', e.target.value)} /></div>
              <div><label className="label">Colour</label><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-200" value={c.color} onChange={(e) => setCat(i, 'color', e.target.value)} /></div>
              <div><label className="label">From row</label><select className="input" value={c.rowFrom} onChange={(e) => setCat(i, 'rowFrom', e.target.value)}>{rowOptions.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label className="label">To row</label><select className="input" value={c.rowTo} onChange={(e) => setCat(i, 'rowTo', e.target.value)}>{rowOptions.map((r) => <option key={r}>{r}</option>)}</select></div>
              <button type="button" disabled={form.categories.length === 1} onClick={() => removeCat(i)} className="btn-ghost h-10 px-2 text-rose-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={addCat} className="btn-ghost"><Plus size={16} /> Add category</button>
          {coverageError && <p className="text-sm font-medium text-rose-600">{coverageError}</p>}
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Live preview · {form.layout.rows * form.layout.seatsPerRow} seats</p>
          <SeatLegend categories={form.categories} />
          <div className="mt-4"><SeatMap layout={form.layout} categories={form.categories} mode="preview" type={form.type} /></div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Pricing strategy</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { v: 'BASE', t: 'Base price', d: 'Every seat costs its category price.' },
            { v: 'EARLY_BIRD', t: 'Early-bird', d: 'A % discount on the whole order until a date.' },
          ].map((o) => (
            <button type="button" key={o.v} onClick={() => set('pricing.strategy', o.v)} className={`rounded-2xl border-2 p-4 text-left transition ${form.pricing.strategy === o.v ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
              <p className="flex items-center gap-1.5 font-semibold">{o.v === 'EARLY_BIRD' && <Sparkles size={15} className="text-amber-500" />}{o.t}</p>
              <p className="text-sm text-slate-500">{o.d}</p>
            </button>
          ))}
        </div>
        {form.pricing.strategy === 'EARLY_BIRD' && (
          <div className="grid max-w-lg grid-cols-2 gap-4">
            <div><label className="label">Discount %</label><input required type="number" min={1} max={90} className="input" value={form.pricing.earlyBirdDiscountPercent} onChange={(e) => set('pricing.earlyBirdDiscountPercent', e.target.value)} /></div>
            <div><label className="label">Ends at</label><input required type="datetime-local" className="input" value={form.pricing.earlyBirdEndsAt} onChange={(e) => set('pricing.earlyBirdEndsAt', e.target.value)} /></div>
          </div>
        )}
      </section>
    </form>
  );
}
