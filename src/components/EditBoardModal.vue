<script setup>
import { ref } from 'vue'
import { useBoardStore } from '../stores/board.js'

const props = defineProps({
  board: Object,
})

const emit = defineEmits(['close'])
const store = useBoardStore()

const name = ref(props.board.name)
const selectedEmoji = ref(props.board.emoji)

const emojis = ['📋', '🚀', '💡', '🎯', '🔥', '⚡', '🎨', '📦', '🛠️', '🌊', '🌿', '💎', '🏗️', '📊', '🎵']

function save() {
  if (!name.value.trim()) return
  store.updateBoard(props.board.id, {
    name: name.value.trim(),
    emoji: selectedEmoji.value,
  })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40 animate-scale-in">
        <h2 class="font-display text-xl text-forge-50 mb-5">Edit Board</h2>

        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="emoji in emojis"
              :key="emoji"
              @click="selectedEmoji = emoji"
              class="w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all duration-150 cursor-pointer"
              :class="selectedEmoji === emoji ? 'bg-ember/20 ring-2 ring-ember scale-110' : 'bg-forge-800 hover:bg-forge-700'"
            >
              {{ emoji }}
            </button>
          </div>
        </div>

        <div class="mb-6">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Board Name</label>
          <input
            v-model="name"
            @keydown.enter="save"
            type="text"
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-3 text-forge-50 placeholder-forge-500 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
          />
        </div>

        <div class="flex justify-end gap-3">
          <button @click="emit('close')" class="px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            @click="save"
            :disabled="!name.trim()"
            class="px-5 py-2 bg-ember hover:bg-ember-glow disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
