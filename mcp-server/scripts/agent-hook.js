#!/usr/bin/env node
// Flowmancer agent presence hook.
//
// Called by an AI tool's lifecycle hooks (Claude Code, Codex, ...) to report
// that an agent is working in the current repo, so the Flowmancer web app can
// show a live "agents monitor". It is intentionally fail-safe: any error is
// logged to stderr and the process still exits 0, so a hook failure never
// blocks or breaks the agent.
//
// Usage (the subcommand is the first arg):
//   node agent-hook.js start   # agent began processing a prompt
//   node agent-hook.js beat    # heartbeat (throttled); keeps the card "alive"
//                              # and clears a "waiting" card once work resumes
//   node agent-hook.js wait    # agent is blocked waiting for user input/approval
//   node agent-hook.js stop    # agent finished; clears the card
//
// Context comes from the hook's JSON on stdin (session id, cwd, prompt) with
// CLI flags / env as fallbacks. The repo is mapped to a project via a
// `.flowmancer` file (searched upward from cwd): {"projectId":"..."} or
// {"project":"Project Name"}.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.resolve(HERE, '..')
const HEARTBEAT_THROTTLE_MS = 45_000

main()

async function main() {
  try {
    const command = process.argv[2]
    if (!['start', 'beat', 'wait', 'stop'].includes(command)) {
      throw new Error(`Unknown command "${command || ''}". Use start | beat | wait | stop.`)
    }

    loadEnvFile(path.join(PACKAGE_ROOT, '..', '.env'))
    const flags = parseFlags(process.argv.slice(3))
    const payload = await readStdinJson()
    const ctxInput = buildContext(flags, payload)

    // Opt-in per repo: with no `.flowmancer` (and no explicit project flag) the
    // repo isn't tracked, so do nothing. Lets these hooks live globally without
    // creating noise for every unrelated session.
    if (!ctxInput.projectId && !ctxInput.projectName) return

    if (command === 'beat' && throttledRecently(ctxInput)) return

    // Import lazily so a config error surfaces before the SDK tries to init.
    const { resolveApiKey } = await import('../src/board-service.js')
    const agentService = await import('../src/agent-service.js')

    const ctx = await resolveContext(resolveApiKey)
    await dispatch(command, agentService, ctx, ctxInput)
  } catch (err) {
    // Never fail the hook. Just report on stderr.
    process.stderr.write(`[flowmancer-agent] ${err.message}\n`)
  }
}

async function dispatch(command, agentService, ctx, ctxInput) {
  if (command === 'stop') {
    await agentService.stopAgentSession(ctx, ctxInput)
    return
  }
  if (command === 'beat') {
    await agentService.beatAgentSession(ctx, ctxInput)
    markBeat(ctxInput)
    return
  }
  if (command === 'wait') {
    await agentService.waitAgentSession(ctx, ctxInput)
    // Flag the local cache so the next tool-use heartbeat bypasses the throttle
    // and immediately clears this "waiting" state once the user approves.
    markBeat(ctxInput, { waiting: true })
    return
  }
  // start
  const project = await agentService.resolveSessionProject(ctx, {
    projectId: ctxInput.projectId,
    projectName: ctxInput.projectName,
  })
  await agentService.startAgentSession(ctx, { ...ctxInput, project })
  markBeat(ctxInput)
}

// ---- Context assembly ------------------------------------------------------

function buildContext(flags, payload) {
  const cwd = flags.cwd || payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const repo = findFlowmancerConfig(cwd)
  const agent = flags.agent || process.env.FLOWMANCER_AGENT || payload.agent || 'claude'
  const sessionId = flags.session || payload.session_id || fallbackSessionId(cwd)
  const task = flags.task || payload.prompt || null

  return {
    agent,
    sessionId,
    cwd,
    host: os.hostname(),
    task,
    // Notification hook context (used by the `wait` command).
    message: flags.message || payload.message || null,
    notificationType: flags['notification-type'] || payload.notification_type || null,
    projectId: flags['project-id'] || repo.projectId || null,
    projectName: flags.project || repo.project || null,
  }
}

// Walk up from cwd looking for a `.flowmancer` file (JSON).
function findFlowmancerConfig(startDir) {
  let dir = startDir
  for (let depth = 0; depth < 30; depth++) {
    const file = path.join(dir, '.flowmancer')
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch {
        process.stderr.write(`[flowmancer-agent] ${file} is not valid JSON; ignoring.\n`)
        return {}
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return {}
}

function fallbackSessionId(cwd) {
  return crypto.createHash('sha1').update(`${os.hostname()}:${cwd}`).digest('hex').slice(0, 16)
}

// ---- API key -> uid (cached so frequent hooks don't re-query Firestore) -----

async function resolveContext(resolveApiKey) {
  const apiKey = process.env.FLOWMANCER_API_KEY
  if (!apiKey) throw new Error('FLOWMANCER_API_KEY is not set')

  const cacheFile = cachePath(`uid-${shortHash(apiKey)}.json`)
  const cached = readJsonSafe(cacheFile)
  if (cached?.uid) return { uid: cached.uid }

  const ctx = await resolveApiKey(apiKey)
  writeJsonSafe(cacheFile, { uid: ctx.uid })
  return ctx
}

// ---- Heartbeat throttle (bounds writes to ~1 per session per throttle win) --

function throttledRecently(ctxInput) {
  const cache = readJsonSafe(beatPath(ctxInput))
  // A session leaving "waiting" must clear immediately, never throttled.
  if (cache?.waiting) return false
  return Date.now() - (cache?.at || 0) < HEARTBEAT_THROTTLE_MS
}

function markBeat(ctxInput, extra = {}) {
  writeJsonSafe(beatPath(ctxInput), { at: Date.now(), ...extra })
}

function beatPath(ctxInput) {
  return cachePath(`beat-${shortHash(`${ctxInput.agent}:${ctxInput.sessionId}`)}.json`)
}

// ---- Small utilities -------------------------------------------------------

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i]
  }
  return out
}

function readStdinJson() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({})
    let raw = ''
    const done = () => resolve(parseJsonSafe(raw))
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => { raw += chunk })
    process.stdin.on('end', done)
    process.stdin.on('error', () => resolve({}))
    // Don't hang forever if nothing is piped.
    setTimeout(done, 250).unref()
  })
}

// Load KEY=VALUE pairs from a .env file into process.env (without overriding
// already-set vars), resolving a relative credentials path to absolute so the
// Admin SDK works regardless of the hook's working directory.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    process.env[key] = stripQuotes(trimmed.slice(eq + 1).trim())
  }
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (creds && !path.isAbsolute(creds)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(path.dirname(file), creds)
  }
}

function stripQuotes(value) {
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
    return value.slice(1, -1)
  }
  return value
}

function cachePath(name) {
  return path.join(os.tmpdir(), `flowmancer-${name}`)
}

function shortHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12)
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonSafe(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data))
  } catch {
    // Cache is best-effort.
  }
}

function parseJsonSafe(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
