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
| `GEMINI_SHELL` | *(auto)* | Force `shell: true/false` when spawning Gemini (`true` default on Windows) |
| `GEMINI_DEBUG` | `false` | Set to `1` to enable verbose Gemini subprocess logging (stderr, non-JSON stdout, spawn args) |

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

## Troubleshooting

### `gemini exited with code 1`

This error means the Gemini CLI subprocess returned a non-zero exit code. Starting with the current release, the server logs **full diagnostic details** to `stderr` whenever this happens:

```
[GeminiRunner] gemini exited with code 1
  path:     gemini
  args:     ["-p","[42 chars]","-o","stream-json"]
  cwd:      C:\Users\you\GeminiRelay\apps\server
  platform: win32
  shell:    true
  stderr:
    Trust check failed: run `gemini` interactively first
```

**Step 1 – Check server logs**

Run the server so its output is visible, for example:

```bash
# Unix / macOS
npm run dev 2>&1 | tee server.log

# Windows (PowerShell)
npm run dev 2>&1 | Tee-Object server.log
```

After triggering the error, look for the `[GeminiRunner]` lines. The `stderr:` section usually explains the root cause.

**Step 2 – Test the CLI directly**

Run Gemini exactly as the server does:

```bash
# Unix / macOS / Windows PowerShell
gemini -p "hello" -o stream-json
echo $?          # should print 0

# Windows cmd.exe
gemini -p "hello" -o stream-json
echo %ERRORLEVEL%   # should print 0
```

If this also fails you'll see the Gemini error message directly. Common causes:
- **Trust/first-run dialog** – run `gemini` interactively once and accept the prompt.
- **Not authenticated** – follow the Gemini CLI sign-in flow.
- **Not in PATH** – see *Setting `GEMINI_PATH` on Windows* below.

**Step 3 – Enable debug logging**

Add `GEMINI_DEBUG=1` to your `.env` (or export it before starting the server) to get verbose per-line logging of all Gemini subprocess output:

```
GEMINI_DEBUG=1
```

This prints every stderr line and every non-JSON stdout line to the server console as the subprocess runs, making it easier to spot intermittent issues.

---

### Setting `GEMINI_PATH` on Windows

If `gemini` is not on your system PATH, or if you need to point to a specific version, set `GEMINI_PATH` to the full path of the binary:

```
# .env  (use forward slashes or double back-slashes)
GEMINI_PATH=C:/Users/you/AppData/Roaming/npm/gemini.cmd
```

On Windows, npm-installed global commands are `.cmd` wrapper scripts. The server automatically uses `shell: true` when running on Windows so that these wrappers are resolved correctly. If you are pointing `GEMINI_PATH` at a native `.exe`, you can disable the shell with:

```
GEMINI_SHELL=false
```

---

### Prompts with special characters failing on Windows

When `shell: true` is active (the Windows default), characters like `"`, `^`, `&`, or `|` inside a prompt can be misinterpreted by `cmd.exe`. If you see exit-code 1 only with certain prompt content, try:

1. Set `GEMINI_DEBUG=1` and check whether the logged `stderr:` section shows a shell parsing error.
2. If the issue is confirmed, file an issue or set `GEMINI_PATH` to the full `.exe` path and `GEMINI_SHELL=false`.