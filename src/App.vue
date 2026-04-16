<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme.js'
import { useBoardStore } from './stores/board.js'
import { useProjectStore } from './stores/projects.js'
import { useAuthStore } from './stores/auth.js'
import { useUsersStore } from './stores/users.js'

useThemeStore()

const authStore = useAuthStore()
const boardStore = useBoardStore()
const projectStore = useProjectStore()
const usersStore = useUsersStore()

// Start/stop Firestore listeners when auth state changes
watch(() => authStore.isAuthenticated, async (authed) => {
  if (authed) {
    await usersStore.upsertCurrentUser()
    usersStore.loadAll()
    await boardStore.backfillLegacyBoards()
    boardStore.init()
    projectStore.init()
  } else {
    boardStore.cleanup()
    projectStore.cleanup()
    usersStore.reset()
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
