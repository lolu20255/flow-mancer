import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, auth } from '../firebase.js'
import { collection, onSnapshot, query, where } from 'firebase/firestore'

const AGENT_SESSIONS_COL = 'agentSessions'

// A session whose last update is older than this is treated as stale (the agent
// likely crashed without firing its stop hook). The window is generous because
// a single long turn only refreshes at start, not on every tool call.
const STALE_MS = 20 * 60 * 1000

export const useAgentStore = defineStore('agents', () => {
  const sessions = ref([])
  const loading = ref(true)
  const now = ref(Date.now())
  let unsubscribe = null
  let ticker = null

  function init() {
    if (unsubscribe) return
    const uid = auth.currentUser?.uid
    if (!uid) return
    const q = query(collection(db, AGENT_SESSIONS_COL), where('userId', '==', uid))
    unsubscribe = onSnapshot(q, (snapshot) => {
      sessions.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    }, (err) => {
      console.error('Agent sessions listener error:', err)
      loading.value = false
    })
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
  }

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
    sessions.value = []
    loading.value = true
  }

  const decorated = computed(() =>
    sessions.value.map(s => {
      const stale = now.value - (s.updatedAt || 0) > STALE_MS
      return { ...s, stale, waiting: !stale && s.status === 'waiting' }
    })
  )

  // Group sessions into one entry per project for the monitor cards.
  const groups = computed(() => {
    const byProject = new Map()
    for (const session of decorated.value) {
      const key = session.projectId || '__unassigned__'
      if (!byProject.has(key)) {
        byProject.set(key, {
          key,
          projectId: session.projectId || null,
          name: session.projectName || 'Unassigned',
          emoji: session.projectEmoji || '🤖',
          color: session.projectColor || '#6b7280',
          sessions: [],
        })
      }
      byProject.get(key).sessions.push(session)
    }
    for (const group of byProject.values()) {
      group.sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      group.working = group.sessions.filter(s => !s.stale && !s.waiting).length
      group.waiting = group.sessions.filter(s => s.waiting).length
      group.lastActivity = Math.max(...group.sessions.map(s => s.updatedAt || 0))
    }
    return [...byProject.values()].sort((a, b) => b.lastActivity - a.lastActivity)
  })

  const hasSessions = computed(() => sessions.value.length > 0)
  const workingCount = computed(() => decorated.value.filter(s => !s.stale && !s.waiting).length)
  const waitingCount = computed(() => decorated.value.filter(s => s.waiting).length)

  return { sessions, loading, groups, hasSessions, workingCount, waitingCount, init, cleanup }
})
