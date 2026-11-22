import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { EventImage, TypeIcon } from './ui';
import { dateTime, taka, typeLabel } from '../lib/format';

export default function EventCard({ event, index = 0 }) {
  const minPrice = Math.min(...event.categories.map((c) => c.price));
  const earlyBird = event.pricing?.strategy === 'EARLY_BIRD' && new Date(event.pricing.earlyBirdEndsAt) > new Date();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link to={`/events/${event._id}`} className="card group block overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
        <div className="relative">
          <EventImage event={event} className="h-44 w-full transition duration-500 group-hover:scale-105" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
            <TypeIcon type={event.type} size={13} /> {typeLabel(event.type)}
          </span>
          {earlyBird && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950">
              <Sparkles size={12} /> {event.pricing.earlyBirdDiscountPercent}% early-bird
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-indigo-600">{event.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Calendar size={14} /> {dateTime(event.startsAt)}</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} /> {event.venue.name}, {event.venue.city}</p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">from</span>
            <span className="text-lg font-extrabold text-indigo-600">{taka(minPrice)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
