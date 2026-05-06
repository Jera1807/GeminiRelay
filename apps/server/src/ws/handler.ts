import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { verifyToken } from '../auth/jwt';
import {
  createMessage,
  createRun,
  finishRun,
  getConversationById,
  getLastNMessages,
  updateConversationTitle,
  updateMessageContent,
  touchConversation,
} from '../db/queries';
import { GeminiRunner } from '../gemini/runner';
import { config } from '../config';
import type {
  ClientMessage,
  RunStartedMessage,
  GeminiEventMessage,
  LogLineMessage,
  RunFinishedMessage,
  RunErrorMessage,
  GeminiStreamEvent,
} from '@gemini-relay/shared';

function extractToken(req: IncomingMessage): string | null {
  const url = req.url ?? '';
  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  const tokenParam = params.get('token');
  if (tokenParam) return tokenParam;
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function send(ws: WebSocket, msg: RunStartedMessage | GeminiEventMessage | LogLineMessage | RunFinishedMessage | RunErrorMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getEventText(event: GeminiStreamEvent): string | null {
  if (typeof event.text === 'string') return event.text;
  if (typeof event.content === 'string') return event.content;
  return null;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant powered by Google Gemini. Be concise and clear in your responses. When showing code, use proper markdown code blocks with language identifiers.`;

function buildPrompt(history: { role: string; content: string }[], userPrompt: string): string {
  const parts: string[] = [SYSTEM_PROMPT, ''];
  for (const msg of history) {
    const label = msg.role === 'user' ? 'User' : 'Assistant';
    parts.push(`${label}: ${msg.content}`);
  }
  parts.push(`User: ${userPrompt}`);
  parts.push('Assistant:');
  return parts.join('\n');
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const activeRunners = new Map<string, GeminiRunner>();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = extractToken(req);
    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.on('message', async (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        return;
      }

      if (msg.type === 'startRun') {
        const conv = getConversationById(msg.conversationId);
        if (!conv || conv.userId !== userId) {
          send(ws, { type: 'runError', runId: '', error: 'Conversation not found' });
          return;
        }

        const userMsg = createMessage(msg.conversationId, 'user', msg.prompt);
        const assistantMsg = createMessage(msg.conversationId, 'assistant', '');
        const run = createRun(msg.conversationId);
        const history = getLastNMessages(msg.conversationId, config.contextMessages + 1);
        const userMessages = history.filter(m => m.role === 'user');
        if (userMessages.length === 1) {
          const shortTitle = msg.prompt.slice(0, 60);
          updateConversationTitle(msg.conversationId, shortTitle);
        }

        send(ws, {
          type: 'runStarted',
          runId: run.id,
          conversationId: msg.conversationId,
          userMessageId: userMsg.id,
          assistantMessageId: assistantMsg.id,
        });

        const contextHistory = history.slice(0, -1);
        const fullPrompt = buildPrompt(contextHistory, msg.prompt);

        let assistantContent = '';
        const runner = new GeminiRunner(fullPrompt);
        activeRunners.set(run.id, runner);

        runner.on('event', (event: GeminiStreamEvent) => {
          send(ws, { type: 'geminiEvent', runId: run.id, event });
          const eventText = getEventText(event);
          if (eventText !== null) {
            if (event.delta === false) {
              assistantContent = eventText;
            } else {
              assistantContent += eventText;
            }
          }
        });

        runner.on('logLine', (line: string) => {
          send(ws, { type: 'logLine', runId: run.id, line });
        });

        runner.on('finished', (stats) => {
          activeRunners.delete(run.id);
          updateMessageContent(assistantMsg.id, assistantContent);
          touchConversation(msg.conversationId);
          finishRun(
            run.id,
            'finished',
            stats?.durationMs,
            stats?.inputTokenCount,
            stats?.outputTokenCount,
            stats?.model,
            assistantMsg.id,
          );
          send(ws, { type: 'runFinished', runId: run.id, stats: stats ?? null });
        });

        runner.on('error', (err: Error) => {
          console.error(`[ws/handler] run ${run.id} error: ${err.message}`);
          activeRunners.delete(run.id);
          finishRun(run.id, 'error');
          send(ws, { type: 'runError', runId: run.id, error: err.message });
        });

        runner.start();

      } else if (msg.type === 'cancelRun') {
        const runner = activeRunners.get(msg.runId);
        if (runner) {
          runner.cancel();
          activeRunners.delete(msg.runId);
          finishRun(msg.runId, 'cancelled');
          send(ws, { type: 'runFinished', runId: msg.runId, stats: null });
        }
      }
    });

    ws.on('close', () => {
      // Clean up handled per-run above
    });
  });

  return wss;
}
