<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import { useAgentStore } from '../stores/agents.js'
import KanbanColumn from '../components/KanbanColumn.vue'
import AddColumnButton from '../components/AddColumnButton.vue'
import EditBoardModal from '../components/EditBoardModal.vue'
import ManageLabelsModal from '../components/ManageLabelsModal.vue'
import ShareBoardModal from '../components/ShareBoardModal.vue'
import AgentList from '../components/AgentList.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()
const store = useBoardStore()
const projectStore = useProjectStore()
const agentStore = useAgentStore()

// "Check agents" button: live presence of agents working across all repos.
const showAgents = ref(false)
const agentCount = computed(() => agentStore.workingCount + agentStore.waitingCount)
const agentSummary = computed(() => {
  const parts = []
  if (agentStore.workingCount) parts.push(`${agentStore.workingCount} working`)
  if (agentStore.waitingCount) parts.push(`${agentStore.waitingCount} waiting`)
  return parts.length ? parts.join(' · ') : 'All idle'
})

const board = computed(() => store.getBoard(route.params.id))
const showEditBoard = ref(false)
const showManageLabels = ref(false)
const showShareBoard = ref(false)

const myRole = computed(() => board.value ? store.myRole(board.value.id) : null)
const canEdit = computed(() => myRole.value === 'owner' || myRole.value === 'editor')
const isOwner = computed(() => myRole.value === 'owner')
const filterProjectIds = ref(new Set())
const filterLabels = ref(new Set())

// Projects that are actually used in this board's cards
const boardProjects = computed(() => {
  if (!board.value) return []
  const usedIds = new Set()
  for (const col of board.value.columns) {
    for (const card of col.cards) {
      if (card.projectId) usedIds.add(card.projectId)
    }
  }
  return projectStore.projects.filter(p => usedIds.has(p.id))
})

