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

// Wait for auth to resolve before mounting
const authStore = useAuthStore()
authStore.init().then(() => {
  // Route guard
  router.beforeEach((to) => {
    if (to.meta.auth && !authStore.isAuthenticated) {
      return { name: 'login' }
    }
    if (to.meta.guest && authStore.isAuthenticated) {
      return { name: 'dashboard' }
    }
  })

  app.mount('#app')
})
