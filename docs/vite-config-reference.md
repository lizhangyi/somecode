# Vite 配置参考模板

本项目包含多个技术栈，各项目的 Vite 配置不同。以下是对照表和可复用模板。

## 插件对照表

| 技术栈 | Vite 插件 | 包名 |
|---------|-----------|------|
| Vue 3 | `@vitejs/plugin-vue` | `npm install -D @vitejs/plugin-vue` |
| React | `@vitejs/plugin-react` | `npm install -D @vitejs/plugin-react` |
| Tailwind CSS 4 | `@tailwindcss/vite` | `npm install -D tailwindcss @tailwindcss/vite` |

## 模板

### Vue 3 项目

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,   // 按需要修改
    host: true,
  },
})
```

### React 项目

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,   // 按需要修改
    host: true,
    cors: true,
  },
})
```

### Tailwind CSS 4 项目

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

### 多框架或复杂项目

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: true,
  },
})
```

## tsconfig 复用

根目录提供了 `tsconfig.base.json`，新项目可直接继承：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",          // React 项目需要
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```
