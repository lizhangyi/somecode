import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'demo/vanilla',
  resolve: {
    alias: {
      // 让 demo 像引用 npm 包一样导入库
      'flowchart-canvas/style.css': fileURLToPath(new URL('./src/style.css', import.meta.url)),
      'flowchart-canvas': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: {
      // 允许 dev server 访问项目根目录下的 src/（库源码）
      allow: ['..'],
    },
  },
  build: {
    // 构建产物输出到项目根 dist/ 目录
    outDir: '../../dist',
    emptyOutDir: true,
  },
})
