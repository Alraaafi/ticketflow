import { motion } from 'framer-motion';

/**
 * Renders rows x seats. Colours come from the event's categories.
 * mode="select": customers pick seats. mode="preview": read-only (organizer form).
 */
export default function SeatMap({ layout, categories, seats = [], selected = [], onToggle, myUserId, mode = 'select', type }) {
  const byLabel = new Map(seats.map((s) => [s.label, s]));
  const rows = Array.from({ length: layout.rows }, (_, i) => String.fromCharCode(65 + i));
  const catOf = (row) => categories.find((c) => row >= c.rowFrom?.toUpperCase() && row <= c.rowTo?.toUpperCase());
  const aisleAfter = type === 'TRANSPORT' && layout.seatsPerRow >= 4 ? Math.floor(layout.seatsPerRow / 2) : null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto w-max">
        <div className="mx-auto mb-6 h-2 w-3/4 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
        <p className="-mt-4 mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          {type === 'TRANSPORT' ? 'Front / Driver' : type === 'ROOM' ? 'Reception' : 'Stage'}
        </p>
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const cat = catOf(row);
            return (
              <div key={row} className="flex items-center gap-1.5">
                <span className="w-5 text-right text-xs font-bold text-slate-400">{row}</span>
                {Array.from({ length: layout.seatsPerRow }, (_, i) => {
                  const label = `${row}${i + 1}`;
                  const seat = byLabel.get(label);
                  const status = seat?.status || 'AVAILABLE';
                  const isSelected = selected.includes(label);
                  const mine = status === 'HELD' && myUserId && seat?.heldBy === myUserId;
                  const disabled = mode !== 'select' || (status !== 'AVAILABLE' && !isSelected);
                  let style = { backgroundColor: cat?.color || '#cbd5e1' };
                  let cls = 'text-white hover:scale-110 hover:shadow-md';
                  if (status === 'BOOKED') { style = {}; cls = 'bg-slate-300 text-slate-400 cursor-not-allowed'; }
                  else if (status === 'HELD') { style = {}; cls = mine ? 'bg-amber-400 text-white' : 'bg-amber-200 text-amber-600 cursor-not-allowed'; }
                  if (isSelected) { style = {}; cls = 'bg-slate-900 text-white ring-2 ring-indigo-400 ring-offset-1 scale-110'; }
                  return (
                    <span key={label} className="flex">
                      <motion.button
                        type="button"
                        layout
                        whileTap={{ scale: 0.85 }}
                        title={`${label} · ${cat?.name || ''} · ${status}`}
                        disabled={disabled}
                        onClick={() => onToggle?.(label)}
                        style={style}
                        className={`h-7 w-7 rounded-t-lg rounded-b-sm text-[9px] font-bold transition ${cls} ${mode !== 'select' ? 'cursor-default hover:scale-100' : ''}`}
                      >
                        {i + 1}
                      </motion.button>
                      {aisleAfter === i + 1 && <span className="w-5" />}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SeatLegend({ categories }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      {categories.map((c) => (
        <span key={c.name} className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: c.color }} /> {c.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-900" /> Selected</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-amber-200" /> Held</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-300" /> Booked</span>
    </div>
  );
}
