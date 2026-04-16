<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBoardStore } from '../stores/board.js'
import { useUsersStore } from '../stores/users.js'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  board: Object,
})
const emit = defineEmits(['close'])

const store = useBoardStore()
const usersStore = useUsersStore()
const authStore = useAuthStore()

const query = ref('')
const showSuggestions = ref(false)

function hideSuggestionsSoon() {
  setTimeout(() => { showSuggestions.value = false }, 150)
}

onMounted(() => {
  usersStore.ensureLoaded()
})

const members = computed(() => {
  return (props.board.members || []).map(uid => {
    const u = usersStore.getUser(uid)
    const role = props.board.roles?.[uid] || (props.board.userId === uid ? 'owner' : 'editor')
    return {
      uid,
      role,
      name: u?.name || 'Unknown',
      email: u?.email || '',
      photo: u?.photo || null,
    }
  })
})

const suggestions = computed(() => {
  const existing = new Set(props.board.members || [])
  return usersStore
    .searchUsers(query.value)
    .filter(u => u.uid !== authStore.uid && !existing.has(u.uid))
    .slice(0, 6)
})

const isOwner = computed(() => store.myRole(props.board.id) === 'owner')

async function invite(user) {
  await store.inviteMember(props.board.id, user.uid, 'editor')
  query.value = ''
  showSuggestions.value = false
}

async function changeRole(uid, role) {
  await store.updateMemberRole(props.board.id, uid, role)
}

async function remove(uid) {
  if (!confirm('Remove this member from the board?')) return
  await store.removeMember(props.board.id, uid)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>
      <div class="relative bg-forge-900 border border-forge-700/50 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/40 animate-scale-in">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display text-lg font-medium text-forge-50">Share "{{ board.name }}"</h2>
          <button @click="emit('close')" class="p-1.5 rounded-md text-forge-400 hover:text-forge-100 hover:bg-forge-800 cursor-pointer transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Invite input (owner only) -->
        <div v-if="isOwner" class="mb-5 relative">
          <label class="block text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Invite by name or email</label>
          <input
            v-model="query"
            @focus="showSuggestions = true"
            @blur="hideSuggestionsSoon"
            type="text"
            placeholder="Search users..."
            class="w-full bg-forge-800 border border-forge-700/50 rounded-lg px-4 py-2.5 text-forge-50 placeholder-forge-500 focus:outline-none focus:border-ember/50 focus:ring-1 focus:ring-ember/25 transition-all"
          />
          <div
            v-if="showSuggestions && suggestions.length"
            class="absolute top-full left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl shadow-black/30 animate-scale-in"
          >
            <button
              v-for="user in suggestions"
              :key="user.uid"
              type="button"
              @mousedown.prevent="invite(user)"
              class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-forge-700/50 transition-colors cursor-pointer"
            >
              <div v-if="user.photo" class="w-7 h-7 rounded-full overflow-hidden bg-forge-700 shrink-0">
                <img :src="user.photo" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-7 h-7 rounded-full bg-forge-700 flex items-center justify-center shrink-0">
                <span class="text-xs font-bold text-forge-300">{{ (user.name || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-forge-100 truncate">{{ user.name }}</div>
                <div class="text-xs text-forge-500 truncate">{{ user.email }}</div>
              </div>
            </button>
          </div>
          <div
            v-else-if="showSuggestions && query.trim() && !suggestions.length"
            class="absolute top-full left-0 right-0 mt-1 z-20 px-4 py-3 bg-forge-800 border border-forge-700/50 rounded-lg shadow-xl text-sm text-forge-500"
          >
            No matching users.
          </div>
        </div>

        <!-- Member list -->
        <div>
          <div class="text-forge-400 text-xs font-medium uppercase tracking-wider mb-2">Members ({{ members.length }})</div>
          <div class="flex flex-col gap-1">
            <div
              v-for="m in members"
              :key="m.uid"
              class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-forge-800/50 transition-colors"
            >
              <div v-if="m.photo" class="w-8 h-8 rounded-full overflow-hidden bg-forge-700 shrink-0">
                <img :src="m.photo" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-8 h-8 rounded-full bg-forge-700 flex items-center justify-center shrink-0">
                <span class="text-xs font-bold text-forge-300">{{ (m.name || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-forge-100 truncate">
                  {{ m.name }}
                  <span v-if="m.uid === authStore.uid" class="text-forge-500 text-xs ml-1">(you)</span>
                </div>
                <div class="text-xs text-forge-500 truncate">{{ m.email }}</div>
              </div>

              <span v-if="m.role === 'owner'" class="text-xs text-ember font-medium uppercase tracking-wider">Owner</span>
              <template v-else>
                <select
                  v-if="isOwner"
                  :value="m.role"
                  @change="changeRole(m.uid, $event.target.value)"
                  class="bg-forge-800 border border-forge-700/50 rounded-md px-2 py-1 text-xs text-forge-100 focus:outline-none focus:border-ember/40 cursor-pointer"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <span v-else class="text-xs text-forge-400 uppercase tracking-wider">{{ m.role }}</span>
                <button
                  v-if="isOwner"
                  @click="remove(m.uid)"
                  class="p-1.5 rounded-md text-forge-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  title="Remove"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </template>
            </div>
          </div>
        </div>

        <div v-if="!isOwner" class="mt-4 text-xs text-forge-500">
          Only the board owner can invite or remove members.
        </div>
      </div>
    </div>
  </Teleport>
</template>
