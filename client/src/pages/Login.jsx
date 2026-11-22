import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, ShieldCheck, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Spinner } from '../components/ui';

const DEMO = [
  { role: 'Customer', email: 'customer@ticketflow.com', password: 'Customer@123', icon: User },
  { role: 'Organizer', email: 'organizer@ticketflow.com', password: 'Organizer@123', icon: ShieldCheck },
];

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (creds = form) => {
    setLoading(true);
    try {
      const session = unwrap(await api.post('/auth/login', creds));
      setSession(session);
      toast.success(`Welcome back, ${session.user.name}!`);
      const dest = location.state?.from || (session.user.role === 'ORGANIZER' ? '/organizer' : '/');
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Log in</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Book seats or manage your events.</p>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button disabled={loading} className="btn-primary w-full">{loading ? <Spinner /> : <LogIn size={16} />} Log in</button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /> or use a demo account <span className="h-px flex-1 bg-slate-200" /></div>
        <div className="grid grid-cols-2 gap-3">
          {DEMO.map((d) => (
            <button key={d.role} disabled={loading} onClick={() => { setForm(d); submit(d); }} className="btn-ghost flex-col py-3">
              <d.icon size={18} className="text-indigo-500" />
              <span>Demo {d.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">No account? <Link to="/register" className="font-semibold text-indigo-600">Sign up</Link></p>
      </div>
    </motion.div>
  );
}
