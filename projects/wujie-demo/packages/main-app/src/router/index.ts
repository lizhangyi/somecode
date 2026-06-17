import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue'),
      meta: { title: '首页' }
    },
    {
      path: '/sub-vue',
      name: 'SubVue',
      component: () => import('../views/SubVue.vue'),
      meta: { title: 'Vue 子应用 (待办事项)' }
    },
    {
      path: '/sub-react',
      name: 'SubReact',
      component: () => import('../views/SubReact.vue'),
      meta: { title: 'React 子应用 (数据仪表盘)' }
    },
    {
      path: '/communication',
      name: 'Communication',
      component: () => import('../views/Communication.vue'),
      meta: { title: '通信演示' }
    },
    {
      path: '/isolation',
      name: 'Isolation',
      component: () => import('../views/Isolation.vue'),
      meta: { title: '隔离演示' }
    }
  ]
})

export default router
