<script setup>
import { useThemeStore } from '../stores/theme.js'

const theme = useThemeStore()
</script>

<template>
  <button
    @click="theme.toggle()"
    class="relative w-14 h-7 rounded-full cursor-pointer border-0 p-0 transition-colors duration-300"
    :class="theme.mode === 'dark' ? 'bg-forge-700' : 'bg-forge-800'"
    :title="theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <!-- Track icons -->
    <span class="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
      <!-- Sun -->
      <svg
        class="w-3.5 h-3.5 transition-opacity duration-300"
        :class="theme.mode === 'light' ? 'opacity-0' : 'opacity-40'"
        fill="currentColor" viewBox="0 0 20 20"
      >
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
      </svg>
      <!-- Moon -->
      <svg
        class="w-3.5 h-3.5 transition-opacity duration-300"
        :class="theme.mode === 'dark' ? 'opacity-0' : 'opacity-40'"
        fill="currentColor" viewBox="0 0 20 20"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
      </svg>
    </span>

    <!-- Knob -->
    <span
      class="absolute top-0.5 w-6 h-6 rounded-full shadow-md transition-all duration-300 flex items-center justify-center"
      :class="theme.mode === 'dark'
        ? 'left-0.5 bg-forge-300'
        : 'left-[calc(100%-1.625rem)] bg-white shadow-lg'"
    >
      <!-- Knob icon -->
      <svg v-if="theme.mode === 'dark'" class="w-3.5 h-3.5 text-forge-800" fill="currentColor" viewBox="0 0 20 20">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
      </svg>
      <svg v-else class="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
      </svg>
    </span>
  </button>
</template>
