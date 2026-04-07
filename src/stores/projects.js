import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, auth } from '../firebase.js'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp,
} from 'firebase/firestore'

const PROJECTS_COL = 'projects'

const PROJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
]

export { PROJECT_COLORS }

export const useProjectStore = defineStore('projects', () => {
  const projects = ref([])
  const loading = ref(true)
  let unsubscribe = null

  function init() {
    if (unsubscribe) return
    const uid = auth.currentUser?.uid
    if (!uid) return
    const q = query(collection(db, PROJECTS_COL), where('userId', '==', uid), orderBy('createdAt', 'asc'))
    unsubscribe = onSnapshot(q, (snapshot) => {
      projects.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    }, (err) => {
      console.error('Projects listener error:', err)
      loading.value = false
    })
  }

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    projects.value = []
    loading.value = true
  }

  async function createProject(name, color = '#3b82f6', emoji = '📁') {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const docRef = await addDoc(collection(db, PROJECTS_COL), {
      name,
      color,
      emoji,
      userId: uid,
      createdAt: serverTimestamp(),
    })
    return { id: docRef.id, name, color, emoji }
  }

  function getProject(id) {
    return projects.value.find(p => p.id === id)
  }

  async function updateProject(id, updates) {
    const project = getProject(id)
    if (project) Object.assign(project, updates)
    await updateDoc(doc(db, PROJECTS_COL, id), updates)
  }

  async function deleteProject(id) {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value.splice(idx, 1)
    await deleteDoc(doc(db, PROJECTS_COL, id))
  }

  return {
    projects, loading,
    init, cleanup,
    createProject, getProject, updateProject, deleteProject,
  }
})
