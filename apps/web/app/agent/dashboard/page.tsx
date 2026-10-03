"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Conversation } from '@/lib/types';

export default function AgentDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== 'AGENT') router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'AGENT') {
      api.getConversations()
        .then((conversations: Conversation[]) => {
          setList(conversations);
          setError(null);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Failed to load conversations');
          setList([]);
        })
        .finally(() => setBusy(false));
    }
  }, [user]);

  if (loading) return <div className="max-w-5xl mx-auto p-6">Loading...</div>;
  if (!user || user.role !== 'AGENT') return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agent Dashboard</h1>
        <span className="text-sm text-slate-500">Agent Queue</span>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {busy && <div className="mb-4 text-sm text-slate-500">Loading conversations...</div>}

      {!busy && list.length === 0 && !error && <div className="rounded-xl border bg-slate-50 px-6 py-12 text-center text-slate-500">No assigned conversations.</div>}

      {list.length > 0 && (
        <div className="grid gap-3">
          {list.map((c) => {
            const active = c.status === 'ACTIVE';
            return (
              <div key={c.id} className="bg-white border rounded-xl p-5 shadow-sm flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-base">Conversation #{c.id}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>Candidate: {c.candidateId}</div>
                    <div>Agent: {c.agent?.name || c.agentId ? 'Assigned' : '—'}</div>
                    <div>Created: {new Date(c.createdAt).toLocaleString()}</div>
                    {c.closedAt && <div>Closed: {new Date(c.closedAt).toLocaleString()}</div>}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/agent/conversation/${c.id}`)}
                  className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
