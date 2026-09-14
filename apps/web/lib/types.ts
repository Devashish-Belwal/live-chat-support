export type Role = 'CANDIDATE' | 'AGENT' | 'SUPERVISOR' | 'ADMIN';
export interface User { id: number; email: string; role: Role; name?: string; }
export interface Conversation {
  id: number;
  candidateId: number;
  agentId?: number | null;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
  closedAt?: string | null;
  agent?: { id: number; name?: string; email?: string } | null;
  messages?: { id?: number; conversationId?: number; senderId?: number; senderRole?: string; content: string; createdAt?: string }[];
}
export interface Message {
  id?: number;
  conversationId?: number;
  senderId?: number;
  senderRole?: string;
  content: string;
  createdAt?: string;
}

export interface AnalyticsSupervisor { id: number; name: string; agentCount: number; conversationsHandled: number; agents?: AdminAgent[]; }
export interface AdminAgent { id: number; name: string; email: string; supervisorId: number | null; }
export interface SupervisorAgent { id: number; name: string; email: string; supervisorId: number | null; }

export interface Analytics { supervisors: AnalyticsSupervisor[]; agents?: AdminAgent[]; }