const boardLabels = computed(() => {
  if (!board.value) return []
  const set = new Set()
  for (const col of board.value.columns) {
    for (const card of col.cards) {
      for (const l of card.labels || []) set.add(l)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

function toggleFilter(projectId) {
  const next = new Set(filterProjectIds.value)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  filterProjectIds.value = next
}

// Project filter dropdown (searchable multi-select; scales past a long row).
// The panel is teleported to <body> with fixed positioning so it always sits
// above the kanban columns (which create their own stacking contexts).
const showProjectFilter = ref(false)
const projectSearch = ref('')
const projectFilterRef = ref(null)
const projectPanelRef = ref(null)
const filterMenuStyle = ref({})

const filteredBoardProjects = computed(() => {
  const q = projectSearch.value.trim().toLowerCase()
  if (!q) return boardProjects.value
  return boardProjects.value.filter(p => (p.name || '').toLowerCase().includes(q))
})

const selectedProjects = computed(() =>
  boardProjects.value.filter(p => filterProjectIds.value.has(p.id))
)

function toggleProjectFilter() {
  if (showProjectFilter.value) {
    showProjectFilter.value = false
    return
  }
  const rect = projectFilterRef.value?.getBoundingClientRect()
  if (rect) {
    filterMenuStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
    }
  }
  projectSearch.value = ''
  showProjectFilter.value = true
}

function clearProjectFilter() {
  filterProjectIds.value = new Set()
}

function onFilterPointerDown(e) {
  if (projectFilterRef.value?.contains(e.target)) return
  if (projectPanelRef.value?.contains(e.target)) return
  showProjectFilter.value = false
}

function toggleLabelFilter(label) {
  const next = new Set(filterLabels.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  filterLabels.value = next
}

// Drag state for columns
const dragColumnIndex = ref(null)

function onColumnDragStart(index) {
  dragColumnIndex.value = index
}

function onColumnDragOver(e, index) {
  e.preventDefault()
  if (dragColumnIndex.value === null || dragColumnIndex.value === index) return
  store.moveColumn(board.value.id, dragColumnIndex.value, index)
  dragColumnIndex.value = index
}

function onColumnDragEnd() {
  dragColumnIndex.value = null
}

// Card drag state shared between columns
const dragCard = ref(null)

function onCardDragStart(columnId, cardIndex) {
  dragCard.value = { columnId, cardIndex }
}

function onCardDrop(toColumnId, toIndex) {
  if (!dragCard.value) return
  store.moveCard(
    board.value.id,
    dragCard.value.columnId,
    toColumnId,
    dragCard.value.cardIndex,
    toIndex
  )
  dragCard.value = null
}

function onCardDragEnd() {
  dragCard.value = null
}

function goBack() {
  router.push({ name: 'dashboard' })
}

// Grace period: avoid flashing "Board not found" during the initial snapshot race
const graceElapsed = ref(false)
let graceTimer = null
onMounted(() => {
  graceTimer = setTimeout(() => { graceElapsed.value = true }, 1500)
  document.addEventListener('pointerdown', onFilterPointerDown)
})
onUnmounted(() => {
  if (graceTimer) clearTimeout(graceTimer)
  document.removeEventListener('pointerdown', onFilterPointerDown)
})

const isLoading = computed(() => store.loading || !graceElapsed.value)
</script>

<template>
  <div class="h-full flex flex-col bg-forge-950" v-if="board">
    <!-- Board Header -->
    <header class="shrink-0 border-b border-forge-800/60 px-6 py-4">
      <div class="flex items-center gap-4">
        <button @click="goBack"
          class="p-2 rounded-xl text-forge-400 hover:text-forge-100 hover:bg-forge-800 transition-all duration-200 cursor-pointer focus-ring">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button @click="canEdit && (showEditBoard = true)"
          :class="['flex items-center gap-2.5 group bg-transparent border-0 p-0', canEdit ? 'cursor-pointer' : 'cursor-default']">
          <span class="text-2xl">{{ board.emoji }}</span>
          <h1 class="font-display text-xl font-medium text-forge-50 group-hover:text-forge-50 transition-colors">
            {{ board.name }}
          </h1>
          <svg v-if="canEdit" class="w-3.5 h-3.5 text-forge-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span v-if="!canEdit && myRole" class="ml-2 px-1.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-forge-800 text-forge-400 border border-forge-700/40">
            {{ myRole }}
          </span>
        </button>

        <div class="ml-auto flex items-center gap-4">
          <div class="flex items-center gap-2 text-forge-500 text-xs">
            <span>{{ board.columns.length }} columns</span>
            <span class="w-1 h-1 rounded-full bg-forge-600"></span>
            <span>{{board.columns.reduce((sum, col) => sum + col.cards.length, 0)}} cards</span>
          </div>
          <button
            v-if="agentStore.hasSessions"
            @click="showAgents = true"
            class="relative flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer focus-ring"
            :class="agentCount > 0
              ? 'bg-ember/10 border-ember/40 text-forge-100 hover:bg-ember/20'
              : 'bg-forge-900 border-forge-700/50 text-forge-300 hover:border-forge-600/60'"
            title="Check running agents"
          >
            <span v-if="agentCount > 0" class="relative flex h-2 w-2 shrink-0">
              <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <svg v-else class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <span>Agents</span>
            <span
              v-if="agentCount > 0"
              class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-ember/20 text-ember leading-none"
            >
              {{ agentCount }}
            </span>
          </button>

          <button @click="showShareBoard = true"
            class="btn-secondary text-sm py-1.5 focus-ring">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
            <span v-if="(board.members || []).length > 1" class="text-forge-500">· {{ (board.members || []).length }}</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Project Filter -->
    <div v-if="boardProjects.length" class="shrink-0 px-8 pt-3 flex items-center gap-2 flex-wrap animate-fade-in">
      <span class="section-label mr-1">Filter by Project</span>

      <!-- Dropdown trigger -->
      <div ref="projectFilterRef">
        <button @click="toggleProjectFilter"
          class="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer focus-ring"
          :class="filterProjectIds.size
            ? 'bg-ember/10 border-ember/40 text-forge-100'
            : 'bg-forge-900 border-forge-700/50 text-forge-300 hover:border-forge-600/60'">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span>{{ filterProjectIds.size ? `${filterProjectIds.size} selected` : 'All projects' }}</span>
          <svg class="w-3.5 h-3.5 shrink-0 transition-transform duration-200" :class="showProjectFilter ? 'rotate-180' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <Teleport to="body">
        <div v-if="showProjectFilter" ref="projectPanelRef" :style="filterMenuStyle"
          class="z-[100] w-72 bg-forge-900 border border-forge-700/50 rounded-xl shadow-soft-lg overflow-hidden animate-scale-in">
          <div class="p-2 border-b border-forge-800/60">
            <input v-model="projectSearch" type="text" placeholder="Search projects…"
              class="input-field text-xs py-1.5" @keydown.escape="showProjectFilter = false" />
          </div>
          <div class="max-h-64 overflow-y-auto py-1">
            <button v-for="project in filteredBoardProjects" :key="project.id" @click="toggleFilter(project.id)"
              class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-forge-800/60 transition-colors cursor-pointer">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: project.color }"></span>
              <span class="shrink-0">{{ project.emoji }}</span>
              <span class="flex-1 truncate" :class="filterProjectIds.has(project.id) ? 'text-forge-50 font-medium' : 'text-forge-200'">{{ project.name }}</span>
              <svg v-if="filterProjectIds.has(project.id)" class="w-4 h-4 text-ember shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <p v-if="!filteredBoardProjects.length" class="px-3 py-4 text-xs text-forge-500 text-center">No projects match.</p>
          </div>
          <button v-if="filterProjectIds.size" @click="clearProjectFilter"
            class="w-full px-3 py-2 text-xs text-forge-400 hover:text-forge-100 hover:bg-forge-800/60 border-t border-forge-800/60 transition-colors cursor-pointer text-left">
            Clear selection ({{ filterProjectIds.size }})
          </button>
        </div>
      </Teleport>

      <!-- Active selections as removable chips -->
      <button v-for="project in selectedProjects" :key="project.id" @click="toggleFilter(project.id)"
        class="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-[11px] font-medium text-forge-50 cursor-pointer transition-transform duration-150 hover:scale-95"
        :style="{ backgroundColor: project.color + 'dd', boxShadow: `0 2px 8px ${project.color}30` }"
        title="Remove from filter">
        <span class="truncate max-w-[10rem]">{{ project.emoji }} {{ project.name }}</span>
        <svg class="w-3 h-3 opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Label Filter -->
    <div v-if="boardLabels.length" class="shrink-0 px-8 pt-2 flex items-center gap-2 flex-wrap animate-fade-in">
      <span class="section-label mr-1">Filter by Label</span>
      <button v-for="label in boardLabels" :key="label" @click="toggleLabelFilter(label)"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border"
        :class="filterLabels.has(label)
          ? 'text-forge-50 border-transparent shadow-soft'
          : 'text-forge-400 border-forge-700/40 hover:text-forge-200 hover:border-forge-600/60 bg-forge-900/50'"
        :style="filterLabels.has(label)
          ? { backgroundColor: (board.labelColors?.[label] || '#6366f1'), boxShadow: `0 2px 8px ${(board.labelColors?.[label] || '#6366f1')}30` }
          : {}">
        <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: board.labelColors?.[label] || '#6366f1' }"></div>
        <span>{{ label }}</span>
      </button>
      <button v-if="canEdit" @click="showManageLabels = true"
        class="ml-1 p-1 rounded-full text-forge-500 hover:text-forge-200 hover:bg-forge-800/50 transition-colors cursor-pointer"
        title="Manage labels">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <button v-if="filterLabels.size" @click="filterLabels = new Set()"
        class="ml-1 p-1 rounded-full text-forge-500 hover:text-forge-300 hover:bg-forge-800/50 transition-colors cursor-pointer"
        title="Clear filter">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Kanban Board -->
    <main class="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
      <div class="flex gap-4 h-full items-start">
        <KanbanColumn v-for="(column, index) in board.columns" :key="column.id" :board-id="board.id" :column="column"
          :index="index" :filter-project-ids="filterProjectIds" :filter-labels="filterLabels" :drag-card="dragCard"
          :can-edit="canEdit"
          :style="{ animationDelay: `${index * 80}ms` }" class="animate-fade-in-up" :draggable="canEdit"
          @dragstart.self="canEdit && onColumnDragStart(index)" @dragover.self="canEdit && onColumnDragOver($event, index)"
          @dragend.self="onColumnDragEnd" @card-drag-start="onCardDragStart" @card-drop="onCardDrop"
          @card-drag-end="onCardDragEnd" />
        <AddColumnButton v-if="canEdit" :board-id="board.id" />
      </div>
    </main>

    <!-- Edit Board Modal -->
    <EditBoardModal v-if="showEditBoard && canEdit" :board="board" @close="showEditBoard = false" />

    <!-- Manage Labels Modal -->
    <ManageLabelsModal v-if="showManageLabels && canEdit" :board="board" @close="showManageLabels = false" />

    <!-- Share Board Modal -->
    <ShareBoardModal v-if="showShareBoard" :board="board" @close="showShareBoard = false" />

    <!-- Agents Modal -->
    <Teleport to="body">
      <div v-if="showAgents" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="showAgents = false"></div>
        <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl shadow-soft-lg animate-scale-in w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-forge-800/60">
            <div class="flex items-center gap-3">
              <h2 class="font-display text-lg font-semibold text-forge-50">Agents</h2>
              <span class="flex items-center gap-2 text-xs text-forge-400">
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="agentStore.workingCount > 0 ? 'bg-emerald-400 animate-pulse' : agentStore.waitingCount > 0 ? 'wait-dot animate-pulse' : 'bg-forge-600'"
                ></span>
                {{ agentSummary }}
              </span>
            </div>
            <button
              @click="showAgents = false"
              class="p-1.5 rounded-lg text-forge-400 hover:text-forge-100 hover:bg-forge-800 transition-all cursor-pointer focus-ring"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="overflow-y-auto p-6">
            <AgentList />
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <div v-else-if="isLoading" class="h-full flex flex-col items-center justify-center bg-forge-950 gap-4">
    <div class="w-10 h-10 border-2 border-forge-700 border-t-ember rounded-full animate-spin"></div>
    <p class="text-forge-500 text-sm">Loading board…</p>
  </div>

  <div v-else class="h-full flex items-center justify-center bg-forge-950">
    <div class="surface shadow-soft-lg px-8 py-7 text-center animate-scale-in">
      <p class="text-forge-300 text-lg mb-5">Board not found</p>
      <button @click="goBack" class="btn-primary focus-ring">
        Back to Dashboard
      </button>
    </div>
  </div>
</template>
