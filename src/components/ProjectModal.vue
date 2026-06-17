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
      <div class="surface shadow-soft-lg relative rounded-2xl p-6 w-full max-w-md animate-scale-in">
        <h2 class="font-display text-xl text-forge-50 mb-5">
          {{ project ? 'Edit Project' : 'New Project' }}
        </h2>

        <!-- Emoji -->
        <div class="mb-4">
          <label class="section-label block mb-2">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="emoji in emojis"
              :key="emoji"
              @click="selectedEmoji = emoji"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-150 cursor-pointer"
              :class="selectedEmoji === emoji ? 'bg-ember/20 ring-2 ring-ember scale-110' : 'bg-forge-800 hover:bg-forge-700'"
            >
              {{ emoji }}
            </button>
          </div>
        </div>

        <!-- Name -->
        <div class="mb-4">
          <label class="section-label block mb-2">Project Name</label>
          <input
            ref="nameInput"
            v-model="name"
            @keydown.enter="save"
            type="text"
            placeholder="e.g. Mobile App"
            class="input-field"
          />
        </div>

        <!-- Color -->
        <div class="mb-6">
          <label class="section-label block mb-2">Color</label>
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
              :class="color === selectedColor ? 'border-forge-50 scale-110' : 'border-transparent'"
            ></button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="emit('close')"
            class="btn-secondary focus-ring"
          >
            Cancel
          </button>
          <button
            @click="save"
            :disabled="!name.trim()"
            class="btn-primary focus-ring"
          >
            {{ project ? 'Save' : 'Create Project' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
