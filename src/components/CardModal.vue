<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'

const props = defineProps({
  card: Object,
  boardId: String,
  columnId: String,
  columnColor: String,
  labelColors: { type: Object, default: () => ({}) },
})

function labelColor(label) {
  return props.labelColors[label] || props.columnColor
}

const emit = defineEmits(['close'])
const store = useBoardStore()
const projectStore = useProjectStore()

const title = ref(props.card.title)
const description = ref(props.card.description || '')
const newLabel = ref('')
const titleInput = ref(null)
const uploading = ref(false)
const fileInput = ref(null)
const showProjectDropdown = ref(false)
const showLabelSuggestions = ref(false)

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
})

function save() {
  if (!title.value.trim()) return
  store.updateCard(props.boardId, props.columnId, props.card.id, {
    title: title.value.trim(),
    description: description.value.trim(),
  })
  emit('close')
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
  store.updateCard(props.boardId, props.columnId, props.card.id, { labels })
  newLabel.value = ''
  showLabelSuggestions.value = false
}

function removeLabel(label) {
  const labels = (props.card.labels || []).filter(l => l !== label)
  store.updateCard(props.boardId, props.columnId, props.card.id, { labels })
}

function deleteCard() {
  store.deleteCard(props.boardId, props.columnId, props.card.id)
  emit('close')
}

// Image upload
async function handleFileSelect(e) {
  const files = e.target.files
  if (!files?.length) return
  uploading.value = true
  for (const file of files) {
    await store.uploadCardImage(props.boardId, props.columnId, props.card.id, file)
  }
  uploading.value = false
  if (fileInput.value) fileInput.value.value = ''
}

async function removeImage(image) {
  await store.deleteCardImage(props.boardId, props.columnId, props.card.id, image)
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
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 animate-scale-in">
        <!-- Color accent bar -->
        <div class="absolute top-0 left-6 right-6 h-0.5 rounded-b" :style="{ backgroundColor: columnColor }"></div>

        <!-- Title -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Title</label>
          <input
            ref="titleInput"
            v-model="title"
            @keydown.enter.prevent="save"
            type="text"
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
          />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Description</label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Add details..."
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 resize-none focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
          ></textarea>
        </div>

        <!-- Labels -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Labels</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="label in card.labels"
              :key="label"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
              :style="{ backgroundColor: labelColor(label) + '20', color: labelColor(label) }"
              @click="removeLabel(label)"
            >
              {{ label }}
              <svg class="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </div>
          <div class="flex gap-2 relative">
            <div class="flex-1 relative">
              <input
                v-model="newLabel"
                @keydown.enter.prevent="addLabel()"
                @focus="showLabelSuggestions = true"
                @blur="setTimeout(() => showLabelSuggestions = false, 150)"
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
              @click="showProjectDropdown = !showProjectDropdown"
              class="w-full flex items-center gap-2.5 bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-left transition-all cursor-pointer hover:border-forge-600/50"
              :class="showProjectDropdown ? 'border-ember/50 ring-1 ring-ember/25' : ''"
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
                @click="store.updateCard(boardId, columnId, card.id, { projectId: null }); showProjectDropdown = false"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
                :class="!card.projectId ? 'bg-forge-700/30' : ''"
              >
                <span class="text-sm text-forge-400">No project</span>
              </button>

              <div class="h-px bg-forge-700/50"></div>

              <button
                v-for="project in projectStore.projects"
                :key="project.id"
                @click="store.updateCard(boardId, columnId, card.id, { projectId: project.id }); showProjectDropdown = false"
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
            @click="deleteCard"
            class="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
          >
            Delete Card
          </button>
          <div class="flex gap-3">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
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
