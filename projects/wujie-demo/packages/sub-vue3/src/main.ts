import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// ========== 无界生命周期适配 ==========
if ((window as any).__POWERED_BY_WUJIE__) {
  let app: ReturnType<typeof createApp>

  ;(window as any).__WUJIE_MOUNT = () => {
    console.log('%c[sub-vue3] __WUJIE_MOUNT 被调用', 'color: #f5222d; font-weight: bold;')
    app = createApp(App)
    app.mount('#app')
  }

  ;(window as any).__WUJIE_UNMOUNT = () => {
    console.log('%c[sub-vue3] __WUJIE_UNMOUNT 被调用', 'color: #f5222d; font-weight: bold;')
    app.unmount()
  }
} else {
  createApp(App).mount('#app')
}
