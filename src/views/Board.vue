<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import KanbanColumn from '../components/KanbanColumn.vue'
import AddColumnButton from '../components/AddColumnButton.vue'
import EditBoardModal from '../components/EditBoardModal.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()
const store = useBoardStore()
const projectStore = useProjectStore()

const board = computed(() => store.getBoard(route.params.id))
const showEditBoard = ref(false)
const filterProjectIds = ref(new Set())

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

function toggleFilter(projectId) {
  const next = new Set(filterProjectIds.value)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  filterProjectIds.value = next
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
</script>

<template>
  <div class="h-full flex flex-col bg-forge-950" v-if="board">
    <!-- Board Header -->
    <header class="shrink-0 border-b border-forge-800/60 px-6 py-4">
      <div class="flex items-center gap-4">
        <button @click="goBack"
          class="p-2 rounded-lg text-forge-400 hover:text-forge-100 hover:bg-forge-800 transition-all duration-200 cursor-pointer">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button @click="showEditBoard = true"
          class="flex items-center gap-2.5 group cursor-pointer bg-transparent border-0 p-0">
          <span class="text-2xl">{{ board.emoji }}</span>
          <h1 class="font-display text-xl font-medium text-forge-50 group-hover:text-forge-50 transition-colors">
            {{ board.name }}
          </h1>
          <svg class="w-3.5 h-3.5 text-forge-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>

        <div class="ml-auto flex items-center gap-4">
          <div class="flex items-center gap-2 text-forge-500 text-xs">
            <span>{{ board.columns.length }} columns</span>
            <span class="w-1 h-1 rounded-full bg-forge-600"></span>
            <span>{{board.columns.reduce((sum, col) => sum + col.cards.length, 0)}} cards</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Project Filter -->
    <div v-if="boardProjects.length" class="shrink-0 px-8 pt-3 flex items-center gap-2 animate-fade-in">
      <span class="text-[11px] font-medium uppercase tracking-widest text-forge-500 mr-1">Filter by Project</span>
      <button v-for="project in boardProjects" :key="project.id" @click="toggleFilter(project.id)"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border"
        :class="filterProjectIds.has(project.id)
          ? 'text-forge-50 border-transparent shadow-md'
          : 'text-forge-400 border-forge-700/40 hover:text-forge-200 hover:border-forge-600/60 bg-forge-900/50'"
        :style="filterProjectIds.has(project.id)
          ? { backgroundColor: project.color + 'cc', boxShadow: `0 2px 8px ${project.color}30` }
          : {}">
        <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: project.color }"></div>
        <span>{{ project.emoji }} {{ project.name }}</span>
      </button>
      <button v-if="filterProjectIds.size" @click="filterProjectIds = new Set()"
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
          :index="index" :filter-project-ids="filterProjectIds" :drag-card="dragCard"
          :style="{ animationDelay: `${index * 80}ms` }" class="animate-fade-in-up" draggable="true"
          @dragstart.self="onColumnDragStart(index)" @dragover.self="onColumnDragOver($event, index)"
          @dragend.self="onColumnDragEnd" @card-drag-start="onCardDragStart" @card-drop="onCardDrop"
          @card-drag-end="onCardDragEnd" />
        <AddColumnButton :board-id="board.id" />
      </div>
    </main>

    <!-- Edit Board Modal -->
    <EditBoardModal v-if="showEditBoard" :board="board" @close="showEditBoard = false" />
  </div>

  <div v-else class="h-full flex items-center justify-center bg-forge-950">
    <div class="text-center">
      <p class="text-forge-400 text-lg mb-4">Board not found</p>
      <button @click="goBack" class="text-ember hover:text-ember-glow transition-colors cursor-pointer">
        Back to Dashboard
      </button>
    </div>
  </div>
</template>
