<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../stores/board.js'
import { useProjectStore } from '../stores/projects.js'
import { useAuthStore } from '../stores/auth.js'
import ThemeToggle from '../components/ThemeToggle.vue'
import ProjectModal from '../components/ProjectModal.vue'

const store = useBoardStore()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const router = useRouter()

const showUserMenu = ref(false)

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}

const showCreateModal = ref(false)
const newBoardName = ref('')
const selectedEmoji = ref('📋')

const emojis = ['📋', '🚀', '💡', '🎯', '🔥', '⚡', '🎨', '📦', '🛠️', '🌊', '🌿', '💎', '🏗️', '📊', '🎵']

async function createBoard() {
  if (!newBoardName.value.trim()) return
  const board = await store.createBoard(newBoardName.value.trim(), selectedEmoji.value)
  newBoardName.value = ''
  selectedEmoji.value = '📋'
  showCreateModal.value = false
  router.push({ name: 'board', params: { id: board.id } })
}

function openBoard(id) {
  router.push({ name: 'board', params: { id } })
}

function handleDeleteBoard(id) {
  store.deleteBoard(id)
}

const nameInput = ref(null)

function openModal() {
  showCreateModal.value = true
  setTimeout(() => nameInput.value?.focus(), 50)
}

// Projects
const showProjectModal = ref(false)
const editingProject = ref(null)

function openNewProject() {
  editingProject.value = null
  showProjectModal.value = true
}

function openEditProject(project) {
  editingProject.value = project
  showProjectModal.value = true
}

function closeProjectModal() {
  showProjectModal.value = false
  editingProject.value = null
}
</script>

