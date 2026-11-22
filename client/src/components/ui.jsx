import { Loader2, Music, Bus, BedDouble, Trophy, Drama, Mic2 } from 'lucide-react';

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={18} />;
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      {Icon && <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-500"><Icon size={28} /></div>}
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {text && <p className="max-w-md text-sm text-slate-500">{text}</p>}
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  HELD: 'bg-amber-100 text-amber-700',
  PENDING_PAYMENT: 'bg-sky-100 text-sky-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  EXPIRED: 'bg-slate-200 text-slate-600',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${STATUS_STYLES[status] || 'bg-slate-100'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

const TYPE_ICONS = { CONCERT: Music, TRANSPORT: Bus, ROOM: BedDouble, SPORTS: Trophy, THEATRE: Drama, CONFERENCE: Mic2 };
const TYPE_GRADIENTS = {
  CONCERT: 'from-fuchsia-500 to-indigo-600',
  TRANSPORT: 'from-sky-500 to-emerald-500',
  ROOM: 'from-emerald-500 to-teal-600',
  SPORTS: 'from-amber-500 to-rose-500',
  THEATRE: 'from-rose-500 to-purple-600',
  CONFERENCE: 'from-indigo-500 to-cyan-500',
};

export function TypeIcon({ type, size = 16, className = '' }) {
  const Icon = TYPE_ICONS[type] || Music;
  return <Icon size={size} className={className} />;
}

/** Event image with a graceful gradient fallback when the image is missing or broken. */
export function EventImage({ event, className = '' }) {
  const fallback = (
    <div className={`flex items-center justify-center bg-gradient-to-br ${TYPE_GRADIENTS[event.type] || TYPE_GRADIENTS.CONCERT} ${className}`}>
      <TypeIcon type={event.type} size={48} className="text-white/80" />
    </div>
  );
  if (!event.imageUrl) return fallback;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${TYPE_GRADIENTS[event.type] || ''} ${className}`}>
      <img
        src={event.imageUrl}
        alt={event.title}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
