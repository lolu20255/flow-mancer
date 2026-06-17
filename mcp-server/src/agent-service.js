import { getDb } from './firebase.js'

// Agent presence: short-lived "an AI agent is working in this repo right now"
// records. Hooks (Claude Code, Codex) write here via the Admin SDK; the web app
// reads them live to render the Agents monitor. One doc per agent session.
const AGENT_SESSIONS_COL = 'agentSessions'
const PROJECTS_COL = 'projects'

const TASK_MAX_LEN = 160

// Deterministic doc id so start/beat/stop for the same session hit one doc.
function sessionDocId(agent, sessionId) {
  return `${agent}__${sessionId}`
}

function truncate(text) {
  if (!text) return null
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.length > TASK_MAX_LEN ? `${clean.slice(0, TASK_MAX_LEN - 1)}…` : clean
}

// Look up the project a session belongs to (for display: name, emoji, color).
// Prefers an explicit id; falls back to a case-exact name. Scoped to the caller.
export async function resolveSessionProject(ctx, { projectId, projectName }) {
  const db = getDb()

  if (projectId) {
    const snap = await db.collection(PROJECTS_COL).doc(projectId).get()
    if (snap.exists && snap.data().userId === ctx.uid) {
      return projectFields(snap.id, snap.data())
    }
  }

  if (projectName) {
    const snap = await db.collection(PROJECTS_COL)
      .where('userId', '==', ctx.uid)
      .where('name', '==', projectName)
      .limit(1)
      .get()
    if (!snap.empty) return projectFields(snap.docs[0].id, snap.docs[0].data())
  }

  return null
}

function projectFields(id, data) {
  return { id, name: data.name, emoji: data.emoji || null, color: data.color || null }
}

// Mark a session as working. Idempotent: re-running keeps the original
// startedAt and only refreshes the heartbeat (and task, when a new one is given).
export async function startAgentSession(ctx, args) {
  const { sessionId, agent } = requireSession(args)
  const db = getDb()
  const ref = db.collection(AGENT_SESSIONS_COL).doc(sessionDocId(agent, sessionId))
  const now = Date.now()
  const existing = await ref.get()

  const record = {
    userId: ctx.uid,
    sessionId,
    agent,
    status: 'working',
    // A fresh prompt clears any prior "waiting for input" state.
    waitReason: null,
    projectId: args.project?.id || null,
    projectName: args.project?.name || null,
    projectEmoji: args.project?.emoji || null,
    projectColor: args.project?.color || null,
    cwd: args.cwd || null,
    host: args.host || null,
    startedAt: existing.exists ? (existing.data().startedAt || now) : now,
    updatedAt: now,
  }
  const task = truncate(args.task)
  if (task) record.task = task
  else if (!existing.exists) record.task = null

  await ref.set(record, { merge: true })
  return { id: ref.id, status: 'working', startedAt: record.startedAt }
}

// Refresh the heartbeat without resurrecting a session that already stopped.
// A heartbeat means the agent is actively working, so this also clears any
// prior "waiting for input" state: approving a permission prompt resumes the
// agent (the next tool runs), flipping the card from amber back to green.
export async function beatAgentSession(ctx, args) {
  const { sessionId, agent } = requireSession(args)
  const db = getDb()
  const ref = db.collection(AGENT_SESSIONS_COL).doc(sessionDocId(agent, sessionId))
  try {
    await ref.update({ status: 'working', waitReason: null, updatedAt: Date.now() })
    return { id: ref.id, beat: true }
  } catch {
    // Doc is gone (session already stopped). Nothing to heartbeat.
    return { id: ref.id, beat: false }
  }
}

// Mark a session as blocked on the user (permission prompt or idle input).
// Like beat, it never resurrects a stopped session: if the doc is gone, no-op.
export async function waitAgentSession(ctx, args) {
  const { sessionId, agent } = requireSession(args)
  const db = getDb()
  const ref = db.collection(AGENT_SESSIONS_COL).doc(sessionDocId(agent, sessionId))
  try {
    await ref.update({ status: 'waiting', waitReason: classifyWait(args), updatedAt: Date.now() })
    return { id: ref.id, status: 'waiting' }
  } catch {
    return { id: ref.id, status: 'missing' }
  }
}

// Reduce a notification to a coarse reason the UI can badge: 'permission' or 'input'.
function classifyWait({ notificationType, message }) {
  const type = (notificationType || '').toLowerCase()
  if (type.includes('permission')) return 'permission'
  if (type.includes('idle')) return 'input'
  const msg = (message || '').toLowerCase()
  if (msg.includes('permission') || msg.includes('approve') || msg.includes('allow')) return 'permission'
  return 'input'
}

// Clear the session. Idempotent: deleting a missing doc is a no-op.
export async function stopAgentSession(ctx, args) {
  const { sessionId, agent } = requireSession(args)
  const db = getDb()
  const ref = db.collection(AGENT_SESSIONS_COL).doc(sessionDocId(agent, sessionId))
  await ref.delete()
  return { id: ref.id, status: 'stopped' }
}

export async function listAgentSessions(ctx) {
  const db = getDb()
  const snap = await db.collection(AGENT_SESSIONS_COL)
    .where('userId', '==', ctx.uid)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function requireSession({ sessionId, agent }) {
  if (!sessionId) throw new Error('sessionId is required')
  if (!agent) throw new Error('agent is required')
  return { sessionId, agent }
}
