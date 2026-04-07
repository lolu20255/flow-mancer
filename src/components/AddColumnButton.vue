<script setup>
import { ref } from 'vue'
import { useBoardStore, COLUMN_COLORS } from '../stores/board.js'

const props = defineProps({
  boardId: String,
})

const store = useBoardStore()

const isAdding = ref(false)
const columnName = ref('')
const selectedColor = ref('#3b82f6')
const nameInput = ref(null)

function open() {
  isAdding.value = true
  columnName.value = ''
  selectedColor.value = COLUMN_COLORS[Math.floor(Math.random() * COLUMN_COLORS.length)]
  setTimeout(() => nameInput.value?.focus(), 30)
}

function addColumn() {
  if (!columnName.value.trim()) return
  store.addColumn(props.boardId, columnName.value.trim(), selectedColor.value)
  columnName.value = ''
  nameInput.value?.focus()
}

function cancel() {
  isAdding.value = false
  columnName.value = ''
}
</script>

<template>
  <div class="shrink-0 w-72">
    <!-- Expanded form -->
    <div v-if="isAdding" class="bg-forge-900/80 border border-forge-800/60 rounded-xl p-3.5 animate-scale-in">
      <input
        ref="nameInput"
        v-model="columnName"
        @keydown.enter="addColumn"
        @keydown.escape="cancel"
        type="text"
        placeholder="Column name..."
        class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-3 py-2 text-sm text-forge-100 placeholder-forge-500 focus:outline-none focus:border-ember/40 mb-3"
      />

      <!-- Color selection -->
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="color in COLUMN_COLORS"
          :key="color"
          @click="selectedColor = color"
          class="w-5 h-5 rounded-full cursor-pointer border-2 transition-all duration-150 hover:scale-110"
          :style="{ backgroundColor: color }"
          :class="color === selectedColor ? 'border-white scale-110' : 'border-transparent'"
        ></button>
      </div>

      <div class="flex gap-2">
        <button
          @click="addColumn"
          :disabled="!columnName.trim()"
          class="flex-1 py-1.5 bg-ember hover:bg-ember-glow disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          Add
        </button>
        <button
          @click="cancel"
          class="px-3 py-1.5 text-sm text-forge-400 hover:text-forge-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Collapsed button -->
    <button
      v-else
      @click="open"
      class="w-full py-3 border-2 border-dashed border-forge-700/40 hover:border-forge-600/60 rounded-xl text-forge-500 hover:text-forge-300 text-sm font-medium transition-all duration-200 hover:bg-forge-900/40 cursor-pointer flex items-center justify-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Add Column
    </button>
  </div>
</template>
