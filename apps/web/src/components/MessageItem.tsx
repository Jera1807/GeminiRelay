'use client';
import { useEffect, useRef } from 'react';
import styles from './MessageItem.module.css';
import type { MessageDto } from '@/lib/api';

interface Props {
  message: MessageDto;
  isStreaming?: boolean;
  streamContent?: string;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export default function MessageItem({ message, isStreaming, streamContent }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const content = isStreaming ? (streamContent ?? '') : message.content;

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = parseMarkdown(content);
    }
  }, [content]);

  return (
    <div className={`${styles.message} ${styles[message.role]}`}>
      <div className={styles.avatar}>
        {message.role === 'user' ? '👤' : '✦'}
      </div>
      <div className={styles.bubble}>
        <div ref={contentRef} className={styles.content} />
        {isStreaming && <span className={styles.cursor} />}
      </div>
    </div>
  );
}
