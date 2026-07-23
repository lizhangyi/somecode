# GraphEditor 关系图编辑器组件

基于 Vue 3 + TypeScript + AntV G6 4.x 的关系图编辑器组件。

## 快速开始

```bash
npm run dev
```

访问 `http://localhost:5174` 查看 Playground 演示页面。

## 基本使用

```vue
<template>
  <GraphEditor
    ref="graphRef"
    mode="edit"
    :storage="adapter"
    v-model:selected-node-id="selectedId"
    @node-click="handleNodeClick"
    @ready="handleReady"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GraphEditor from '@/components/GraphEditor/GraphEditor.vue'
import type { StorageAdapter } from '@/components/GraphEditor/types/adapter'
import type { NodeData } from '@/components/GraphEditor/types/graph'

const selectedId = ref<string | null>(null)

// 实现 StorageAdapter
const adapter: StorageAdapter = {
  async load() {
    // 从后端 API 加载全量数据
    const res = await fetch('/api/graph')
    return res.json()
  },
  async save(operations, version) {
    // 增量保存操作到后端
    await fetch('/api/graph/operations', {
      method: 'POST',
      body: JSON.stringify({ operations, version }),
    })
  },
}

function handleNodeClick(data: NodeData) {
  console.log('点击节点:', data)
}

function handleReady(graph: unknown) {
  console.log('图实例就绪')
}
</script>
```

## Props

| Prop | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `mode` | `'edit' \| 'display'` | - | ✅ | 编辑模式 / 展示模式 |
| `storage` | `StorageAdapter` | - | ✅ | 存储适配器 |
| `selectedNodeId` | `string \| null` | `null` | - | 选中节点 ID（支持 v-model） |
| `showMinimap` | `boolean` | `true` | - | 是否显示缩略图 |
| `showZoomControls` | `boolean` | `true` | - | 是否显示缩放控件 |
| `layout` | `object` | force 布局 | - | 自定义布局配置 |
| `defaultData` | `GraphData` | - | - | 默认初始数据 |

## Emits

| 事件 | 参数 | 说明 |
|------|------|------|
| `nodeClick` | `data: NodeData` | 节点点击 |
| `update:selectedNodeId` | `id: string \| null` | v-model 绑定 |
| `dataChange` | `(operations, version?)` | 数据变更 |
| `ready` | `graphInstance` | 图实例就绪 |
| `loading` | `status: boolean` | 加载状态 |

## Expose（父组件调用方法）

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `addNode(data)` | `Partial<NodeData>` | `string` (节点 ID) | 添加节点 |
| `updateNode(id, data)` | `string, Partial<NodeData>` | `void` | 更新节点 |
| `deleteNode(id)` | `string` | `void` | 删除节点 |
| `getAllData()` | - | `GraphData` | 获取所有数据 |
| `fitView(padding?)` | `number \| number[]` | `void` | 居中视图 |
| `undo()` | - | `void` | 撤销 |
| `redo()` | - | `void` | 重做 |
| `clear()` | - | `void` | 清空画布 |
| `refresh()` | - | `void` | 刷新画布 |
| `exportImage(config?)` | `{ backgroundColor?, padding? }` | `Promise<string>` | 导出 PNG |

## StorageAdapter 示例

### localStorage 实现

```ts
import { applyOperations } from '@/components/GraphEditor/utils/patch'
import type { StorageAdapter } from '@/components/GraphEditor/types/adapter'

const STORAGE_KEY = 'my-graph-data'

const adapter: StorageAdapter = {
  async load() {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { nodes: [], edges: [] }
  },
  async save(operations, version) {
    const raw = localStorage.getItem(STORAGE_KEY)
    let data = raw ? JSON.parse(raw) : { nodes: [], edges: [] }

    // 版本冲突检测
    if (version !== undefined && data.version !== version) {
      const err = new Error('数据冲突') as Error & { status: number }
      err.status = 409
      throw err
    }

    data = applyOperations(data, operations)
    data.version = (data.version || 0) + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  },
}
```

### axios 实现

```ts
import axios from 'axios'
import type { StorageAdapter } from '@/components/GraphEditor/types/adapter'

const adapter: StorageAdapter = {
  async load() {
    const { data } = await axios.get('/api/graph')
    return data
  },
  async save(operations, version) {
    await axios.post('/api/graph/operations', { operations, version })
  },
}
```

## 快捷键（编辑模式）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Delete` | 删除选中节点/边 |
| `Ctrl+A` | 全选 |
| `Esc` | 取消选中 |
| `Shift+拖拽节点` | 连线 |

## 目录结构

```
GraphEditor/
├── GraphEditor.vue          # 主组件
├── composables/
│   ├── useGraphInstance.ts  # G6 实例管理
│   ├── useCommandManager.ts # 命令模式（撤销/重做）
│   └── useGraphSync.ts      # 数据同步（防抖/重试）
├── types/
│   ├── graph.ts             # 图数据类型
│   ├── operations.ts        # 操作与命令类型
│   └── adapter.ts           # 存储适配器类型
├── utils/
│   ├── idGenerator.ts       # ID 生成器
│   └── patch.ts             # Operation → 全量数据
├── styles/
│   └── index.scss           # 样式
└── __tests__/
    └── useCommandManager.spec.ts
```

## 运行测试

```bash
npm run test
```
