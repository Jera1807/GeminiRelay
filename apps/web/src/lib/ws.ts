import type { ServerMessage, ClientMessage } from '@gemini-relay/shared';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (status: 'connected' | 'disconnected' | 'connecting') => void;

export class GeminiWsClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private destroyed = false;
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];

  constructor(private readonly token: string) {}

  connect(): void {
    if (this.destroyed) return;
    this.setStatus('connecting');
    try {
      this.ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(this.token)}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.messageHandlers.forEach(h => h(msg));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      if (!this.destroyed) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }

  private setStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    this.statusHandlers.forEach(h => h(status));
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }
}
