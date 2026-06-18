<script setup>
import { computed } from 'vue'
import { useAgentStore } from '../stores/agents.js'
import AgentList from './AgentList.vue'

const agentStore = useAgentStore()

const summary = computed(() => {
  const parts = []
  if (agentStore.workingCount) parts.push(`${agentStore.workingCount} working`)
  if (agentStore.waitingCount) parts.push(`${agentStore.waitingCount} waiting`)
  return parts.length ? parts.join(' · ') : 'All idle'
})

const statusDotClass = computed(() => {
  if (agentStore.workingCount > 0) return 'bg-emerald-400 animate-pulse'
  if (agentStore.waitingCount > 0) return 'wait-dot animate-pulse'
  return 'bg-forge-600'
})
</script>

<template>
  <div v-if="agentStore.hasSessions" class="mb-10">
    <div class="flex items-center justify-between mb-4">
      <p class="section-label">Agents</p>
      <span class="flex items-center gap-2 text-xs text-forge-400">
        <span class="w-1.5 h-1.5 rounded-full" :class="statusDotClass"></span>
        {{ summary }}
      </span>
    </div>

    <AgentList />
  </div>
</template>
