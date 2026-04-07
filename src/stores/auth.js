import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth } from '../firebase.js'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const uid = computed(() => user.value?.uid || null)
  const displayName = computed(() => user.value?.displayName || user.value?.email?.split('@')[0] || '')
  const photoURL = computed(() => user.value?.photoURL || null)

  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (firebaseUser) => {
        user.value = firebaseUser
        loading.value = false
        resolve(firebaseUser)
      })
    })
  }

  async function loginWithGoogle() {
    error.value = null
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      error.value = parseError(e.code)
      throw e
    }
  }

  async function loginWithEmail(email, password) {
    error.value = null
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      error.value = parseError(e.code)
      throw e
    }
  }

  async function registerWithEmail(email, password, name) {
    error.value = null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (name) {
        await updateProfile(cred.user, { displayName: name })
      }
    } catch (e) {
      error.value = parseError(e.code)
      throw e
    }
  }

  async function logout() {
    await signOut(auth)
  }

  function clearError() {
    error.value = null
  }

  return {
    user, loading, error,
    isAuthenticated, uid, displayName, photoURL,
    init, loginWithGoogle, loginWithEmail, registerWithEmail, logout, clearError,
  }
})

function parseError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}
