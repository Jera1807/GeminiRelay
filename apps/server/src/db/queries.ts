import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema';
import type { User, Conversation, Message, Run } from '@gemini-relay/shared';

// ─── Users ────────────────────────────────────────────────────────────────
export function countUsers(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}

export function createUser(username: string, passwordHash: string): User {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash);
  return getUserById(id)!;
}

export function getUserByUsername(username: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, username, password_hash as passwordHash, created_at as createdAt FROM users WHERE username = ?').get(username) as User | undefined;
  return row ?? null;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, username, password_hash as passwordHash, created_at as createdAt FROM users WHERE id = ?').get(id) as User | undefined;
  return row ?? null;
}

// ─── Conversations ────────────────────────────────────────────────────────
export function createConversation(userId: string, title: string): Conversation {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)').run(id, userId, title);
  return getConversationById(id)!;
}

export function getConversationById(id: string): Conversation | null {
  const db = getDb();
  const row = db.prepare('SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
  return row ?? null;
}

export function getConversationsByUser(userId: string): Conversation[] {
  const db = getDb();
  return db.prepare('SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as Conversation[];
}

export function updateConversationTitle(id: string, title: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function touchConversation(id: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// ─── Messages ─────────────────────────────────────────────────────────────
export function createMessage(conversationId: string, role: 'user' | 'assistant', content: string): Message {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(id, conversationId, role, content);
  return getMessageById(id)!;
}

export function getMessageById(id: string): Message | null {
  const db = getDb();
  const row = db.prepare('SELECT id, conversation_id as conversationId, role, content, created_at as createdAt FROM messages WHERE id = ?').get(id) as Message | undefined;
  return row ?? null;
}

export function getMessagesByConversation(conversationId: string): Message[] {
  const db = getDb();
  return db.prepare('SELECT id, conversation_id as conversationId, role, content, created_at as createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as Message[];
}

export function updateMessageContent(id: string, content: string): void {
  const db = getDb();
  db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id);
}

export function getLastNMessages(conversationId: string, n: number): Message[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, conversation_id as conversationId, role, content, created_at as createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?').all(conversationId, n) as Message[];
  return rows.reverse();
}

// ─── Runs ──────────────────────────────────────────────────────────────────
export function createRun(conversationId: string): Run {
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO runs (id, conversation_id, status) VALUES (?, ?, ?)').run(id, conversationId, 'running');
  return getRunById(id)!;
}

export function getRunById(id: string): Run | null {
  const db = getDb();
  const row = db.prepare('SELECT id, conversation_id as conversationId, message_id as messageId, status, duration_ms as durationMs, input_tokens as inputTokens, output_tokens as outputTokens, model, created_at as createdAt, finished_at as finishedAt FROM runs WHERE id = ?').get(id) as Run | undefined;
  return row ?? null;
}

export function finishRun(id: string, status: 'finished' | 'cancelled' | 'error', durationMs?: number, inputTokens?: number, outputTokens?: number, model?: string, messageId?: string): void {
  const db = getDb();
  db.prepare("UPDATE runs SET status = ?, duration_ms = ?, input_tokens = ?, output_tokens = ?, model = ?, message_id = ?, finished_at = datetime('now') WHERE id = ?").run(status, durationMs ?? null, inputTokens ?? null, outputTokens ?? null, model ?? null, messageId ?? null, id);
}
