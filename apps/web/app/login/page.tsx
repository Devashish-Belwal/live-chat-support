"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="max-w-md mx-auto mt-20 p-6 bg-white rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      <input className="w-full border rounded px-3 py-2 mb-3" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <div className="relative mb-3">
        <input type={show ? 'text' : 'password'} className="w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="button" className="absolute right-2 top-2 text-xs" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded font-medium">{loading ? 'Logging in...' : 'Login'}</button>
      <div className="mt-4 text-sm"><a href="/signup" className="text-indigo-600">Create account</a></div>
    </form>
  );
}
