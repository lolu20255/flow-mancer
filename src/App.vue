<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme.js'
import { useBoardStore } from './stores/board.js'
import { useProjectStore } from './stores/projects.js'
import { useAuthStore } from './stores/auth.js'

useThemeStore()

const authStore = useAuthStore()
const boardStore = useBoardStore()
const projectStore = useProjectStore()

// Start/stop Firestore listeners when auth state changes
watch(() => authStore.isAuthenticated, (authed) => {
  if (authed) {
    boardStore.init()
    projectStore.init()
  } else {
    boardStore.cleanup()
    projectStore.cleanup()
  }
}, { immediate: true })

onUnmounted(() => {
  boardStore.cleanup()
  projectStore.cleanup()
})
</script>

<template>
  <!-- Show loading while auth resolves -->
  <div v-if="authStore.loading" class="h-screen flex items-center justify-center bg-forge-950">
    <div class="w-8 h-8 border-2 border-forge-700 border-t-ember rounded-full animate-spin"></div>
  </div>
  <RouterView v-else />
</template>
