import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, User, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage, unwrap } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Spinner } from '../components/ui';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'CUSTOMER' });
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { ...form };
      if (!body.phone) delete body.phone;
      const session = unwrap(await api.post('/auth/register', body));
      setSession(session);
      toast.success('Account created!');
      navigate(session.user.role === 'ORGANIZER' ? '/organizer' : '/');
    } catch (err) {
      toast.error(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'CUSTOMER', label: 'I want to book', icon: User },
    { value: 'ORGANIZER', label: 'I organize events', icon: ShieldCheck },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Create account</h1>
          <p className="mt-1 text-sm text-slate-500">Choose your role. It decides what you can do.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => (
            <button type="button" key={r.value} onClick={() => setForm({ ...form, role: r.value })} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-semibold transition ${form.role === r.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
              <r.icon size={20} /> {r.label}
            </button>
          ))}
        </div>
        <div><label className="label">Full name</label><input required minLength={2} className="input" value={form.name} onChange={set('name')} /></div>
        <div><label className="label">Email</label><input type="email" required className="input" value={form.email} onChange={set('email')} /></div>
        <div><label className="label">Phone (optional)</label><input className="input" placeholder="01XXXXXXXXX" value={form.phone} onChange={set('phone')} /></div>
        <div><label className="label">Password</label><input type="password" required minLength={6} className="input" value={form.password} onChange={set('password')} /></div>
        <button disabled={loading} className="btn-primary w-full">{loading ? <Spinner /> : <UserPlus size={16} />} Create account</button>
        <p className="text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-indigo-600">Log in</Link></p>
      </form>
    </motion.div>
  );
}
