import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'flowchart-canvas': resolve(__dirname, '../../src/index.ts'),
      'flowchart-canvas/style.css': resolve(__dirname, '../../src/style.css'),
    },
  },
})
