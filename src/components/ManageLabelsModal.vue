<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBoardStore, COLUMN_COLORS } from '../stores/board.js'

const props = defineProps({
  board: Object,
})
const emit = defineEmits(['close'])
const store = useBoardStore()

const labels = computed(() => {
  const set = new Set()
  for (const col of props.board.columns || []) {
    for (const card of col.cards || []) {
      for (const l of card.labels || []) set.add(l)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const editing = ref(null)
const editValue = ref('')
const editInput = ref(null)
const openColorFor = ref(null)

function colorOf(label) {
  return props.board.labelColors?.[label] || '#f97316'
}

function startEdit(label) {
  editing.value = label
  editValue.value = label
  nextTick(() => editInput.value?.focus())
}

async function commitEdit(label) {
  const next = editValue.value.trim()
  if (next && next !== label) await store.renameLabel(props.board.id, label, next)
  editing.value = null
}

function cancelEdit() {
  editing.value = null
}

async function remove(label) {
  if (!confirm(`Delete label "${label}" from all cards on this board?`)) return
  await store.deleteLabel(props.board.id, label)
}

async function pickColor(label, color) {
  await store.setLabelColor(props.board.id, label, color)
  openColorFor.value = null
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/40 animate-scale-in">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display text-lg font-medium text-forge-50">Manage Labels</h2>
          <button @click="emit('close')" class="p-1.5 rounded-md text-forge-400 hover:text-forge-100 hover:bg-forge-800 cursor-pointer transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="!labels.length" class="text-center py-8 text-forge-500 text-sm">
          No labels yet. Add labels to cards to manage them here.
        </div>

        <div v-else class="flex flex-col gap-1.5">
          <div
            v-for="label in labels"
            :key="label"
            class="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-forge-800/60 transition-colors"
          >
            <!-- Color dot + picker -->
            <div class="relative shrink-0">
              <button
                @click="openColorFor = openColorFor === label ? null : label"
                class="w-5 h-5 rounded-full cursor-pointer border border-forge-700/60 hover:scale-110 transition-transform"
                :style="{ backgroundColor: colorOf(label) }"
                title="Change color"
              ></button>
              <div
                v-if="openColorFor === label"
                class="absolute top-full left-0 mt-1 z-30 p-2 w-44 bg-forge-800 border border-forge-700/60 rounded-lg shadow-xl flex flex-wrap gap-1.5 animate-scale-in"
              >
                <button
                  v-for="c in COLUMN_COLORS"
                  :key="c"
                  @click="pickColor(label, c)"
                  class="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform border border-black/20 shrink-0"
                  :style="{ backgroundColor: c }"
                ></button>
              </div>
            </div>

            <!-- Name / edit input -->
            <input
              v-if="editing === label"
              ref="editInput"
              v-model="editValue"
              @keydown.enter.prevent="commitEdit(label)"
              @keydown.escape="cancelEdit"
              @blur="commitEdit(label)"
              type="text"
              class="flex-1 bg-forge-800 border border-ember/40 rounded-md px-2 py-1 text-sm text-forge-50 focus:outline-none"
            />
            <span
              v-else
              @click="startEdit(label)"
              class="flex-1 text-sm text-forge-100 cursor-text px-2 py-1 rounded hover:bg-forge-800/40 transition-colors truncate"
            >
              {{ label }}
            </span>

            <!-- Actions -->
            <button
              @click="startEdit(label)"
              class="p-1 rounded text-forge-500 hover:text-forge-200 hover:bg-forge-700/50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              title="Rename"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              @click="remove(label)"
              class="p-1 rounded text-forge-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              title="Delete"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