<template>
  <div class="h-full flex flex-col bg-forge-950">
    <!-- Header -->
    <header class="shrink-0 border-b border-forge-800/60 px-8 py-6">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <svg class="w-9 h-9" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f97316"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#logo-g)"/>
            <rect x="6" y="8" width="5" height="16" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="13.5" y="8" width="5" height="11" rx="1.5" fill="white" opacity="0.9"/>
            <rect x="21" y="8" width="5" height="14" rx="1.5" fill="white" opacity="0.9"/>
          </svg>
          <h1 class="font-display text-2xl font-medium text-forge-50 tracking-tight">
            Flowmancer
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <button
            @click="openModal"
            class="px-4 py-2 bg-ember hover:bg-ember-glow text-white text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-ember/25 active:scale-95 cursor-pointer"
          >
            + New Board
          </button>

          <!-- User menu -->
          <div class="relative">
            <button
              @click="showUserMenu = !showUserMenu"
              class="w-9 h-9 rounded-full overflow-hidden border-2 border-forge-700/50 hover:border-forge-500 transition-all cursor-pointer flex items-center justify-center bg-forge-800"
            >
              <img
                v-if="authStore.photoURL"
                :src="authStore.photoURL"
                :alt="authStore.displayName"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-sm font-semibold text-forge-300">
                {{ authStore.displayName?.charAt(0)?.toUpperCase() || '?' }}
              </span>
            </button>

            <div
              v-if="showUserMenu"
              class="absolute right-0 top-12 z-30 w-56 bg-forge-800 border border-forge-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-scale-in"
            >
              <div class="px-4 py-3 border-b border-forge-700/40">
                <p class="text-sm font-medium text-forge-100 truncate">{{ authStore.displayName }}</p>
                <p class="text-xs text-forge-400 truncate">{{ authStore.user?.email }}</p>
              </div>
              <button
                @click="handleLogout"
                class="w-full px-4 py-2.5 text-left text-sm text-forge-300 hover:text-red-400 hover:bg-forge-700/50 transition-colors cursor-pointer flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-8 py-10">
      <div class="max-w-6xl mx-auto">

        <!-- Loading -->
        <div v-if="store.loading" class="flex items-center justify-center py-32">
          <div class="w-8 h-8 border-2 border-forge-700 border-t-ember rounded-full animate-spin"></div>
        </div>

        <template v-else>
          <!-- Projects Section -->
          <div class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <p class="text-forge-400 text-sm font-medium uppercase tracking-widest">Projects</p>
              <button
                @click="openNewProject"
                class="text-xs text-forge-400 hover:text-forge-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>
            </div>

            <div v-if="projectStore.projects.length === 0" class="py-6 text-center">
              <p class="text-forge-500 text-sm mb-3">No projects yet. Projects help you group cards across boards.</p>
              <button
                @click="openNewProject"
                class="px-4 py-2 bg-forge-800 hover:bg-forge-700 text-forge-200 text-sm rounded-lg border border-forge-700/50 transition-all cursor-pointer"
              >
                Create a Project
              </button>
            </div>

            <div v-else class="flex flex-wrap gap-2.5">
              <div
                v-for="(project, i) in projectStore.projects"
                :key="project.id"
                class="group flex items-center gap-2.5 bg-forge-900 border border-forge-800/60 rounded-lg px-4 py-2.5 transition-all duration-200 hover:border-forge-600/60 animate-fade-in-up"
                :style="{ animationDelay: `${i * 40}ms` }"
              >
                <!-- Color dot -->
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: project.color }"
                ></div>
                <span class="text-sm">{{ project.emoji }}</span>
                <span class="text-sm font-medium text-forge-100">{{ project.name }}</span>

                <!-- Edit -->
                <button
                  @click="openEditProject(project)"
                  class="opacity-0 group-hover:opacity-100 p-1 rounded text-forge-500 hover:text-forge-200 transition-all cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>

                <!-- Delete -->
                <button
                  @click="projectStore.deleteProject(project.id)"
                  class="opacity-0 group-hover:opacity-100 p-1 rounded text-forge-500 hover:text-red-400 transition-all cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Boards Section -->
          <div>
            <p class="text-forge-400 text-sm font-medium uppercase tracking-widest mb-4">Boards</p>

            <div v-if="store.boards.length === 0" class="flex flex-col items-center justify-center py-24">
              <div class="w-20 h-20 rounded-2xl bg-forge-800/50 flex items-center justify-center mb-6 border border-forge-700/30">
                <svg class="w-10 h-10 text-forge-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <p class="text-forge-300 text-lg mb-2">No boards yet</p>
              <p class="text-forge-500 text-sm mb-6">Create your first board to start organizing</p>
              <button
                @click="openModal"
                class="px-5 py-2.5 bg-forge-800 hover:bg-forge-700 text-forge-100 text-sm font-medium rounded-lg border border-forge-700/50 transition-all duration-200 cursor-pointer"
              >
                Create a Board
              </button>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="(board, i) in store.boards"
                :key="board.id"
                @click="openBoard(board.id)"
                class="group relative bg-forge-900 border border-forge-800/60 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:border-forge-600/60 hover:bg-forge-850 hover:shadow-xl hover:shadow-black/20 animate-fade-in-up"
                :style="{ animationDelay: `${i * 60}ms` }"
              >
                <div class="flex items-start justify-between mb-4">
                  <div class="text-3xl">{{ board.emoji }}</div>
                  <div class="flex items-center gap-1.5">
                    <span v-if="board.userId !== authStore.uid" class="text-[10px] uppercase tracking-wider text-forge-500 px-1.5 py-0.5 rounded bg-forge-800 border border-forge-700/40">
                      {{ board.roles?.[authStore.uid] || 'shared' }}
                    </span>
                    <button
                      v-if="board.userId === authStore.uid"
                      @click.stop="handleDeleteBoard(board.id)"
                      class="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 text-forge-500 hover:text-red-400 transition-all duration-200 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 class="text-forge-50 font-semibold text-lg mb-1.5 group-hover:text-forge-50 transition-colors">
                  {{ board.name }}
                </h3>
                <div class="flex items-center gap-3 text-forge-500 text-xs">
                  <span>{{ board.columns.length }} column{{ board.columns.length !== 1 ? 's' : '' }}</span>
                  <span class="w-1 h-1 rounded-full bg-forge-600"></span>
                  <span>{{ board.columns.reduce((sum, col) => sum + col.cards.length, 0) }} cards</span>
                </div>
                <!-- Column color dots -->
                <div v-if="board.columns.length" class="flex gap-1.5 mt-4">
                  <div
                    v-for="col in board.columns.slice(0, 6)"
                    :key="col.id"
                    class="w-2.5 h-2.5 rounded-full opacity-70"
                    :style="{ backgroundColor: col.color }"
                  ></div>
                  <span v-if="board.columns.length > 6" class="text-forge-500 text-xs ml-1">+{{ board.columns.length - 6 }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </main>

    <!-- Create Board Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="showCreateModal = false"></div>
        <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40 animate-scale-in">
          <h2 class="font-display text-xl text-forge-50 mb-5">New Board</h2>

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
              ref="nameInput"
              v-model="newBoardName"
              @keydown.enter="createBoard"
              type="text"
              placeholder="e.g. Product Roadmap"
              class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-3 text-forge-50 placeholder-forge-500 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
            />
          </div>

          <div class="flex justify-end gap-3">
            <button
              @click="showCreateModal = false"
              class="px-4 py-2 text-sm text-forge-300 hover:text-forge-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              @click="createBoard"
              :disabled="!newBoardName.trim()"
              class="px-5 py-2 bg-ember hover:bg-ember-glow disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer"
            >
              Create Board
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Project Modal -->
    <ProjectModal
      v-if="showProjectModal"
      :project="editingProject"
      @close="closeProjectModal"
    />
  </div>
</template>
