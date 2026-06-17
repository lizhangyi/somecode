import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'TodoList',
      component: () => import('../views/TodoList.vue')
    },
    {
      path: '/stats',
      name: 'TodoStats',
      component: () => import('../views/TodoStats.vue')
    }
  ]
})

export default router
