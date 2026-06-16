import crypto from 'node:crypto'
import { getDb, FieldValue } from './firebase.js'
import { ApiError } from './errors.js'

const BOARDS_COL = 'boards'
const API_KEYS_COL = 'apiKeys'
const USERS_COL = 'users'
const PROJECTS_COL = 'projects'

// Matches src/stores/board.js generateId() so ids look identical to UI-created ones.
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex')
}

// ---- Auth ------------------------------------------------------------------

// Resolve an API key into a caller context. Keys are stored hashed in the
// `apiKeys` collection; we look up by hash and hydrate the member's profile.
export async function resolveApiKey(rawKey) {
  if (!rawKey) throw new ApiError('Missing API key (set FLOWMANCER_API_KEY)', 'unauthenticated')
  const db = getDb()
  const hash = hashKey(rawKey)
  const snap = await db.collection(API_KEYS_COL).where('hash', '==', hash).limit(1).get()
  if (snap.empty) throw new ApiError('Invalid API key', 'unauthenticated')

  const keyDoc = snap.docs[0]
  const key = keyDoc.data()
  if (key.revoked) throw new ApiError('API key has been revoked', 'unauthenticated')
  if (!key.uid) throw new ApiError('API key is not mapped to a user', 'unauthenticated')

  const profile = await getUserById(key.uid)
  const user = {
    uid: key.uid,
    name: profile?.name || key.name || 'API',
    photo: profile?.photo || null,
  }
  return {
    keyId: keyDoc.id,
    uid: key.uid,
    user,
    scopes: Array.isArray(key.scopes) ? key.scopes : ['read', 'write'],
  }
}

function assertWriteScope(ctx) {
  if (!ctx.scopes.includes('write')) {
    throw new ApiError('This API key is read-only', 'permission_denied')
  }
}

// ---- Users -----------------------------------------------------------------

async function getUserById(uid) {
  const db = getDb()
  const snap = await db.collection(USERS_COL).doc(uid).get()
  return snap.exists ? snap.data() : null
}

async function getUserByEmail(email) {
  const db = getDb()
  const snap = await db.collection(USERS_COL)
    .where('email', '==', email.trim().toLowerCase())
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0].data()
}

// ---- Board helpers ---------------------------------------------------------

async function fetchBoardDoc(boardId) {
  const db = getDb()
  const ref = db.collection(BOARDS_COL).doc(boardId)
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError(`Board "${boardId}" not found`, 'not_found')
  return { ref, board: { id: snap.id, ...snap.data() } }
}

function memberRole(board, uid) {
  if (board.roles?.[uid]) return board.roles[uid]
  if (board.userId === uid) return 'owner'
  return null
}

function assertMember(board, uid) {
  const role = memberRole(board, uid)
  if (!role) throw new ApiError('You do not have access to this board', 'permission_denied')
  return role
}

function assertCanEdit(board, uid) {
  const role = assertMember(board, uid)
  if (role !== 'owner' && role !== 'editor') {
    throw new ApiError('You have read-only (viewer) access to this board', 'permission_denied')
  }
  return role
}

// Resolve a column by id first, then by case-insensitive name.
function resolveColumn(board, columnRef) {
  const cols = board.columns || []
  const byId = cols.find(c => c.id === columnRef)
  if (byId) return byId
  const target = String(columnRef).trim().toLowerCase()
  const byName = cols.find(c => (c.name || '').trim().toLowerCase() === target)
  if (byName) return byName
  const available = cols.map(c => c.name).join(', ') || '(none)'
  throw new ApiError(`Column "${columnRef}" not found. Available columns: ${available}`, 'not_found')
}

function findCard(board, cardId) {
  for (const col of board.columns || []) {
    const idx = (col.cards || []).findIndex(c => c.id === cardId)
    if (idx !== -1) return { column: col, card: col.cards[idx], index: idx }
  }
  throw new ApiError(`Ticket "${cardId}" not found on this board`, 'not_found')
}

async function persistColumns(ref, columns) {
  await ref.update({ columns, updatedAt: FieldValue.serverTimestamp() })
}

// Compact card representation for tool output.
function cardSummary(card) {
  return {
    id: card.id,
    title: card.title,
    description: card.description || '',
    labels: card.labels || [],
    projectId: card.projectId || null,
    assignee: card.assignee || null,
    imageCount: (card.images || []).length,
    createdBy: card.createdBy?.name || null,
    updatedAt: card.updatedAt || null,
  }
}

