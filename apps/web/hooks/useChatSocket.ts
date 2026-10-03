import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/api';

export interface Message {
  conversationId?: number | string;
  senderId?: number | string;
  senderRole?: string;
  content: string;
  createdAt?: string;
  id?: number;
}

export interface Conversation {
  id: number;
  candidateId: number;
  agentId?: number | null;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
  closedAt?: string | null;
  agent?: { id: number; name?: string; email?: string } | null;
  messages?: Message[];
}

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');

export function useChatSocket() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<(convId?: number | string) => void>(() => {});

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    setConnected(false);
    setJoined(false);
  }, []);

  const connect = useCallback((convId?: number | string) => {
    console.log("[CHAT-DEBUG] HOOK connect ENTRY", Date.now(), "convId=", convId);
    cleanup();
    const token = getAccessToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }
    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(url);
      
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setError(null);
        setReconnecting(false);
        if (convId && conversation?.status !== 'CLOSED') {
          ws.send(JSON.stringify({ event: 'JOIN_CONVERSATION', data: { conversationId: Number(convId) } }));
        }
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (!msg || typeof msg !== 'object') return;
          const ev = msg.event as string;
          if (ev === 'CONNECTED') {
            // auth success
          } else if (ev === 'JOINED_CONVERSATION') {
            setJoined(true);
            if (msg.data && Array.isArray(msg.data.messages)) {
              setMessages(msg.data.messages);
            }
            if (msg.data && msg.data.conversationId != null) {
              // keep conversation id aligned
            }
          } else if (ev === 'NEW_MESSAGE') {
            if (msg.data) {
              setMessages((prev) => {
                const exists = prev.find((m) => (m.id != null && msg.data.id != null && m.id === msg.data.id) || (m.content === msg.data.content && m.createdAt === msg.data.createdAt));
                if (exists) return prev;
                return [...prev, msg.data as Message];
              });
            }
          } else if (ev === 'CONVERSATION_CLOSED') {
            setConversation((c) => c ? { ...c, status: 'CLOSED' } : c);
            setJoined(false);
            reconnectRef.current = () => {};
            if (reconnectTimer.current) {
              clearTimeout(reconnectTimer.current);
              reconnectTimer.current = null;
            }
            cleanup();
          } else if (ev === 'LEFT_CONVERSATION') {
            setJoined(false);
          } else if (ev === 'ERROR') {
            const msgData = msg.data as { message?: string } | undefined;
            if (msgData && msgData.message) setError(msgData.message);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        setConnected(false);
        setJoined(false);
        if (convId && wsRef.current === ws) {
          setReconnecting(true);
          reconnectRef.current(convId);
        }
      };
      ws.onerror = () => {
        setConnected(false);
        setError('WebSocket error');
      };
    } catch {
      setError('Failed to connect');
    }
  }, [cleanup, reconnectRef, conversation]);

  const reconnect = useCallback((convId?: number | string) => {
    reconnectTimer.current = setTimeout(() => {
      connect(convId);
    }, 2000);
  }, [connect]);

  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  const joinConversation = useCallback((convId: number | string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'JOIN_CONVERSATION', data: { conversationId: Number(convId) } }));
    }
  }, []);

  const sendMessage = useCallback((convId: number | string, content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ event: 'SEND_MESSAGE', data: { conversationId: Number(convId), content } }));
  }, []);

  const closeConversation = useCallback((convId: number | string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'CLOSE_CONVERSATION', data: { conversationId: Number(convId) } }));
    }
  }, []);

  const leaveConversation = useCallback((convId: number | string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'LEAVE_CONVERSATION', data: { conversationId: Number(convId) } }));
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { connected, reconnecting, joined, conversation, messages, error, connect, joinConversation, sendMessage, closeConversation, leaveConversation, cleanup, setConversation, setMessages };
}
