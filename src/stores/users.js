import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, auth } from '../firebase.js'
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore'

const USERS_COL = 'users'

export const useUsersStore = defineStore('users', () => {
  const users = ref([])
  const loaded = ref(false)

  async function upsertCurrentUser() {
    const u = auth.currentUser
    if (!u) return
    const profile = {
      uid: u.uid,
      name: u.displayName || u.email?.split('@')[0] || 'Unknown',
      email: u.email || '',
      photo: u.photoURL || null,
    }
    const ref_ = doc(db, USERS_COL, u.uid)
    const snap = await getDoc(ref_)
    if (!snap.exists()) {
      await setDoc(ref_, { ...profile, createdAt: serverTimestamp() })
    } else {
      const prev = snap.data()
      if (prev.name !== profile.name || prev.email !== profile.email || prev.photo !== profile.photo) {
        await setDoc(ref_, profile, { merge: true })
      }
    }
  }

  async function loadAll() {
    const snap = await getDocs(collection(db, USERS_COL))
    users.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    loaded.value = true
  }

  async function ensureLoaded() {
    if (!loaded.value) await loadAll()
  }

  function searchUsers(query) {
    const q = query.trim().toLowerCase()
    if (!q) return users.value.slice(0, 8)
    return users.value
      .filter(u => {
        return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
      })
      .slice(0, 8)
  }

  function getUser(uid) {
    return users.value.find(u => u.uid === uid)
  }

  function reset() {
    users.value = []
    loaded.value = false
  }

  return { users, loaded, upsertCurrentUser, loadAll, ensureLoaded, searchUsers, getUser, reset }
})
