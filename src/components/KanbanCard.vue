<script setup>
import { computed } from 'vue'
import { useProjectStore } from '../stores/projects.js'

const props = defineProps({
  card: Object,
  columnColor: String,
})

const projectStore = useProjectStore()
const project = computed(() =>
  props.card.projectId ? projectStore.getProject(props.card.projectId) : null
)
</script>

<template>
  <div
    class="group bg-forge-800/70 hover:bg-forge-800 border border-forge-700/30 hover:border-forge-600/40 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/15 active:scale-[0.98] overflow-hidden"
  >
    <!-- Image preview (first image as cover) -->
    <div v-if="card.images?.length" class="relative">
      <img
        :src="card.images[0].url"
        :alt="card.images[0].name"
        class="w-full h-28 object-cover"
      />
      <div
        v-if="card.images.length > 1"
        class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm"
      >
        +{{ card.images.length - 1 }}
      </div>
    </div>

    <div class="px-3 py-2.5">
      <!-- Project badge -->
      <div v-if="project" class="flex items-center gap-1.5 mb-2">
        <div
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="{ backgroundColor: project.color }"
        ></div>
        <span class="text-[10px] font-medium text-forge-400 uppercase tracking-wider truncate">
          {{ project.name }}
        </span>
      </div>

      <!-- Labels -->
      <div v-if="card.labels?.length" class="flex flex-wrap gap-1.5 mb-2">
        <span
          v-for="label in card.labels"
          :key="label"
          class="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
          :style="{ backgroundColor: columnColor + '20', color: columnColor }"
        >
          {{ label }}
        </span>
      </div>

      <p class="text-sm text-forge-100 leading-relaxed">{{ card.title }}</p>

      <p v-if="card.description" class="text-xs text-forge-500 mt-1.5 line-clamp-2">
        {{ card.description }}
      </p>
    </div>
  </div>
</template>
