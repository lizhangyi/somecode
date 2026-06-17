import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import WujieVue from 'wujie-vue3'
import { preloadApp, bus } from 'wujie'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// 注册 Element Plus
app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 注册无界微前端
app.use(WujieVue)

// 注册路由
app.use(router)

// ========== 预加载所有子应用 ==========
console.log('[主应用] 开始预加载子应用...')
preloadApp({ name: 'sub-vue', url: 'http://localhost:3001/' })
preloadApp({ name: 'sub-react', url: 'http://localhost:3002/' })
preloadApp({ name: 'sub-vue3', url: 'http://localhost:3003/' })

// ========== 全局事件总线监听 ==========
bus.$on('subMessage', (data: { from: string; message: string }) => {
  console.log(`[主应用] 收到来自 ${data.from} 的消息:`, data.message)
})

bus.$on('navigate', (path: string) => {
  console.log(`[主应用] 收到导航请求: ${path}`)
  router.push(path)
})

// 设置主应用全局变量，用于隔离子应用对比
;(window as any).__MAIN_APP_NAME__ = '无界微前端主应用'
;(window as any).__MAIN_APP_VERSION__ = '1.0.0'
;(window as any).__SHARED_THEME__ = 'light'

app.mount('#app')
