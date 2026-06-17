import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import './style.css'

// ========== 无界生命周期适配 ==========
if ((window as any).__POWERED_BY_WUJIE__) {
  // 在无界微前端环境中
  let app: ReturnType<typeof createApp>

  ;(window as any).__WUJIE_MOUNT = () => {
    console.log('%c[sub-vue] __WUJIE_MOUNT 被调用', 'color: #42b883; font-weight: bold;')
    app = createApp(App)
    app.use(router)
    app.mount('#app')
  }

  ;(window as any).__WUJIE_UNMOUNT = () => {
    console.log('%c[sub-vue] __WUJIE_UNMOUNT 被调用', 'color: #42b883; font-weight: bold;')
    app.unmount()
  }
} else {
  // 独立运行
  createApp(App).use(router).mount('#app')
}