async function resolveAssignee(board, { assigneeUid, assigneeEmail }) {
  let uid = assigneeUid
  if (!uid && assigneeEmail) {
    const u = await getUserByEmail(assigneeEmail)
    if (!u) throw new ApiError(`No user found with email "${assigneeEmail}"`, 'not_found')
    uid = u.uid
  }
  if (!uid) throw new ApiError('Provide assigneeUid or assigneeEmail', 'invalid_argument')
  if (!(board.members || []).includes(uid)) {
    throw new ApiError('That user is not a member of this board; invite them first', 'permission_denied')
  }
  const profile = await getUserById(uid)
  return { uid, name: profile?.name || 'Unknown', photo: profile?.photo || null }
}

// ---- Operations (mirror src/stores/board.js) -------------------------------

export async function listBoards(ctx) {
  const db = getDb()
  const snap = await db.collection(BOARDS_COL)
    .where('members', 'array-contains', ctx.uid)
    .orderBy('createdAt', 'asc')
    .get()
  return snap.docs.map(d => {
    const b = d.data()
    return {
      id: d.id,
      name: b.name,
      emoji: b.emoji || null,
      role: memberRole({ ...b, id: d.id }, ctx.uid),
      columns: (b.columns || []).map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        cardCount: (c.cards || []).length,
      })),
    }
  })
}

// Projects are scoped per user via `userId` (mirrors src/stores/projects.js).
// Use the returned id as a card's projectId to link tickets to a project.
export async function listProjects(ctx) {
  const db = getDb()
  const snap = await db.collection(PROJECTS_COL)
    .where('userId', '==', ctx.uid)
    .orderBy('createdAt', 'asc')
    .get()
  return snap.docs.map(d => {
    const p = d.data()
    return {
      id: d.id,
      name: p.name,
      emoji: p.emoji || null,
      color: p.color || null,
    }
  })
}

// Default color/emoji mirror src/stores/projects.js createProject().
const DEFAULT_PROJECT_COLOR = '#3b82f6'
const DEFAULT_PROJECT_EMOJI = '📁'

function projectSummary(id, p) {
  return {
    id,
    name: p.name,
    emoji: p.emoji || null,
    color: p.color || null,
  }
}

// Projects are owned by a single user; only the owner may edit or delete them.
async function fetchOwnedProject(uid, projectId) {
  const db = getDb()
  const ref = db.collection(PROJECTS_COL).doc(projectId)
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError(`Project "${projectId}" not found`, 'not_found')
  const project = snap.data()
  if (project.userId !== uid) {
    throw new ApiError('You do not have access to this project', 'permission_denied')
  }
  return { ref, project }
}

export async function createProject(ctx, { name, color, emoji }) {
  assertWriteScope(ctx)
  if (!name || !name.trim()) throw new ApiError('Project name is required', 'invalid_argument')
  const db = getDb()
  const data = {
    name: name.trim(),
    color: color || DEFAULT_PROJECT_COLOR,
    emoji: emoji || DEFAULT_PROJECT_EMOJI,
    userId: ctx.uid,
    createdAt: FieldValue.serverTimestamp(),
  }
  const ref = await db.collection(PROJECTS_COL).add(data)
  return projectSummary(ref.id, data)
}

export async function updateProject(ctx, { projectId, name, color, emoji }) {
  assertWriteScope(ctx)
  const { ref, project } = await fetchOwnedProject(ctx.uid, projectId)

  const updates = {}
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError('Project name cannot be empty', 'invalid_argument')
    updates.name = name.trim()
  }
  if (color !== undefined) updates.color = color
  if (emoji !== undefined) updates.emoji = emoji
  if (Object.keys(updates).length === 0) {
    throw new ApiError('Provide at least one field to update (name, color, emoji)', 'invalid_argument')
  }

  await ref.update(updates)
  return projectSummary(projectId, { ...project, ...updates })
}

export async function deleteProject(ctx, { projectId }) {
  assertWriteScope(ctx)
  const { ref, project } = await fetchOwnedProject(ctx.uid, projectId)
  await ref.delete()
  return { deleted: { id: projectId, name: project.name } }
}

