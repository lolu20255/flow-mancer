# Flowmancer MCP Server

Exposes Flowmancer boards and tickets to AI models over the
[Model Context Protocol](https://modelcontextprotocol.io). Other AI agents
(Claude Desktop, Cursor, Claude Code, etc.) can list boards, create tickets,
move them between columns, update, assign, and delete them.

It talks to Firestore through the **Firebase Admin SDK** using a service
account, and scopes every action to a board member identified by an **API key**.
The same ticket logic the web app uses (`src/stores/board.js`) is mirrored in
`src/board-service.js`, so AI-created tickets are indistinguishable from
UI-created ones.

## Tools

| Tool | What it does |
|---|---|
| `whoami` | Returns the member the API key acts as |
| `list_boards` | All boards you're a member of, with columns + card counts |
| `list_projects` | Your projects (id, name, emoji, color) for linking tickets |
| `create_project` | Create a project (name, optional color + emoji) |
| `update_project` | Edit a project's name / color / emoji |
| `delete_project` | Delete a project you own |
| `list_agent_sessions` | Currently-active AI agent sessions (the agents monitor) |
| `get_board` | One board with every column and ticket (to discover ids) |
| `create_ticket` | Create a card in a column (by id or name) |
| `move_ticket` | Move a card to another column (change status) |
| `update_ticket` | Edit title / description / labels / project |
| `assign_ticket` | Assign to a member (by uid or email), or unassign |
| `delete_ticket` | Delete a card |

Mutating tools require the API key to have the `write` scope and the member to
have `owner` or `editor` role on the board (viewers are read-only), matching the
web app's permission model.

## Setup

### 1. Create a service account (one time)
A service account lets this server act on Firestore as an admin (it bypasses the
per-user security rules the web app relies on). To create one:

1. Open the [Firebase Console](https://console.firebase.google.com/) and select
   the **vibe-board-3b2cf** project.
2. Click the gear icon → **Project settings**.
3. Go to the **Service accounts** tab.
4. Make sure **Firebase Admin SDK** is selected, then click
   **Generate new private key** → **Generate key** in the confirmation dialog.
5. A JSON file downloads (e.g. `vibe-board-3b2cf-firebase-adminsdk-xxxx.json`).
   Treat it like a password: it grants full read/write to your database.
6. Move it into this folder named `service-account.json`:
   ```bash
   mv ~/Downloads/vibe-board-3b2cf-firebase-adminsdk-*.json \
      mcp-server/service-account.json
   chmod 600 mcp-server/service-account.json
   ```
   `service-account.json` and `.env` are already in `.gitignore`, so they will
   never be committed.

> If a key is ever leaked, revoke it in the same **Service accounts** tab
> (Manage service account permissions → Keys) and generate a new one.

### 2. Install
```bash
cd mcp-server
npm install
```

### 3. Configure credentials
The MCP server's env lives in the **repo root `.env`** (one file for the whole
project), alongside the web app's `VITE_*` vars. From the repo root:
```bash
cp .env.example .env
```
Then set in the root `.env`:
```bash
FIREBASE_PROJECT_ID=vibe-board-3b2cf
# Absolute path so it resolves from any working directory:
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/vibe-board/mcp-server/service-account.json
```
(Alternatively, instead of a file path you can paste the whole JSON into a
single-line `FIREBASE_SERVICE_ACCOUNT='{...}'` variable.) The `npm run` scripts
in this folder load the root `.env` automatically via Node's `--env-file=../.env`.

### 4. Create an API key for a user
The key maps to a Firebase uid (a real board member). Find the uid in the
`users` collection, or pass the user's email:
```bash
npm run create-key -- --email you@example.com --name "My AI agent"
# read-only key:
npm run create-key -- --email you@example.com --read-only
```
The plaintext key (`fmk_live_...`) is printed once. Only its SHA-256 hash is
stored in the `apiKeys` collection. Put it in the root `.env` as
`FLOWMANCER_API_KEY` (for local testing) and/or in your MCP client config (see below).

Revoke later with:
```bash
npm run revoke-key -- --keyId <id>
```

### 5. Lock down the `apiKeys` collection
The Admin SDK bypasses security rules, but make sure no browser client can read
key hashes. Add to your `firestore.rules`:
```
match /apiKeys/{id} {
  allow read, write: if false; // server-only, via Admin SDK
}
```

## Connecting an MCP client

Add to your MCP client config (example for Claude Desktop /
`claude_desktop_config.json`; Claude Code uses the same shape):

```json
{
  "mcpServers": {
    "flowmancer": {
      "command": "node",
      "args": ["/absolute/path/to/vibe-board/mcp-server/src/server.js"],
      "env": {
        "FIREBASE_PROJECT_ID": "vibe-board-3b2cf",
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
        "FLOWMANCER_API_KEY": "fmk_live_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Each connected client uses its own API key, so different agents can act as
different members with different scopes.

## Agents monitor (live "which agents are running" view)

The web app has an **Agents** section that shows, in real time, which of your
repos currently have an AI agent working. It is fed by lifecycle **hooks** that
call a small CLI (`scripts/agent-hook.js`) which writes presence records to the
`agentSessions` collection using the same service account + API key as the MCP
server. When the agent finishes, the hook clears the record and the card
disappears.

### 1. Tell each repo which project it belongs to
Drop a `.flowmancer` file at the root of every repo you work in. Use
`projectId` (from `list_projects`) or a `project` name:

```json
{ "projectId": "w7Xk3x4nALxfKI2aPYny" }
```
```json
{ "project": "ReadLens" }
```

The hook searches upward from the working directory, so a file at the repo root
covers all subdirectories. A repo with no `.flowmancer` is simply not tracked.

### 2. Wire the hooks
The CLI takes one subcommand and reads the hook's JSON from stdin:

- `start` when the agent begins a prompt (sets the card to "working")
- `beat` on each tool call (throttled heartbeat; proves it's still alive)
- `stop` when the agent finishes (clears the card)

It self-loads the repo root `.env` for credentials, so the only requirement is
an absolute path to the script. **Claude Code** (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node /ABS/PATH/vibe-board/mcp-server/scripts/agent-hook.js start" } ] }
    ],
    "PreToolUse": [
      { "matcher": "*", "hooks": [ { "type": "command", "command": "node /ABS/PATH/vibe-board/mcp-server/scripts/agent-hook.js beat" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node /ABS/PATH/vibe-board/mcp-server/scripts/agent-hook.js stop" } ] }
    ]
  }
}
```

For **Codex** (or any other agent), call the same script from its equivalent
start/stop hooks and pass `--agent codex` so the monitor labels it correctly:

```bash
node /ABS/PATH/mcp-server/scripts/agent-hook.js start --agent codex
```

Without stdin you can also pass everything via flags:
`--session <id> --project-id <id> --task "what it's doing" --cwd <dir>`.

The hook is fail-safe: any error is printed to stderr and it still exits 0, so a
misconfiguration never blocks your agent. If an agent crashes without firing
`stop`, its heartbeat goes stale and the web app marks the card "stale" (and
stops counting it as working) after a few minutes.

## Example flow for an agent

1. `list_boards` → pick a board id
2. `get_board { boardId }` → read column names + card ids
3. `create_ticket { boardId, column: "To Do", title: "Fix login bug" }`
4. `move_ticket { boardId, cardId, toColumn: "In Progress" }`
5. `assign_ticket { boardId, cardId, assigneeEmail: "dev@example.com" }`
