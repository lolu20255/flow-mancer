import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'vibe-board-theme'

export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  const mode = ref(saved || 'dark')

  function apply() {
    document.documentElement.setAttribute('data-theme', mode.value)
  }

  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
    apply()
  })

  // Apply on init
  apply()

  return { mode, toggle }
})
