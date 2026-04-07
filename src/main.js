import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Board from './views/Board.vue'
import Login from './views/Login.vue'
import { useAuthStore } from './stores/auth.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login, meta: { guest: true } },
    { path: '/', name: 'dashboard', component: Dashboard, meta: { auth: true } },
    { path: '/board/:id', name: 'board', component: Board, meta: { auth: true } },
  ],
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

const authStore = useAuthStore()

// Register guard BEFORE init so it catches the first navigation
router.beforeEach(async (to) => {
  // Wait for auth to resolve on first load
  if (authStore.loading) {
    await authStore.init()
  }

  if (to.meta.auth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.meta.guest && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

// Init auth then mount
authStore.init().then(() => {
  app.mount('#app')
})
