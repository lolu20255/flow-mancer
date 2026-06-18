<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import { useUsersStore } from '../stores/users.js'

marked.setOptions({ gfm: true, breaks: true })

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

const MAX_DESCRIPTION_HEIGHT = 400

const title = ref(props.card.title)
const description = ref(props.card.description || '')
const newLabel = ref('')
const titleInput = ref(null)
const descInput = ref(null)

// Jira-style description: render markdown by default, click to edit in place.
const editingDescription = ref(false)
const renderedDescription = computed(() =>
  DOMPurify.sanitize(marked.parse(description.value || ''))
)

function startEditDescription() {
  if (!props.canEdit) return
  editingDescription.value = true
  nextTick(() => {
    descInput.value?.focus()
    autoResizeDescription()
  })
}

// Leaving the editor persists the change and returns to the rendered view.
function stopEditDescription() {
  editingDescription.value = false
  const next = description.value.trim()
  if (next === (props.card.description || '')) return
  store.updateCard(props.boardId, currentColumnId.value, props.card.id, { description: next })
}

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
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-lg lg:max-w-3xl max-h-[90vh] overflow-y-auto shadow-soft-lg animate-scale-in">
        <!-- Color accent bar -->
        <div class="absolute top-0 left-6 right-6 h-0.5 rounded-b" :style="{ backgroundColor: activeColumnColor }"></div>

        <!-- Status / Column -->
        <div class="mb-4">
          <label class="section-label block mb-2">Status</label>
          <div class="relative">
            <button
              @click="canEdit && (showStatusDropdown = !showStatusDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-xl px-4 py-2.5 text-left transition-all duration-200"
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
              class="absolute top-full left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-xl shadow-soft-lg animate-scale-in"
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
          <label class="section-label block mb-2">Title</label>
          <input
            ref="titleInput"
            v-model="title"
            @keydown.enter.prevent="save"
            type="text"
            :readonly="!canEdit"
            class="input-field read-only:opacity-70"
          />
        </div>

        <!-- Description (Jira-style: rendered markdown, click to edit) -->
        <div class="mb-4">
          <label class="section-label block mb-2">Description</label>

          <textarea
            v-if="editingDescription"
            ref="descInput"
            v-model="description"
            rows="3"
            placeholder="Add details... (Markdown supported)"
            @input="autoResizeDescription"
            @blur="stopEditDescription"
            @keydown.esc="stopEditDescription"
            class="input-field resize-y overflow-y-auto"
          ></textarea>

          <div
            v-else-if="description.trim()"
            class="md-body input-field min-h-[3rem] cursor-text whitespace-normal"
            :class="canEdit ? 'hover:border-forge-600/60' : 'cursor-default opacity-70'"
            @click="startEditDescription"
            v-html="renderedDescription"
          ></div>

          <button
            v-else
            type="button"
            :disabled="!canEdit"
            @click="startEditDescription"
            class="input-field text-left text-forge-500 cursor-text disabled:cursor-default hover:border-forge-600/60"
          >
            Add details... (Markdown supported)
          </button>
        </div>

        <!-- Labels -->
        <div class="mb-4">
          <label class="section-label block mb-2">Labels</label>
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
                class="input-field text-sm py-1.5"
              />
              <div
                v-if="showLabelSuggestions && labelSuggestions.length"
                class="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-xl shadow-soft-lg animate-scale-in"
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
              class="focus-ring rounded-lg px-3 py-1.5 text-xs text-ember hover:text-ember-glow disabled:opacity-40 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        <!-- Project -->
        <div class="mb-4">
          <label class="section-label block mb-2">Project</label>
          <div class="relative">
            <button
              @click="canEdit && (showProjectDropdown = !showProjectDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-xl px-4 py-2.5 text-left transition-all duration-200"
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
              class="absolute top-full left-0 right-0 mt-1 z-20 bg-forge-800 border border-forge-700/50 rounded-xl shadow-soft-lg overflow-hidden animate-scale-in"
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
          <label class="section-label block mb-2">Assignee</label>
          <div class="relative">
            <button
              @click="canEdit && (showAssigneeDropdown = !showAssigneeDropdown)"
              :disabled="!canEdit"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-xl px-4 py-2.5 text-left transition-all duration-200"
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
              class="absolute top-full left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-xl shadow-soft-lg animate-scale-in"
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
          <label class="section-label block mb-2">Images</label>

          <!-- Existing images grid -->
          <div v-if="card.images?.length" class="grid grid-cols-3 gap-2 mb-3">
            <div
              v-for="(image, idx) in card.images"
              :key="idx"
              class="group/img relative aspect-square rounded-xl overflow-hidden bg-forge-800 border border-forge-700/30 shadow-soft"
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
                class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-forge-50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer hover:bg-red-500/80"
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
            class="focus-ring w-full py-3 border-2 border-dashed border-forge-700/40 hover:border-forge-600/60 hover:bg-forge-800/40 rounded-xl text-forge-500 hover:text-forge-300 text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div class="mb-6 rounded-xl bg-forge-800/50 border border-forge-700/30 divide-y divide-forge-700/30 shadow-soft">
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
            class="focus-ring px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
          >
            Delete Card
          </button>
          <span v-else></span>
          <div class="flex gap-3">
            <button
              @click="emit('close')"
              class="focus-ring rounded-lg px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer"
            >
              {{ canEdit ? 'Cancel' : 'Close' }}
            </button>
            <button
              v-if="canEdit"
              @click="save"
              class="btn-primary focus-ring"
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
        class="focus-ring absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-forge-50 flex items-center justify-center transition-colors cursor-pointer"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* Rendered markdown for the card description. v-html content sits outside the
   scoped-style boundary, so each rule is wrapped in :deep(). */
