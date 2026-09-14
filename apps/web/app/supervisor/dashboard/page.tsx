"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, SupervisorAgent } from "@/lib/api";
import { Conversation } from "@/lib/types";

export default function SupervisorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [list, setList] = useState<Conversation[]>([]);
  const [conversationsBusy, setConversationsBusy] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  const [agents, setAgents] = useState<SupervisorAgent[]>([]);
  const [agentsBusy, setAgentsBusy] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || user?.role !== "SUPERVISOR") return;
    setConversationsBusy(true);
      setConversationsError(null);
      api.getConversations()
        .then((conversations) => setList(conversations))
        .catch((e: unknown) => setConversationsError(e instanceof Error ? e.message : "Failed to load conversations"))
        .finally(() => setConversationsBusy(false));

      setAgentsBusy(true);
      setAgentsError(null);
      api.getSupervisorAgents()
        .then((agents) => setAgents(agents))
        .catch((e: unknown) => setAgentsError(e instanceof Error ? e.message : "Failed to load agents"))
        .finally(() => setAgentsBusy(false));
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "SUPERVISOR") router.replace("/login");
  }, [user, authLoading, router]);

  const handleAssign = useCallback(async (conversationId: number, agentId: number) => {
    if (assigningId !== null) return;
    setAssigningId(conversationId);
    setAssignError(null);
    try {
      const updated = await api.assignConversation(conversationId, agentId);
      setList((prev) => prev.map((c) => (c.id === conversationId ? updated : c)));
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setAssigningId(null);
    }
  }, [assigningId]);

  if (!user || user.role !== "SUPERVISOR") return null;

  const isAssignable = (c: Conversation) => c.status === "ACTIVE" && c.agentId === null;
  const agentName = (a: SupervisorAgent) => a.name || `Agent ${a.id}`;
  const conversationAgent = (c: Conversation) =>
    c.agent ? `${c.agent.name || "Agent " + c.agent.id}` : "Unassigned";

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Supervisor Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">Team conversations and assignments</p>

      {authLoading && <div className="mb-4 text-sm text-slate-500">Loading authentication...</div>}
      {conversationsBusy && <div className="mb-4 text-sm text-slate-500">Loading conversations...</div>}
      {agentsBusy && <div className="mb-4 text-sm text-slate-500">Loading agents...</div>}

      {conversationsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{conversationsError}</div>
      )}
      {agentsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{agentsError}</div>
      )}
      {assignError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{assignError}</div>
      )}

      {!agentsBusy && !agentsError && agents.length === 0 && (
        <div className="rounded-xl border bg-slate-50 px-6 py-12 text-center text-slate-500">No agents available for assignment.</div>
      )}

      {!conversationsBusy && !conversationsError && list.length === 0 ? (
        <div className="rounded-xl border bg-slate-50 px-6 py-12 text-center text-slate-500">No conversations visible.</div>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => {
            const active = c.status === "ACTIVE";
            return (
              <div key={c.id} className="bg-white border rounded-xl p-5 shadow-sm flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-base">Conversation #{c.id}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>Candidate: {c.candidateId}</div>
                    <div>Agent: {conversationAgent(c)}</div>
                    <div>Created: {new Date(c.createdAt).toLocaleString()}</div>
                    {c.closedAt && <div>Closed: {new Date(c.closedAt).toLocaleString()}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => router.push(`/supervisor/conversation/${c.id}`)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Open
                  </button>
                  {!agentsBusy && isAssignable(c) && (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue=""
                        disabled={assigningId === c.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return;
                          handleAssign(c.id, Number(val));
                        }}
                        className="text-xs border rounded px-2 py-1 bg-white disabled:opacity-50"
                      >
                        <option value="">Assign to...</option>
                        {agents.map((a) => (
                          <option key={a.id} value={String(a.id)}>{agentName(a)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>)}
    </div>
  );
}
