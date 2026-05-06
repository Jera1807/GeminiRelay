'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiWsClient } from '@/lib/ws';
import { getMessages, MessageDto } from '@/lib/api';
import MessageItem from './MessageItem';
import styles from './ChatWindow.module.css';
import type { ServerMessage } from '@gemini-relay/shared';

interface Props {
  conversationId: string;
  token: string;
  wsClient: GeminiWsClient;
  wsStatus: 'connected' | 'disconnected' | 'connecting';
}

interface StreamingRun {
  runId: string;
  assistantMessageId: string;
  content: string;
}

export default function ChatWindow({ conversationId, token: _token, wsClient, wsStatus }: Props) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<StreamingRun | null>(null);
  const streamingRef = useRef<StreamingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRunId = useRef<string | null>(null);
  const inputRef = useRef('');

  // Keep inputRef in sync with input state for use in WS handler
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Keep streamingRef in sync with streaming state
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Load messages when conversationId changes
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setStreaming(null);
    streamingRef.current = null;
    setError(null);
    getMessages(conversationId)
      .then(msgs => setMessages(msgs))
      .catch(err => setError((err as { error?: string }).error ?? 'Failed to load messages'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  // WebSocket message handler
  useEffect(() => {
    const unsubscribe = wsClient.onMessage((msg: ServerMessage) => {
      if (msg.type === 'runStarted') {
        if (msg.conversationId !== conversationId) return;
        activeRunId.current = msg.runId;
        const userMsg: MessageDto = {
          id: msg.userMessageId,
          conversationId: msg.conversationId,
          role: 'user',
          content: inputRef.current,
          createdAt: new Date().toISOString(),
        };
        const assistantMsg: MessageDto = {
          id: msg.assistantMessageId,
          conversationId: msg.conversationId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg, assistantMsg]);
        const newStreaming = { runId: msg.runId, assistantMessageId: msg.assistantMessageId, content: '' };
        setStreaming(newStreaming);
        streamingRef.current = newStreaming;
        setSending(false);
      } else if (msg.type === 'geminiEvent') {
        if (msg.runId !== activeRunId.current) return;
        const eventText = typeof msg.event.text === 'string'
          ? msg.event.text
          : (typeof msg.event.content === 'string' ? msg.event.content : null);
        if (eventText !== null) {
          setStreaming(prev => {
            if (!prev) return prev;
            const shouldReplace = msg.event.delta === false
              || (msg.event.delta === undefined && eventText.startsWith(prev.content));
            const nextContent = shouldReplace ? eventText : prev.content + eventText;
            const updated = { ...prev, content: nextContent };
            streamingRef.current = updated;
            return updated;
          });
        }
      } else if (msg.type === 'runFinished') {
        if (msg.runId !== activeRunId.current) return;
        activeRunId.current = null;
        const current = streamingRef.current;
        if (current) {
          setMessages(prev =>
            prev.map(m =>
              m.id === current.assistantMessageId
                ? { ...m, content: current.content }
                : m
            )
          );
        }
        setStreaming(null);
        streamingRef.current = null;
      } else if (msg.type === 'runError') {
        if (msg.runId !== activeRunId.current) return;
        activeRunId.current = null;
        setStreaming(null);
        streamingRef.current = null;
        setError(msg.error);
        setSending(false);
      }
    });
    return unsubscribe;
  }, [wsClient, conversationId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming?.content]);

  const sendMessage = useCallback(() => {
    const trimmed = inputRef.current.trim();
    if (!trimmed || sending || wsStatus !== 'connected') return;
    setSending(true);
    setError(null);
    wsClient.send({ type: 'startRun', conversationId, prompt: trimmed });
    setInput('');
  }, [sending, wsStatus, wsClient, conversationId]);

  const cancelRun = useCallback(() => {
    if (activeRunId.current) {
      wsClient.send({ type: 'cancelRun', runId: activeRunId.current });
    }
  }, [wsClient]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading messages...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            message={msg}
            isStreaming={streaming?.assistantMessageId === msg.id}
            streamContent={streaming?.assistantMessageId === msg.id ? streaming.content : undefined}
          />
        ))}
        {messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✦</div>
            <div className={styles.emptyTitle}>Start a conversation</div>
            <div className={styles.emptySubtitle}>Ask Gemini anything...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
          <button onClick={() => setError(null)} className={styles.errorClose}>✕</button>
        </div>
      )}

      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Message Gemini... (Enter to send, Shift+Enter for newline)"
            className={styles.textarea}
            rows={1}
            disabled={sending || wsStatus !== 'connected'}
          />
          <div className={styles.inputActions}>
            {streaming ? (
              <button onClick={cancelRun} className={styles.cancelBtn} title="Cancel">
                ⬛
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || wsStatus !== 'connected'}
                className={styles.sendBtn}
                title="Send (Enter)"
              >
                ➤
              </button>
            )}
          </div>
        </div>
        {wsStatus !== 'connected' && (
          <div className={styles.statusBar}>
            {wsStatus === 'connecting' ? '🔄 Connecting...' : '🔴 Disconnected – waiting to reconnect...'}
          </div>
        )}
      </div>
    </div>
  );
}
