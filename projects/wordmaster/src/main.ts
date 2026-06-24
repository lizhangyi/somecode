import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

console.log('[WordMaster] main.ts loaded')

const app = createApp(App)

app.mount('#app')

console.log('[WordMaster] app mounted, #app =', document.getElementById('app')?.innerHTML?.slice(0, 100))
