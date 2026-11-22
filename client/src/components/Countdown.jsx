import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/** Live countdown to the hold expiry. Calls onExpire once when it hits zero. */
export default function Countdown({ expiresAt, onExpire }) {
  const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => {
      const v = calc();
      setLeft(v);
      if (v === 0) {
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const danger = left <= 60;
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-lg font-bold ${danger ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
      <Clock size={18} /> {mm}:{ss}
    </div>
  );
}
