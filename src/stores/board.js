import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, storage, auth } from '../firebase.js'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp,
} from 'firebase/firestore'
import {
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage'

const BOARDS_COL = 'boards'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function currentUserInfo() {
  const u = auth.currentUser
  if (!u) return null
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split('@')[0] || 'Unknown',
    photo: u.photoURL || null,
  }
}

const COLUMN_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
]

export { COLUMN_COLORS }

export const useBoardStore = defineStore('board', () => {
  const boards = ref([])
  const loading = ref(true)
  let unsubscribe = null

  // Real-time listener
  function init() {
    if (unsubscribe) return
    const uid = auth.currentUser?.uid
    if (!uid) return
    const q = query(collection(db, BOARDS_COL), where('userId', '==', uid), orderBy('createdAt', 'asc'))
    unsubscribe = onSnapshot(q, (snapshot) => {
      boards.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    }, (err) => {
      console.error('Firestore listener error:', err)
      loading.value = false
    })
  }

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    boards.value = []
    loading.value = true
  }

  // Helper: persist a board's columns array back to Firestore
  async function persistColumns(boardId, columns) {
    await updateDoc(doc(db, BOARDS_COL, boardId), { columns, updatedAt: serverTimestamp() })
  }

  // Board CRUD
  async function createBoard(name, emoji = '📋') {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const user = currentUserInfo()
    const docRef = await addDoc(collection(db, BOARDS_COL), {
      name,
      emoji,
      columns: [],
      userId: uid,
      createdBy: user,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id, name, emoji, columns: [] }
  }

  function getBoard(id) {
    return boards.value.find(b => b.id === id)
  }

  async function updateBoard(id, updates) {
    const board = getBoard(id)
    if (!board) return
    Object.assign(board, updates)
    await updateDoc(doc(db, BOARDS_COL, id), { ...updates, updatedAt: serverTimestamp() })
  }

  async function deleteBoard(id) {
    const idx = boards.value.findIndex(b => b.id === id)
    if (idx !== -1) boards.value.splice(idx, 1)
    await deleteDoc(doc(db, BOARDS_COL, id))
  }

  // Column CRUD
  async function addColumn(boardId, name, color = '#3b82f6') {
    const board = getBoard(boardId)
    if (!board) return
    const column = { id: generateId(), name, color, cards: [] }
    board.columns.push(column)
    await persistColumns(boardId, board.columns)
    return column
  }

  async function updateColumn(boardId, columnId, updates) {
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (col) Object.assign(col, updates)
    await persistColumns(boardId, board.columns)
  }

  async function deleteColumn(boardId, columnId) {
    const board = getBoard(boardId)
    if (!board) return
    const idx = board.columns.findIndex(c => c.id === columnId)
    if (idx !== -1) board.columns.splice(idx, 1)
    await persistColumns(boardId, board.columns)
  }

  async function moveColumn(boardId, fromIndex, toIndex) {
    const board = getBoard(boardId)
    if (!board) return
    const [col] = board.columns.splice(fromIndex, 1)
    board.columns.splice(toIndex, 0, col)
    await persistColumns(boardId, board.columns)
  }

  // Card CRUD
  async function addCard(boardId, columnId, title, description = '') {
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (!col) return
    const user = currentUserInfo()
    const card = {
      id: generateId(),
      title,
      description,
      labels: [],
      images: [],
      createdBy: user,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    col.cards.push(card)
    await persistColumns(boardId, board.columns)
    return card
  }

  async function updateCard(boardId, columnId, cardId, updates) {
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (!col) return
    const card = col.cards.find(c => c.id === cardId)
    if (card) {
      const user = currentUserInfo()
      Object.assign(card, updates, { updatedAt: Date.now(), updatedBy: user })
    }
    await persistColumns(boardId, board.columns)
  }

  async function deleteCard(boardId, columnId, cardId) {
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (!col) return
    const idx = col.cards.findIndex(c => c.id === cardId)
    if (idx !== -1) col.cards.splice(idx, 1)
    await persistColumns(boardId, board.columns)
  }

  async function moveCard(boardId, fromColumnId, toColumnId, fromIndex, toIndex) {
    const board = getBoard(boardId)
    if (!board) return
    const fromCol = board.columns.find(c => c.id === fromColumnId)
    const toCol = board.columns.find(c => c.id === toColumnId)
    if (!fromCol || !toCol) return
    const [card] = fromCol.cards.splice(fromIndex, 1)
    toCol.cards.splice(toIndex, 0, card)
    await persistColumns(boardId, board.columns)
  }

  // Image upload to Firebase Storage
  async function uploadCardImage(boardId, columnId, cardId, file) {
    const path = `boards/${boardId}/${cardId}/${Date.now()}_${file.name}`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file)
    const url = await getDownloadURL(fileRef)
    // Add image to card
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (!col) return
    const card = col.cards.find(c => c.id === cardId)
    if (!card) return
    if (!card.images) card.images = []
    card.images.push({ url, path, name: file.name })
    await persistColumns(boardId, board.columns)
    return { url, path, name: file.name }
  }

  async function deleteCardImage(boardId, columnId, cardId, image) {
    // Delete from Storage
    try {
      await deleteObject(storageRef(storage, image.path))
    } catch (e) {
      console.warn('Could not delete storage object:', e)
    }
    // Remove from card data
    const board = getBoard(boardId)
    if (!board) return
    const col = board.columns.find(c => c.id === columnId)
    if (!col) return
    const card = col.cards.find(c => c.id === cardId)
    if (!card || !card.images) return
    card.images = card.images.filter(img => img.path !== image.path)
    await persistColumns(boardId, board.columns)
  }

  return {
    boards, loading,
    init, cleanup,
    createBoard, getBoard, updateBoard, deleteBoard,
    addColumn, updateColumn, deleteColumn, moveColumn,
    addCard, updateCard, deleteCard, moveCard,
    uploadCardImage, deleteCardImage,
  }
})
