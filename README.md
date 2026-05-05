# GeminiRelay

A modern web/PWA chat interface for the Google Gemini CLI, exposing the CLI's native subscription/OAuth authentication over a WebSocket-powered real-time UI.

## Architecture

```
GeminiRelay/
├── packages/
│   └── shared/          # TypeScript types shared between server and web
├── apps/
│   ├── server/          # Node.js + Express + WebSocket backend
│   └── web/             # Next.js 15 App Router frontend (PWA)
└── package.json         # npm workspaces root
```

## Prerequisites

- Node.js 20+
- Google Gemini CLI installed and authenticated (`gemini` in PATH)
- npm 10+

## Quick Start

```bash
# Install all dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env – set JWT_SECRET at minimum

# Development (both server + web with hot reload)
npm run dev

# Production build
npm run build

# Production start
npm run start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `HOST` | `127.0.0.1` | Server bind address |
| `JWT_SECRET` | *(change me)* | Secret for JWT signing |
| `GEMINI_PATH` | `gemini` | Path to the Gemini CLI binary |
| `DB_PATH` | `~/.gemini-relay/data.db` | SQLite database path |
| `CONTEXT_MESSAGES` | `20` | Number of history messages sent as context |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API URL (for web) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | WebSocket URL (for web) |

## Features

- **Single-user**: Register once, then authenticate with username/password
- **Real-time streaming**: Token-by-token streaming via WebSocket + Gemini CLI `stream-json` output
- **Conversation history**: SQLite-backed persistent conversations and messages
- **Context-aware**: Last N messages sent as context to each Gemini invocation
- **PWA**: Installable as a Progressive Web App with offline support
- **Cancel**: Cancel in-flight Gemini runs
- **Connector API**: Extension point for augmenting prompts (see `apps/server/src/connectors/`)

## API

### REST

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `GET` | `/api/auth/status` | No | Check if registration is open |
| `POST` | `/api/auth/register` | No | Register (first user only) |
| `POST` | `/api/auth/login` | No | Login |
| `GET` | `/api/conversations` | JWT | List conversations |
| `POST` | `/api/conversations` | JWT | Create conversation |
| `GET` | `/api/conversations/:id` | JWT | Get conversation |
| `PATCH` | `/api/conversations/:id` | JWT | Update title |
| `DELETE` | `/api/conversations/:id` | JWT | Delete conversation |
| `GET` | `/api/conversations/:id/messages` | JWT | Get messages |

### WebSocket (`ws://host/ws?token=<jwt>`)

**Client → Server:**
```json
{ "type": "startRun", "conversationId": "...", "prompt": "..." }
{ "type": "cancelRun", "runId": "..." }
```

**Server → Client:**
```json
{ "type": "runStarted", "runId": "...", "conversationId": "...", "userMessageId": "...", "assistantMessageId": "..." }
{ "type": "geminiEvent", "runId": "...", "event": { "type": "content", "delta": true, "text": "..." } }
{ "type": "runFinished", "runId": "...", "stats": { "durationMs": 1234, ... } }
{ "type": "runError", "runId": "...", "error": "..." }
```

## License

MIT