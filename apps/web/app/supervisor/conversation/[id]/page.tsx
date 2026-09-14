"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Conversation } from '@/lib/types';

export default function SupervisorConversationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    api.getConversation(String(id)).then(setConv).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Failed'));
  }, [id, loading, user]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.back()} className="mb-3 text-sm">← Supervisor</button>
      <h2 className="text-xl font-bold mb-2">Conversation #{id}</h2>
      {err && <div className="text-red-600 mb-4">{err}</div>}
      {conv ? (
        <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
          <div className="text-xs">Candidate: {conv.candidateId}</div>
          <div className="text-xs">Agent: {conv.agentId ?? 'Unassigned'}</div>
          <div className="text-xs">Status: {conv.status}</div>
          <div className="text-xs">Created: {conv.createdAt}</div>
        </div>
      ) : <div>Loading...</div>}
    </div>
  );
}
