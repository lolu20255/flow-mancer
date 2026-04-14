<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useBoardStore, COLUMN_COLORS } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import KanbanCard from './KanbanCard.vue'
import CardModal from './CardModal.vue'

const props = defineProps({
  boardId: String,
  column: Object,
  index: Number,
  dragCard: Object,
  filterProjectIds: { type: Set, default: () => new Set() },
  filterLabels: { type: Set, default: () => new Set() },
})

const store = useBoardStore()
const labelColors = computed(() => store.getBoard(props.boardId)?.labelColors || {})

const filteredCards = computed(() => {
  const hasProject = props.filterProjectIds.size > 0
  const hasLabel = props.filterLabels.size > 0
  if (!hasProject && !hasLabel) return props.column.cards
  return props.column.cards.filter(c => {
    if (hasProject && !props.filterProjectIds.has(c.projectId)) return false
    if (hasLabel && !(c.labels || []).some(l => props.filterLabels.has(l))) return false
    return true
  })
})

const emit = defineEmits(['card-drag-start', 'card-drop', 'card-drag-end'])

const projectStore = useProjectStore()

// Inline editing column name
const isEditingName = ref(false)
const editName = ref('')
const nameInput = ref(null)

function startEditName() {
  editName.value = props.column.name
  isEditingName.value = true
  setTimeout(() => nameInput.value?.focus(), 30)
}

function saveName() {
  if (editName.value.trim()) {
    store.updateColumn(props.boardId, props.column.id, { name: editName.value.trim() })
  }
  isEditingName.value = false
}

// Color picker
const showColorPicker = ref(false)
const colorPickerRef = ref(null)
const colorDotRef = ref(null)

function onClickOutside(e) {
  if (!showColorPicker.value) return
  if (colorPickerRef.value?.contains(e.target)) return
  if (colorDotRef.value?.contains(e.target)) return
  showColorPicker.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onClickOutside))

function setColor(color) {
  store.updateColumn(props.boardId, props.column.id, { color })
  showColorPicker.value = false
}

// Add card
const showAddCard = ref(false)
const newCardTitle = ref('')
const newCardProjectId = ref(null)
const showProjectPicker = ref(false)
const addCardInput = ref(null)

function openAddCard() {
  showAddCard.value = true
  newCardTitle.value = ''
  newCardProjectId.value = null
  showProjectPicker.value = false
  setTimeout(() => addCardInput.value?.focus(), 30)
}

async function addCard() {
  if (!newCardTitle.value.trim()) return
  const card = await store.addCard(props.boardId, props.column.id, newCardTitle.value.trim())
  if (card && newCardProjectId.value) {
    await store.updateCard(props.boardId, props.column.id, card.id, { projectId: newCardProjectId.value })
  }
  newCardTitle.value = ''
  newCardProjectId.value = null
  addCardInput.value?.focus()
}

function cancelAddCard() {
  showAddCard.value = false
  newCardTitle.value = ''
  newCardProjectId.value = null
  showProjectPicker.value = false
}

const selectedProject = computed(() =>
  newCardProjectId.value ? projectStore.getProject(newCardProjectId.value) : null
)

// Card editing modal
const editingCard = ref(null)

function openCardModal(card) {
  editingCard.value = card
}

// Delete column
function deleteColumn() {
  store.deleteColumn(props.boardId, props.column.id)
}

// Card drag handlers
const dropTargetIndex = ref(null)

function onCardDragStart(e, cardIndex) {
  e.dataTransfer.effectAllowed = 'move'
  emit('card-drag-start', props.column.id, cardIndex)
}

function onCardDragOver(e, cardIndex) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropTargetIndex.value = cardIndex
}

function onCardDragOverColumn(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropTargetIndex.value = props.column.cards.length
}

function onCardDrop(e) {
  e.preventDefault()
  emit('card-drop', props.column.id, dropTargetIndex.value ?? props.column.cards.length)
  dropTargetIndex.value = null
}

function onCardDragLeave() {
  dropTargetIndex.value = null
}

function onCardDragEnd() {
  dropTargetIndex.value = null
  emit('card-drag-end')
}

const accentBg = computed(() => `${props.column.color}15`)
const accentBorder = computed(() => `${props.column.color}30`)
</script>

