<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import { useUsersStore } from '../stores/users.js'

const props = defineProps({
  card: Object,
  boardId: String,
  columnId: String,
  columnColor: String,
  labelColors: { type: Object, default: () => ({}) },
  canEdit: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])
const store = useBoardStore()
const projectStore = useProjectStore()
const usersStore = useUsersStore()

// The card can be moved between columns from within the modal, so track its
// current column locally and use it for every mutation below.
const currentColumnId = ref(props.columnId)

const boardColumns = computed(() => store.getBoard(props.boardId)?.columns || [])
const currentColumn = computed(() =>
  boardColumns.value.find(c => c.id === currentColumnId.value)
)
const activeColumnColor = computed(() => currentColumn.value?.color || props.columnColor)

function labelColor(label) {
  return props.labelColors[label] || activeColumnColor.value
}

const showStatusDropdown = ref(false)

function moveToColumn(colId) {
  showStatusDropdown.value = false
  if (colId === currentColumnId.value) return
  store.moveCardToColumn(props.boardId, currentColumnId.value, colId, props.card.id)
  currentColumnId.value = colId
}

const title = ref(props.card.title)
const description = ref(props.card.description || '')
const newLabel = ref('')
const titleInput = ref(null)
const descInput = ref(null)

const MAX_DESCRIPTION_HEIGHT = 400

