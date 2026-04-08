<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useThemeStore } from '../stores/theme.js'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const router = useRouter()

const isRegister = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)

async function handleGoogle() {
  submitting.value = true
  try {
    await authStore.loginWithGoogle()
    router.push({ name: 'dashboard' })
  } catch {
    // error is set in store
  } finally {
    submitting.value = false
  }
}

async function handleSubmit() {
  if (!email.value.trim() || !password.value) return
  submitting.value = true
  try {
    if (isRegister.value) {
      await authStore.registerWithEmail(email.value.trim(), password.value, name.value.trim())
    } else {
      await authStore.loginWithEmail(email.value.trim(), password.value)
    }
    router.push({ name: 'dashboard' })
  } catch {
    // error is set in store
  } finally {
    submitting.value = false
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  authStore.clearError()
}
</script>

<template>
  <div class="h-full flex bg-forge-950">
    <!-- Left panel: branding -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
      <!-- Gradient background -->
      <div class="absolute inset-0 bg-gradient-to-br from-ember/20 via-forge-950 to-amber-500/10"></div>
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(249,115,22,0.15),transparent_60%)]"></div>

      <div class="relative z-10 px-16 max-w-lg">
        <!-- Logo -->
        <div class="flex items-center gap-4 mb-10">
          <svg class="w-14 h-14" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f97316"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#login-logo-g)"/>
            <rect x="6" y="8" width="5" height="16" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="13.5" y="8" width="5" height="11" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="21" y="8" width="5" height="14" rx="1.5" fill="white" opacity="0.9"/>
          </svg>
          <span class="font-display text-3xl font-medium text-forge-50">Flowmancer</span>
        </div>

        <h2 class="font-display text-4xl font-medium text-forge-50 leading-tight mb-4">
          Organize your work,<br/>
          <span class="text-ember">your way.</span>
        </h2>
        <p class="text-forge-400 text-lg leading-relaxed">
          A beautiful kanban board to keep your projects, tasks, and ideas flowing smoothly.
        </p>
      </div>
    </div>

    <!-- Right panel: auth form -->
    <div class="flex-1 flex items-center justify-center px-6">
      <div class="w-full max-w-sm">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center justify-center gap-3 mb-10">
          <svg class="w-10 h-10" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-logo-g2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f97316"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#login-logo-g2)"/>
            <rect x="6" y="8" width="5" height="16" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="13.5" y="8" width="5" height="11" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="21" y="8" width="5" height="14" rx="1.5" fill="white" opacity="0.9"/>
          </svg>
          <span class="font-display text-2xl font-medium text-forge-50">Flowmancer</span>
        </div>

        <h1 class="font-display text-2xl font-medium text-forge-50 mb-1">
          {{ isRegister ? 'Create an account' : 'Welcome back' }}
        </h1>
        <p class="text-forge-400 text-sm mb-8">
          {{ isRegister ? 'Sign up to get started' : 'Sign in to your account' }}
        </p>

        <!-- Google button -->
        <button
          @click="handleGoogle"
          :disabled="submitting"
          class="w-full flex items-center justify-center gap-3 bg-forge-900 border border-forge-700/50 rounded-lg px-4 py-3 text-sm font-medium text-forge-100 hover:bg-forge-850 hover:border-forge-600/50 transition-all duration-200 cursor-pointer disabled:opacity-50 mb-6"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <!-- Divider -->
        <div class="flex items-center gap-4 mb-6">
          <div class="flex-1 h-px bg-forge-800"></div>
          <span class="text-forge-500 text-xs uppercase tracking-wider">or</span>
          <div class="flex-1 h-px bg-forge-800"></div>
        </div>

        <!-- Email form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Name (register only) -->
          <div v-if="isRegister">
            <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-1.5">Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="Your name"
              class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 text-sm focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
            />
          </div>

          <div>
            <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 text-sm focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
            />
          </div>

          <div>
            <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="At least 6 characters"
              required
              class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 text-sm focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
            />
          </div>

          <!-- Error -->
          <div v-if="authStore.error" class="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {{ authStore.error }}
          </div>

          <button
            type="submit"
            :disabled="submitting || !email.trim() || !password"
            class="w-full py-2.5 bg-ember hover:bg-ember-glow disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer"
          >
            <template v-if="submitting">
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
            </template>
            <template v-else>
              {{ isRegister ? 'Create Account' : 'Sign In' }}
            </template>
          </button>
        </form>

        <!-- Toggle mode -->
        <p class="text-center text-forge-400 text-sm mt-6">
          {{ isRegister ? 'Already have an account?' : "Don't have an account?" }}
          <button
            @click="toggleMode"
            class="text-ember hover:text-ember-glow font-medium transition-colors cursor-pointer ml-1"
          >
            {{ isRegister ? 'Sign in' : 'Sign up' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
