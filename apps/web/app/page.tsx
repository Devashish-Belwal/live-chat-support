"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'CANDIDATE') router.replace('/candidate/dashboard');
    else if (user.role === 'AGENT') router.replace('/agent/dashboard');
    else if (user.role === 'SUPERVISOR') router.replace('/supervisor/dashboard');
    else if (user.role === 'ADMIN') router.replace('/admin/dashboard');
    else router.replace('/login');
  }, [user, loading, router]);
  return <div className="p-8">Redirecting...</div>;
}
