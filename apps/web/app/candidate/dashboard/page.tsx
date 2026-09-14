"use client";
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Conversation } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== 'CANDIDATE') router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || user?.role !== 'CANDIDATE') return;
    api.getConversations()
        .then((conversations: Conversation[]) => setList(conversations))
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Failed to load conversations');
          setList([]);
        });
  }, [user]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await api.createConversation();
      router.push(`/candidate/conversation/${c.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('ACTIVE_CONVERSATION_EXISTS')) {
        const updated = await api.getConversations();
        setList(updated);
        const active = updated.find((x) => x.status === 'ACTIVE');
        if (active) router.push(`/candidate/conversation/${active.id}`);
      } else {
        setError(msg || 'Failed to start conversation');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user || user.role !== 'CANDIDATE') return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Conversations</h1>
        <button onClick={start} disabled={busy} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Start Conversation</button>
      </div>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {list.length === 0 && !error && <div className="text-slate-500">No conversations yet.</div>}
      <div className="grid gap-3">
        {list.map((c) => (
          <div key={c.id} className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Conversation #{c.id}</div>
              <div className="text-xs text-slate-500">Agent: {c.agent?.name || c.agentId ? 'Assigned' : '—'} · {c.status}</div>
            </div>
            <button onClick={() => router.push(`/candidate/conversation/${c.id}`)} className="text-indigo-600 text-sm">Open</button>
          </div>
        ))}
      </div>
    </div>
  );
}
