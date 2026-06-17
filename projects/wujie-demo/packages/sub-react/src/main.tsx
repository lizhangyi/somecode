import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// ========== 无界生命周期适配 ==========
if ((window as any).__POWERED_BY_WUJIE__) {
  let root: ReturnType<typeof ReactDOM.createRoot>

  ;(window as any).__WUJIE_MOUNT = () => {
    console.log('%c[sub-react] __WUJIE_MOUNT 被调用', 'color: #61dafb; font-weight: bold;')
    const container = document.getElementById('root')!
    root = ReactDOM.createRoot(container)
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    )
  }

  ;(window as any).__WUJIE_UNMOUNT = () => {
    console.log('%c[sub-react] __WUJIE_UNMOUNT 被调用', 'color: #61dafb; font-weight: bold;')
    root?.unmount()
  }
} else {
  // 独立运行
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}