.md-body { line-height: 1.6; padding-top: 0.6rem; padding-bottom: 0.6rem; }
.md-body :deep(> *:first-child) { margin-top: 0; }
.md-body :deep(> *:last-child) { margin-bottom: 0; }
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3) {
  font-weight: 600;
  color: var(--color-forge-50);
  margin: 1.1em 0 0.4em;
  line-height: 1.3;
}
.md-body :deep(h1) { font-size: 1.15rem; }
.md-body :deep(h2) { font-size: 1.05rem; }
.md-body :deep(h3) { font-size: 0.95rem; }
.md-body :deep(p) { margin: 0.5em 0; }
.md-body :deep(strong) { font-weight: 600; color: var(--color-forge-50); }
.md-body :deep(em) { font-style: italic; }
.md-body :deep(a) { color: var(--color-ember); text-decoration: underline; }
.md-body :deep(ul),
.md-body :deep(ol) { margin: 0.5em 0; padding-left: 1.4em; }
.md-body :deep(ul) { list-style: disc; }
.md-body :deep(ol) { list-style: decimal; }
.md-body :deep(li) { margin: 0.2em 0; }
.md-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  padding: 0.12em 0.36em;
  border-radius: 0.35rem;
  background-color: color-mix(in srgb, var(--color-forge-700) 45%, transparent);
  color: var(--color-forge-100);
}
.md-body :deep(pre) {
  margin: 0.6em 0;
  padding: 0.8em 1em;
  border-radius: 0.6rem;
  overflow-x: auto;
  background-color: color-mix(in srgb, var(--color-forge-700) 35%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-forge-700) 50%, transparent);
}
.md-body :deep(pre code) { padding: 0; background: none; }
.md-body :deep(blockquote) {
  margin: 0.6em 0;
  padding-left: 0.9em;
  border-left: 3px solid color-mix(in srgb, var(--color-ember) 50%, transparent);
  color: var(--color-forge-300);
}
.md-body :deep(hr) {
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--color-forge-700) 60%, transparent);
  margin: 1em 0;
}
.md-body :deep(table) { border-collapse: collapse; margin: 0.6em 0; width: 100%; }
.md-body :deep(th),
.md-body :deep(td) {
  border: 1px solid color-mix(in srgb, var(--color-forge-700) 55%, transparent);
  padding: 0.35em 0.6em;
  text-align: left;
}
.md-body :deep(th) { background-color: color-mix(in srgb, var(--color-forge-700) 30%, transparent); }
</style>
