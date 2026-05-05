'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ConversationList from '@/components/ConversationList';
import ChatWindow from '@/components/ChatWindow';
import { GeminiWsClient } from '@/lib/ws';
import { getConversations, ConversationSummary } from '@/lib/api';
import styles from './chat.module.css';

export default function ChatPage() {
  const { user, token, logout, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const wsClientRef = useRef<GeminiWsClient | null>(null);
  const [wsReady, setWsReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    getConversations().then(convs => {
      setConversations(convs);
      if (convs.length > 0 && !activeId) setActiveId(convs[0].id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Set up WebSocket
  useEffect(() => {
    if (!token) return;
    const client = new GeminiWsClient(token);
    wsClientRef.current = client;
    client.onStatus(setWsStatus);
    client.connect();
    setWsReady(true);
    return () => {
      client.destroy();
      wsClientRef.current = null;
      setWsReady(false);
    };
  }, [token]);

  const handleNewConversation = useCallback((conv: ConversationSummary) => {
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user || !wsClientRef.current || !wsReady) {
    return <div className={styles.loading}>Connecting...</div>;
  }

  return (
    <div className={styles.layout}>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        username={user.username}
        onLogout={() => { logout(); router.replace('/login'); }}
      />
      <main className={styles.main}>
        {activeId ? (
          <ChatWindow
            key={activeId}
            conversationId={activeId}
            token={token!}
            wsClient={wsClientRef.current}
            wsStatus={wsStatus}
          />
        ) : (
          <div className={styles.noConv}>
            <div className={styles.noConvIcon}>✦</div>
            <div className={styles.noConvText}>Select or create a conversation to get started</div>
          </div>
        )}
      </main>
    </div>
  );
}