<template>
  <div
    class="shrink-0 w-72 flex flex-col max-h-full rounded-xl border bg-forge-900/80"
    :style="{ borderColor: accentBorder }"
    @dragover.prevent="onCardDragOverColumn"
    @drop="onCardDrop"
    @dragleave="onCardDragLeave"
  >
    <!-- Column Header -->
    <div
      class="shrink-0 px-3.5 py-3 flex items-center gap-2 cursor-grab active:cursor-grabbing"
    >
      <!-- Color dot + picker -->
      <div class="relative">
        <button
          ref="colorDotRef"
          @click.stop="showColorPicker = !showColorPicker"
          class="w-3 h-3 rounded-full shrink-0 cursor-pointer border-0 p-0 transition-transform hover:scale-125"
          :style="{ backgroundColor: column.color, boxShadow: `0 0 8px ${column.color}50` }"
        ></button>

        <!-- Color picker dropdown -->
        <div
          v-if="showColorPicker"
          ref="colorPickerRef"
          class="absolute top-7 -left-1.5 z-30 w-52 bg-forge-800 border border-forge-700/50 rounded-xl p-3 shadow-2xl shadow-black/40 animate-scale-in"
        >
          <p class="text-[10px] font-medium uppercase tracking-widest text-forge-400 mb-2 px-0.5">Color</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="color in COLUMN_COLORS"
              :key="color"
              @click="setColor(color)"
              class="w-8 h-8 rounded-lg cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-lg border-2"
              :style="{
                backgroundColor: color,
                boxShadow: color === column.color ? `0 0 10px ${color}60` : 'none',
              }"
              :class="color === column.color ? 'border-white scale-110' : 'border-transparent'"
            ></button>
          </div>
        </div>
      </div>

      <!-- Name -->
      <div v-if="!isEditingName" @dblclick="startEditName" class="flex-1 min-w-0 flex items-center gap-2">
        <span class="text-sm font-semibold text-forge-100 truncate">{{ column.name }}</span>
        <span class="text-xs text-forge-500 tabular-nums">{{ filteredCards.length }}</span>
      </div>
      <input
        v-else
        ref="nameInput"
        v-model="editName"
        @blur="saveName"
        @keydown.enter="saveName"
        @keydown.escape="isEditingName = false"
        class="flex-1 min-w-0 text-sm font-semibold text-forge-100 bg-forge-800 border border-forge-600 rounded px-2 py-0.5 focus:outline-none focus:border-ember/50"
      />

      <!-- Column menu -->
      <div class="flex items-center gap-0.5">
        <button
          @click.stop="openAddCard"
          class="p-1 rounded text-forge-500 hover:text-forge-200 hover:bg-forge-700/50 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          @click.stop="deleteColumn"
          class="p-1 rounded text-forge-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Accent line -->
    <div class="mx-3 h-px" :style="{ backgroundColor: accentBorder }"></div>

    <!-- Cards -->
    <div class="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 min-h-[60px]">
      <KanbanCard
        v-for="card in filteredCards"
        :key="card.id"
        :card="card"
        :column-color="column.color"
        :label-colors="labelColors"
        draggable="true"
        @dragstart="onCardDragStart($event, column.cards.indexOf(card))"
        @dragover="onCardDragOver($event, column.cards.indexOf(card))"
        @dragend="onCardDragEnd"
        @click="openCardModal(card)"
      />

      <!-- Drop indicator -->
      <div
        v-if="dropTargetIndex !== null && dragCard && dragCard.columnId !== column.id"
        class="h-1 rounded-full mx-2 transition-all"
        :style="{ backgroundColor: column.color }"
      ></div>

      <!-- Add card inline -->
      <div v-if="showAddCard" class="animate-fade-in" @mousedown.stop>
        <textarea
          ref="addCardInput"
          v-model="newCardTitle"
          @keydown.enter.prevent="addCard"
          @keydown.escape="cancelAddCard"
          placeholder="Card title..."
          rows="2"
          class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-3 py-2 text-sm text-forge-100 placeholder-forge-500 resize-none focus:outline-none focus:border-ember/40"
        ></textarea>

        <!-- Quick project assign -->
        <div v-if="projectStore.projects.length" class="flex items-center gap-1.5 mt-1.5">
          <div class="relative">
          <button
            @click="showProjectPicker = !showProjectPicker"
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer"
            :class="selectedProject
              ? 'bg-forge-800 text-forge-200 border border-forge-700/40'
              : 'text-forge-500 hover:text-forge-300 hover:bg-forge-800/50'"
          >
            <template v-if="selectedProject">
              <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: selectedProject.color }"></div>
              <span>{{ selectedProject.emoji }} {{ selectedProject.name }}</span>
              <svg
                class="w-3 h-3 text-forge-500 hover:text-forge-300 ml-0.5"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                @click.stop="newCardProjectId = null"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </template>
            <template v-else>
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Project
            </template>
          </button>

          <!-- Dropdown -->
          <div
            v-if="showProjectPicker"
            class="absolute bottom-full left-0 mb-1 z-20 w-44 max-h-48 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 animate-scale-in"
          >
            <button
              v-for="project in projectStore.projects"
              :key="project.id"
              @click="newCardProjectId = project.id; showProjectPicker = false"
              class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
              :class="newCardProjectId === project.id ? 'bg-forge-700/30' : ''"
            >
              <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: project.color }"></div>
              <span class="text-xs">{{ project.emoji }}</span>
              <span class="text-xs text-forge-200 truncate">{{ project.name }}</span>
            </button>
          </div>
          </div>

          <!-- Create button -->
          <button
            @click="addCard"
            :disabled="!newCardTitle.trim()"
            class="px-2.5 py-1 rounded-md bg-ember hover:bg-ember-glow disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-all cursor-pointer shrink-0"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Add card button (bottom) -->
    <div class="shrink-0 px-2.5 pb-2.5">
      <button
        v-if="!showAddCard"
        @click="openAddCard"
        class="w-full py-2 text-sm text-forge-500 hover:text-forge-200 hover:bg-forge-800/50 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add card
      </button>
    </div>

    <!-- Card Edit Modal -->
    <CardModal
      v-if="editingCard"
      :card="editingCard"
      :board-id="boardId"
      :column-id="column.id"
      :column-color="column.color"
      :label-colors="labelColors"
      @close="editingCard = null"
    />
  </div>
</template>
