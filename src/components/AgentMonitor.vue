<script setup>
import { computed } from 'vue'
import { useAgentStore } from '../stores/agents.js'

const agentStore = useAgentStore()

const agentGlyphs = {
  claude: '✳️',
  codex: '🧠',
}

function agentGlyph(agent) {
  return agentGlyphs[agent] || '🤖'
}

function elapsed(session) {
  const ms = Date.now() - (session.startedAt || session.updatedAt || Date.now())
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function waitLabel(session) {
  return session.waitReason === 'permission' ? 'Needs approval' : 'Needs your input'
}

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

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="(group, i) in agentStore.groups"
        :key="group.key"
        class="animate-fade-in-up"
        :style="{ animationDelay: `${i * 50}ms` }"
      >
       <div
        class="relative bg-forge-900 border rounded-xl p-4 overflow-hidden transition-colors"
        :class="group.working > 0
          ? 'agent-card-active border-emerald-500/20'
          : group.waiting > 0
            ? 'agent-card-waiting wait-border'
            : 'border-forge-800/60'"
       >
        <div class="relative z-10">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg shrink-0">{{ group.emoji }}</span>
            <span class="text-sm font-semibold text-forge-100 truncate">{{ group.name }}</span>
          </div>
          <span
            v-if="group.working > 0"
            class="relative flex h-2.5 w-2.5 shrink-0"
            title="Agent working"
          >
            <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <span
            v-else-if="group.waiting > 0"
            class="flex items-center gap-1 text-[10px] uppercase tracking-wider wait-text px-1.5 py-0.5 rounded wait-soft border wait-border shrink-0"
            title="Waiting for your input"
          >
            <span class="w-1.5 h-1.5 rounded-full wait-dot animate-pulse"></span>
            waiting
          </span>
          <span
            v-else
            class="text-[10px] uppercase tracking-wider wait-text px-1.5 py-0.5 rounded wait-soft border wait-border shrink-0"
            title="No recent heartbeat; agent may have stopped"
          >
            stale
          </span>
        </div>

        <ul class="space-y-2">
          <li
            v-for="session in group.sessions"
            :key="session.id"
            class="flex items-start gap-2"
            :class="session.stale ? 'opacity-50' : ''"
          >
            <span class="text-xs mt-0.5 shrink-0" :title="session.agent">{{ agentGlyph(session.agent) }}</span>
            <div class="min-w-0 flex-1">
              <p
                class="text-xs truncate"
                :class="session.waiting ? 'wait-text' : 'text-forge-300'"
                :title="session.task || ''"
              >
                {{ session.task || (session.waiting ? 'Waiting for you…' : 'Working…') }}
              </p>
              <p
                v-if="session.waiting"
                class="text-[10px] wait-text font-medium uppercase tracking-wider flex items-center gap-1"
              >
                <span class="w-1 h-1 rounded-full wait-dot animate-pulse"></span>
                {{ waitLabel(session) }}
              </p>
              <p class="text-[10px] text-forge-500 truncate">
                {{ session.agent }} · {{ elapsed(session) }}
                <span v-if="session.host"> · {{ session.host }}</span>
              </p>
            </div>
          </li>
        </ul>
        </div>
       </div>
      </div>
    </div>
  </div>
</template>