export async function getBoard(ctx, { boardId }) {
  const { board } = await fetchBoardDoc(boardId)
  assertMember(board, ctx.uid)
  return {
    id: board.id,
    name: board.name,
    emoji: board.emoji || null,
    role: memberRole(board, ctx.uid),
    columns: (board.columns || []).map(col => ({
      id: col.id,
      name: col.name,
      color: col.color,
      cards: (col.cards || []).map(cardSummary),
    })),
  }
}

export async function createTicket(ctx, args) {
  assertWriteScope(ctx)
  const { boardId, column, title, description, labels, projectId, assigneeUid, assigneeEmail } = args
  if (!title || !title.trim()) throw new ApiError('Ticket title is required', 'invalid_argument')

  const { ref, board } = await fetchBoardDoc(boardId)
  assertCanEdit(board, ctx.uid)
  const col = resolveColumn(board, column)

  let assignee = null
  if (assigneeUid || assigneeEmail) {
    assignee = await resolveAssignee(board, { assigneeUid, assigneeEmail })
  }

  const now = Date.now()
  const card = {
    id: generateId(),
    title: title.trim(),
    description: (description || '').trim(),
    labels: Array.isArray(labels) ? labels : [],
    images: [],
    assignee,
    projectId: projectId || null,
    createdBy: ctx.user,
    updatedBy: ctx.user,
    createdAt: now,
    updatedAt: now,
  }

  col.cards = col.cards || []
  col.cards.push(card)
  await persistColumns(ref, board.columns)
  return { boardId, columnId: col.id, columnName: col.name, card: cardSummary(card) }
}

export async function moveTicket(ctx, { boardId, cardId, toColumn, toIndex }) {
  assertWriteScope(ctx)
  const { ref, board } = await fetchBoardDoc(boardId)
  assertCanEdit(board, ctx.uid)

  const { column: fromCol, index } = findCard(board, cardId)
  const toCol = resolveColumn(board, toColumn)

  const [card] = fromCol.cards.splice(index, 1)
  toCol.cards = toCol.cards || []
  let insertAt = toCol.cards.length
  if (Number.isInteger(toIndex) && toIndex >= 0 && toIndex <= toCol.cards.length) {
    insertAt = toIndex
  }
  toCol.cards.splice(insertAt, 0, card)

  await persistColumns(ref, board.columns)
  return {
    boardId,
    cardId,
    from: { columnId: fromCol.id, columnName: fromCol.name },
    to: { columnId: toCol.id, columnName: toCol.name, index: insertAt },
  }
}

export async function updateTicket(ctx, { boardId, cardId, title, description, labels, projectId }) {
  assertWriteScope(ctx)
  const { ref, board } = await fetchBoardDoc(boardId)
  assertCanEdit(board, ctx.uid)
  const { card } = findCard(board, cardId)

  if (title !== undefined) {
    if (!title.trim()) throw new ApiError('Title cannot be empty', 'invalid_argument')
    card.title = title.trim()
  }
  if (description !== undefined) card.description = description
  if (labels !== undefined) card.labels = Array.isArray(labels) ? labels : []
  if (projectId !== undefined) card.projectId = projectId || null
  card.updatedAt = Date.now()
  card.updatedBy = ctx.user

  await persistColumns(ref, board.columns)
  return { boardId, card: cardSummary(card) }
}

export async function assignTicket(ctx, { boardId, cardId, assigneeUid, assigneeEmail, unassign }) {
  assertWriteScope(ctx)
  const { ref, board } = await fetchBoardDoc(boardId)
  assertCanEdit(board, ctx.uid)
  const { card } = findCard(board, cardId)

  card.assignee = unassign ? null : await resolveAssignee(board, { assigneeUid, assigneeEmail })
  card.updatedAt = Date.now()
  card.updatedBy = ctx.user

  await persistColumns(ref, board.columns)
  return { boardId, cardId, assignee: card.assignee }
}

export async function deleteTicket(ctx, { boardId, cardId }) {
  assertWriteScope(ctx)
  const { ref, board } = await fetchBoardDoc(boardId)
  assertCanEdit(board, ctx.uid)
  const { column, index } = findCard(board, cardId)
  const [removed] = column.cards.splice(index, 1)
  await persistColumns(ref, board.columns)
  return { boardId, deleted: { id: removed.id, title: removed.title, columnName: column.name } }
}
