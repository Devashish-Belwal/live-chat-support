"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Conversation } from '@/lib/types';

export default function AgentConversationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const metaRef = useRef<Conversation | null>(null);

  const { user, loading } = useAuth();

  const {
    connected,
    reconnecting,
    joined,
    messages,
    error,
    conversation,
    connect,
    sendMessage,
    closeConversation,
    leaveConversation,
    cleanup,
    setConversation,
    setMessages,
  } = useChatSocket();

  const conversationId = Number(id);
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      return;
    }
    if (!conversationId || isNaN(conversationId)) return;
    api.getConversation(String(conversationId))
      .then((conv: Conversation) => {
        metaRef.current = conv;
        setConversation(conv as import('@/hooks/useChatSocket').Conversation);
        if (conv && Array.isArray(conv.messages) && conv.messages.length > 0) {
          setMessages(conv.messages);
        }
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load conversation');
      });
  }, [conversationId, loading, user, setConversation, setMessages]);

  useEffect(() => {
    if (conversation) {
      metaRef.current = conversation as Conversation;
    }
  }, [conversation]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    if (conversation?.status === 'ACTIVE') {
      connect(conversationId);
    }
    return () => {
      const meta = metaRef.current;
      if (meta && meta.status === 'ACTIVE') {
        leaveConversation(conversationId);
      }
      cleanup();
    };
  }, [conversationId, connect, leaveConversation, cleanup, conversation, loading, user]);

  const isClosed = conversation?.status === 'CLOSED';
  const statusText = conversation?.status || 'Loading...';

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!connected || isClosed) return;
    if (sending) return;
    setSending(true);
    sendMessage(conversationId, trimmed);
    setText('');
    setTimeout(() => setSending(false), 300);
  }, [connected, text, sending, conversationId, sendMessage, isClosed]);
  const canSend = connected && !isClosed && !sending && !reconnecting;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.back()} className="mb-3 text-sm">← Queue</button>
      <h2 className="text-xl font-bold mb-2">Conversation #{id}</h2>
      <div className="text-xs mb-4 flex gap-4">
        <span>Status: {statusText}</span>
        <span>WebSocket: {connected ? (reconnecting ? 'Reconnecting...' : 'Connected') : 'Disconnected'}</span>
        {joined && <span>Joined</span>}
      </div>
      {loadError && <div className="text-red-600 mb-4">{loadError}</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="border rounded-xl p-4 h-96 overflow-y-auto mb-4 bg-slate-50">
        {messages.map((m) => (
          <div key={m.id ?? `${m.content}-${m.createdAt}-${m.senderRole}`} className="mb-3">
            <div className="text-xs font-semibold">{m.senderRole || 'Unknown'}</div>
            <div className="text-sm">{m.content}</div>
          </div>
        ))}
        {messages.length === 0 && <div className="text-slate-400">No messages yet.</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isClosed || !connected || reconnecting}
          className="flex-1 border rounded px-3 py-2 disabled:bg-slate-100"
          placeholder={isClosed ? 'Conversation closed' : 'Type message...'}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="bg-indigo-600 text-white px-4 rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>

      <button
        onClick={() => closeConversation(conversationId)}
        disabled={!connected || isClosed}
        className="mt-3 bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Close conversation
      </button>
    </div>
  );
}
