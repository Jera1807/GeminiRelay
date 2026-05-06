'use client';
import { useEffect, useRef } from 'react';
import styles from './MessageItem.module.css';
import type { MessageDto } from '@/lib/api';

interface Props {
  message: MessageDto;
  isStreaming?: boolean;
  streamContent?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseMarkdown(text: string): string {
  // Extract code blocks before escaping so their content is preserved safely
  const codeBlocks: string[] = [];
  const withPlaceholders = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`);
    return `\x00CODE${idx}\x00`;
  });

  const escaped = escapeHtml(withPlaceholders);

  return escaped
    .replace(/\x00CODE(\d+)\x00/g, (_m, i: string) => codeBlocks[parseInt(i)] ?? '')
    .replace(/`([^`]+)`/g, (_m, c: string) => `<code>${escapeHtml(c)}</code>`)
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
