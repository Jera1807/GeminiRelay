'use client';
import { ConversationSummary, createConversation, deleteConversation } from '@/lib/api';
import styles from './ConversationList.module.css';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: (conv: ConversationSummary) => void;
  onDelete: (id: string) => void;
  username: string;
  onLogout: () => void;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, username, onLogout }: Props) {
  async function handleNew() {
    const conv = await createConversation('New Conversation');
    onNew(conv);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id);
      onDelete(id);
    }
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>✦</span>
          <span className={styles.brandText}>GeminiRelay</span>
        </div>
        <button onClick={handleNew} className={styles.newBtn} title="New conversation">
          ✏️
        </button>
      </div>

      <div className={styles.list}>
        {conversations.length === 0 && (
          <div className={styles.empty}>No conversations yet. Start one!</div>
        )}
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`${styles.item} ${conv.id === activeId ? styles.active : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <span className={styles.itemTitle}>{conv.title}</span>
            <button
              className={styles.deleteBtn}
              onClick={(e) => handleDelete(e, conv.id)}
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.user}>
          <span className={styles.userIcon}>👤</span>
          <span className={styles.userName}>{username}</span>
        </div>
        <button onClick={onLogout} className={styles.logoutBtn}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
