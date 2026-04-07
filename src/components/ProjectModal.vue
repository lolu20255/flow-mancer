<script setup>
import { ref } from 'vue'
import { useProjectStore, PROJECT_COLORS } from '../stores/projects.js'

const props = defineProps({
  project: { type: Object, default: null },
})

const emit = defineEmits(['close'])
const store = useProjectStore()

const name = ref(props.project?.name || '')
const selectedColor = ref(props.project?.color || '#3b82f6')
const selectedEmoji = ref(props.project?.emoji || '📁')
const nameInput = ref(null)

const emojis = ['📁', '🏢', '🛒', '🎮', '📱', '🌐', '🔧', '📈', '🎬', '🏠', '💼', '🔬']

setTimeout(() => nameInput.value?.focus(), 50)

async function save() {
  if (!name.value.trim()) return
  if (props.project) {
    await store.updateProject(props.project.id, {
      name: name.value.trim(),
      color: selectedColor.value,
      emoji: selectedEmoji.value,
    })
  } else {
    await store.createProject(name.value.trim(), selectedColor.value, selectedEmoji.value)
  }
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40 animate-scale-in">
        <h2 class="font-display text-xl text-forge-50 mb-5">
          {{ project ? 'Edit Project' : 'New Project' }}
        </h2>

        <!-- Emoji -->
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

        <!-- Name -->
        <div class="mb-4">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Project Name</label>
          <input
            ref="nameInput"
            v-model="name"
            @keydown.enter="save"
            type="text"
            placeholder="e.g. Mobile App"
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-3 text-forge-50 placeholder-forge-500 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
          />
        </div>

        <!-- Color -->
        <div class="mb-6">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Color</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in PROJECT_COLORS"
              :key="color"
              @click="selectedColor = color"
              class="w-8 h-8 rounded-lg cursor-pointer border-2 transition-all duration-150 hover:scale-110"
              :style="{
                backgroundColor: color,
                boxShadow: color === selectedColor ? `0 0 10px ${color}60` : 'none',
              }"
              :class="color === selectedColor ? 'border-white scale-110' : 'border-transparent'"
            ></button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="emit('close')"
            class="px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="save"
            :disabled="!name.trim()"
            class="px-5 py-2 bg-ember hover:bg-ember-glow disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer"
          >
            {{ project ? 'Save' : 'Create Project' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
