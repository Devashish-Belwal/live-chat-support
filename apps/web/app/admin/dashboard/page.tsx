"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Analytics, AnalyticsSupervisor, AdminAgent } from '@/lib/types';

export default function AdminAnalytics() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);

  const fetchData = () => {
    if (authLoading || !user || user?.role !== 'ADMIN') return;
    setLoading(true);
    api.getAnalytics()
      .then((r: Analytics) => { setData(r); setError(''); })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : 'Failed'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => { if (!authLoading && user?.role === 'ADMIN') fetchData(); }, [user, authLoading]);

  const supervisors: AnalyticsSupervisor[] = data?.supervisors || [];
  const agents: AdminAgent[] = data?.agents || [];
  const totalSupervisors = supervisors.length;
  const totalAgents = agents.length;
  const totalConversations = supervisors.reduce((s: number, x: AnalyticsSupervisor) => s + (x.conversationsHandled || 0), 0);
  const assignedAgents = agents.filter((a) => a.supervisorId !== null).length;
  const unassignedAgents = agents.filter((a) => a.supervisorId === null).length;

  const handleAssign = async (agentId: number, supervisorId: number | null) => {
    setPendingId(agentId);
    setError('');
    try {
      await api.assignAgentToSupervisor(agentId, supervisorId);
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally { setPendingId(null); }
  };

  return (
    <div>
      <header className="bg-indigo-900 text-white p-4 flex items-center justify-between">
        <div><h1 className="font-bold">Live Chat Support</h1><span className="text-xs opacity-80">Analytics</span></div>
        <div className="flex items-center gap-4 text-sm"><span>{user?.email || 'Admin'}</span><button onClick={logout} className="underline">Logout</button></div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Admin Analytics</h2>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {!loading && !error && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Supervisors</div><div className="text-2xl font-bold">{totalSupervisors}</div></div>
              <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Total Agents</div><div className="text-2xl font-bold">{totalAgents}</div></div>
              <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Assigned</div><div className="text-2xl font-bold">{assignedAgents}</div></div>
              <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Conversations</div><div className="text-2xl font-bold">{totalConversations}</div></div>
            </section>

            <section className="mb-8">
              <h3 className="font-semibold mb-3">Supervisor Overview</h3>
              {supervisors.length === 0 ? <div className="text-slate-500">No supervisor data.</div> : (
                <table className="w-full bg-white rounded-xl shadow overflow-hidden"><thead className="bg-slate-50"><tr><th className="text-left p-3 text-xs">Supervisor</th><th className="text-left p-3 text-xs">Agents</th><th className="text-left p-3 text-xs">Conversations</th></tr></thead>
                <tbody>
                  {supervisors.map((s: AnalyticsSupervisor) => (
                    <tr key={s.id} className="border-t"><td className="p-3 text-sm">{s.name || 'Unknown'}</td><td className="p-3 text-sm">{s.agentCount ?? 0}</td><td className="p-3 text-sm">{s.conversationsHandled ?? 0}</td></tr>
                  ))}
                </tbody></table>
              )}
            </section>

            <section className="mb-8">
              <h3 className="font-semibold mb-3">Agent Assignment</h3>
              <div className="text-xs text-slate-500 mb-3">Unassigned: {unassignedAgents}</div>
              {agents.length === 0 ? <div className="text-slate-500">No agents.</div> : (
                <table className="w-full bg-white rounded-xl shadow overflow-hidden"><thead className="bg-slate-50"><tr><th className="text-left p-3 text-xs">Agent</th><th className="text-left p-3 text-xs">Email</th><th className="text-left p-3 text-xs">Supervisor</th><th className="text-left p-3 text-xs">Action</th></tr></thead>
                <tbody>
                  {agents.map((a: AdminAgent) => {
                    const sup = supervisors.find((s: AnalyticsSupervisor) => s.id === a.supervisorId);
                    const supName = sup ? (sup.name || 'Unknown') : 'Unassigned';
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="p-3 text-sm">{a.name}</td>
                        <td className="p-3 text-sm">{a.email}</td>
                        <td className="p-3 text-sm">{supName}</td>
                        <td className="p-3 text-sm">
                          <select
                            disabled={pendingId === a.id}
                            className="border rounded px-2 py-1 text-xs bg-white"
                            value={a.supervisorId ?? ''}
                            onChange={e => handleAssign(a.id, e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Unassigned</option>
                            {supervisors.map((s: AnalyticsSupervisor) => (
                              <option key={s.id} value={s.id}>{s.name || 'Unknown'}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody></table>
              )}
            </section>

            <section>
              <h3 className="font-semibold mb-3">Conversation Status</h3>
              <div className="flex gap-4 text-sm text-slate-600"><span>Total: {totalConversations}</span><span>Active: —</span><span>Closed: —</span></div>
            </section>
          </>)}
      </main>
    </div>
  );
}