function autoResizeDescription() {
  const el = descInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_DESCRIPTION_HEIGHT)}px`
}
const uploading = ref(false)
const fileInput = ref(null)
const showProjectDropdown = ref(false)
const showLabelSuggestions = ref(false)
const showAssigneeDropdown = ref(false)

const boardMembers = computed(() => {
  const board = store.getBoard(props.boardId)
  if (!board) return []
  return (board.members || []).map(uid => {
    const u = usersStore.getUser(uid)
    return {
      uid,
      name: u?.name || 'Unknown',
      photo: u?.photo || null,
    }
  })
})

function assign(member) {
  const assignee = member
    ? { uid: member.uid, name: member.name, photo: member.photo || null }
    : null
  store.updateCard(props.boardId, currentColumnId.value, props.card.id, { assignee })
  showAssigneeDropdown.value = false
}

const boardLabels = computed(() => {
  const board = store.getBoard(props.boardId)
  if (!board) return []
  const set = new Set()
  for (const col of board.columns || []) {
    for (const c of col.cards || []) {
      for (const l of c.labels || []) set.add(l)
    }
  }
  return [...set]
})

const labelSuggestions = computed(() => {
  const q = newLabel.value.trim().toLowerCase()
  const existing = new Set(props.card.labels || [])
  return boardLabels.value
    .filter(l => !existing.has(l) && (!q || l.toLowerCase().includes(q)))
    .slice(0, 8)
})

onMounted(() => {
  titleInput.value?.focus()
  titleInput.value?.select()
  usersStore.ensureLoaded()
  nextTick(autoResizeDescription)
})

function save() {
  if (!title.value.trim()) return
  store.updateCard(props.boardId, currentColumnId.value, props.card.id, {
    title: title.value.trim(),
    description: description.value.trim(),
  })
  emit('close')
}

function hideSuggestionsSoon() {
  setTimeout(() => { showLabelSuggestions.value = false }, 150)
}

function addLabel(value) {
  const label = (value ?? newLabel.value).trim()
  if (!label) return
  if ((props.card.labels || []).includes(label)) {
    newLabel.value = ''
    showLabelSuggestions.value = false
    return
  }
  const labels = [...(props.card.labels || []), label]
  store.updateCard(props.boardId, currentColumnId.value, props.card.id, { labels })
  newLabel.value = ''
  showLabelSuggestions.value = false
}

function removeLabel(label) {
  const labels = (props.card.labels || []).filter(l => l !== label)
  store.updateCard(props.boardId, currentColumnId.value, props.card.id, { labels })
}

function deleteCard() {
  store.deleteCard(props.boardId, currentColumnId.value, props.card.id)
  emit('close')
}

// Image upload
async function handleFileSelect(e) {
  const files = e.target.files
  if (!files?.length) return
  uploading.value = true
  for (const file of files) {
    await store.uploadCardImage(props.boardId, currentColumnId.value, props.card.id, file)
  }
  uploading.value = false
  if (fileInput.value) fileInput.value.value = ''
}

async function removeImage(image) {
  await store.deleteCardImage(props.boardId, currentColumnId.value, props.card.id, image)
}

// Lightbox
const lightboxUrl = ref(null)

// Date formatting
function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' ? ts : ts.seconds * 1000)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-lg lg:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 animate-scale-in">
        <!-- Color accent bar -->
        <div class="absolute top-0 left-6 right-6 h-0.5 rounded-b" :style="{ backgroundColor: activeColumnColor }"></div>

        <!-- Status / Column -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Status</label>
          <div class="relative">
            <button
              @click="canEdit && (showStatusDropdown = !showStatusDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-left transition-all"
              :class="[showStatusDropdown ? 'border-ember/50 ring-1 ring-ember/25' : '', canEdit ? 'cursor-pointer hover:border-forge-600/50' : 'cursor-default opacity-70']"
            >
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: activeColumnColor }"></span>
              <span class="text-sm text-forge-100 flex-1">{{ currentColumn?.name || 'Unknown' }}</span>
              <svg class="w-4 h-4 text-forge-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown -->
            <div
              v-if="showStatusDropdown"
              class="absolute top-full left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 animate-scale-in"
            >
              <button
                v-for="col in boardColumns"
                :key="col.id"
                @click="moveToColumn(col.id)"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="col.id === currentColumnId ? 'bg-forge-700/30' : ''"
              >
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: col.color }"></span>
                <span class="text-sm text-forge-100 flex-1">{{ col.name }}</span>
                <svg v-if="col.id === currentColumnId" class="w-4 h-4 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Title -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Title</label>
          <input
            ref="titleInput"
            v-model="title"
            @keydown.enter.prevent="save"
            type="text"
            :readonly="!canEdit"
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all read-only:opacity-70"
          />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Description</label>
          <textarea
            ref="descInput"
            v-model="description"
            rows="3"
            placeholder="Add details..."
            :readonly="!canEdit"
            @input="autoResizeDescription"
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 resize-y overflow-y-auto focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all read-only:opacity-70"
          ></textarea>
        </div>

        <!-- Labels -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Labels</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="label in card.labels"
              :key="label"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              :class="canEdit ? 'cursor-pointer' : ''"
              :style="{ backgroundColor: labelColor(label) + '20', color: labelColor(label) }"
              @click="canEdit && removeLabel(label)"
            >
              {{ label }}
              <svg v-if="canEdit" class="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </div>
          <div v-if="canEdit" class="flex gap-2 relative">
            <div class="flex-1 relative">
              <input
                v-model="newLabel"
                @keydown.enter.prevent="addLabel()"
                @focus="showLabelSuggestions = true"
                @blur="hideSuggestionsSoon"
                type="text"
                placeholder="Add label..."
                class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-3 py-1.5 text-sm text-forge-100 placeholder-forge-500 focus:outline-none focus:border-ember/40"
              />
              <div
                v-if="showLabelSuggestions && labelSuggestions.length"
                class="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 animate-scale-in"
              >
                <button
                  v-for="suggestion in labelSuggestions"
                  :key="suggestion"
                  type="button"
                  @mousedown.prevent="addLabel(suggestion)"
                  class="w-full text-left px-3 py-1.5 text-xs text-forge-200 hover:bg-forge-700/50 transition-colors cursor-pointer"
                >
                  {{ suggestion }}
                </button>
              </div>
            </div>
            <button
              @click="addLabel()"
              :disabled="!newLabel.trim()"
              class="px-3 py-1.5 text-xs text-ember hover:text-ember-glow disabled:opacity-40 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        <!-- Project -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Project</label>
          <div class="relative">
            <button
              @click="canEdit && (showProjectDropdown = !showProjectDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-left transition-all"
              :class="[showProjectDropdown ? 'border-ember/50 ring-1 ring-ember/25' : '', canEdit ? 'cursor-pointer hover:border-forge-600/50' : 'cursor-default opacity-70']"
            >
              <template v-if="card.projectId && projectStore.getProject(card.projectId)">
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: projectStore.getProject(card.projectId).color }"
                ></div>
                <span class="text-sm">{{ projectStore.getProject(card.projectId).emoji }}</span>
                <span class="text-sm text-forge-100 flex-1">{{ projectStore.getProject(card.projectId).name }}</span>
              </template>
              <template v-else>
                <span class="text-sm text-forge-500 flex-1">No project</span>
              </template>
              <svg class="w-4 h-4 text-forge-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown -->
            <div
              v-if="showProjectDropdown"
              class="absolute top-full left-0 right-0 mt-1 z-20 bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 overflow-hidden animate-scale-in"
            >
              <!-- No project option -->
              <button
                @click="store.updateCard(boardId, currentColumnId, card.id, { projectId: null }); showProjectDropdown = false"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="!card.projectId ? 'bg-forge-700/30' : ''"
              >
                <span class="text-sm text-forge-400">No project</span>
              </button>

              <div class="h-px bg-forge-700/50"></div>

              <button
                v-for="project in projectStore.projects"
                :key="project.id"
                @click="store.updateCard(boardId, currentColumnId, card.id, { projectId: project.id }); showProjectDropdown = false"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="card.projectId === project.id ? 'bg-forge-700/30' : ''"
              >
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: project.color }"
                ></div>
                <span class="text-sm">{{ project.emoji }}</span>
                <span class="text-sm text-forge-100">{{ project.name }}</span>
                <svg v-if="card.projectId === project.id" class="w-4 h-4 text-ember ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Assignee -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Assignee</label>
          <div class="relative">
            <button
              @click="canEdit && (showAssigneeDropdown = !showAssigneeDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-left transition-all"
              :class="[showAssigneeDropdown ? 'border-ember/50 ring-1 ring-ember/25' : '', canEdit ? 'cursor-pointer hover:border-forge-600/50' : 'cursor-default opacity-70']"
            >
              <template v-if="card.assignee">
                <div v-if="card.assignee.photo" class="w-5 h-5 rounded-full overflow-hidden bg-forge-700 shrink-0">
                  <img :src="card.assignee.photo" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-5 h-5 rounded-full bg-forge-700 flex items-center justify-center shrink-0">
                  <span class="text-[9px] font-bold text-forge-300">{{ (card.assignee.name || '?').charAt(0).toUpperCase() }}</span>
                </div>
                <span class="text-sm text-forge-100 flex-1">{{ card.assignee.name }}</span>
              </template>
              <template v-else>
                <span class="text-sm text-forge-500 flex-1">Unassigned</span>
              </template>
              <svg class="w-4 h-4 text-forge-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown -->
            <div
              v-if="showAssigneeDropdown"
              class="absolute top-full left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 animate-scale-in"
            >
              <!-- Unassigned option -->
              <button
                @click="assign(null)"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="!card.assignee ? 'bg-forge-700/30' : ''"
              >
                <span class="text-sm text-forge-400">Unassigned</span>
              </button>

              <div class="h-px bg-forge-700/50"></div>

              <button
                v-for="member in boardMembers"
                :key="member.uid"
                @click="assign(member)"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="card.assignee?.uid === member.uid ? 'bg-forge-700/30' : ''"
              >
                <div v-if="member.photo" class="w-6 h-6 rounded-full overflow-hidden bg-forge-700 shrink-0">
                  <img :src="member.photo" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-6 h-6 rounded-full bg-forge-700 flex items-center justify-center shrink-0">
                  <span class="text-[10px] font-bold text-forge-300">{{ (member.name || '?').charAt(0).toUpperCase() }}</span>
                </div>
                <span class="text-sm text-forge-100">{{ member.name }}</span>
                <svg v-if="card.assignee?.uid === member.uid" class="w-4 h-4 text-ember ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Images -->
        <div class="mb-6">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Images</label>

          <!-- Existing images grid -->
          <div v-if="card.images?.length" class="grid grid-cols-3 gap-2 mb-3">
            <div
              v-for="(image, idx) in card.images"
              :key="idx"
              class="group/img relative aspect-square rounded-lg overflow-hidden bg-forge-800 border border-forge-700/30"
            >
              <img
                :src="image.url"
                :alt="image.name"
                class="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-105"
                @click="lightboxUrl = image.url"
              />
              <button
                v-if="canEdit"
                @click="removeImage(image)"
                class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer hover:bg-red-500/80"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Upload area -->
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="handleFileSelect"
          />
          <button
            v-if="canEdit"
            @click="fileInput?.click()"
            :disabled="uploading"
            class="w-full py-3 border-2 border-dashed border-forge-700/40 hover:border-forge-600/60 rounded-lg text-forge-500 hover:text-forge-300 text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <template v-if="uploading">
              <div class="w-4 h-4 border-2 border-forge-600 border-t-ember rounded-full animate-spin"></div>
              Uploading...
            </template>
            <template v-else>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add images
            </template>
          </button>
        </div>

        <!-- Metadata -->
        <div class="mb-6 rounded-lg bg-forge-800/50 border border-forge-700/30 divide-y divide-forge-700/30">
          <!-- Created by -->
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-xs text-forge-500 uppercase tracking-wider">Created by</span>
            <div class="flex items-center gap-2">
              <div
                v-if="card.createdBy?.photo"
                class="w-5 h-5 rounded-full overflow-hidden bg-forge-700"
              >
                <img :src="card.createdBy.photo" class="w-full h-full object-cover" />
              </div>
              <div
                v-else-if="card.createdBy?.name"
                class="w-5 h-5 rounded-full bg-forge-700 flex items-center justify-center"
              >
                <span class="text-[9px] font-bold text-forge-300">{{ card.createdBy.name.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="text-xs text-forge-300">{{ card.createdBy?.name || '—' }}</span>
            </div>
          </div>

          <!-- Created at -->
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-xs text-forge-500 uppercase tracking-wider">Created</span>
            <span class="text-xs text-forge-300">{{ formatDate(card.createdAt) }}</span>
          </div>

          <!-- Updated at -->
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-xs text-forge-500 uppercase tracking-wider">Last updated</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-forge-300">{{ formatDate(card.updatedAt) }}</span>
              <template v-if="card.updatedBy && card.updatedBy.uid !== card.createdBy?.uid">
                <span class="text-xs text-forge-500">by</span>
                <div
                  v-if="card.updatedBy.photo"
                  class="w-4 h-4 rounded-full overflow-hidden bg-forge-700"
                >
                  <img :src="card.updatedBy.photo" class="w-full h-full object-cover" />
                </div>
                <span class="text-xs text-forge-400">{{ card.updatedBy.name }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between">
          <button
            v-if="canEdit"
            @click="deleteCard"
            class="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
          >
            Delete Card
          </button>
          <span v-else></span>
          <div class="flex gap-3">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer"
            >
              {{ canEdit ? 'Cancel' : 'Close' }}
            </button>
            <button
              v-if="canEdit"
              @click="save"
              class="px-5 py-2 bg-ember hover:bg-ember-glow text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div
      v-if="lightboxUrl"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in cursor-pointer"
      @click="lightboxUrl = null"
    >
      <img
        :src="lightboxUrl"
        class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-scale-in"
        @click.stop
      />
      <button
        @click="lightboxUrl = null"
        class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>
