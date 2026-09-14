"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignup = async () => {
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.signup(email, password, name);
      localStorage.setItem('accessToken', res.accessToken);
      router.push('/login');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Signup failed';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-6">Sign Up</h1>
      <input className="w-full border rounded px-3 py-2 mb-3" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input className="w-full border rounded px-3 py-2 mb-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" className="w-full border rounded px-3 py-2 mb-3" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <input type="password" className="w-full border rounded px-3 py-2 mb-3" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button onClick={handleSignup} disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded font-medium">{loading ? 'Creating...' : 'Sign Up'}</button>
      <div className="mt-4 text-sm"><a href="/login" className="text-indigo-600">Back to login</a></div>
    </div>
  );
}
