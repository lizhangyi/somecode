<template>
  <div class="graph-demo">
    <!-- 顶部工具栏 -->
    <header class="graph-demo__header">
      <h1 class="graph-demo__title">GraphEditor 演示</h1>

      <div class="graph-demo__controls">
        <!-- 模式切换 -->
        <div class="graph-demo__btn-group">
          <button
            :class="['graph-demo__btn', { 'graph-demo__btn--active': mode === 'edit' }]"
            @click="mode = 'edit'"
          >
            编辑模式
          </button>
          <button
            :class="['graph-demo__btn', { 'graph-demo__btn--active': mode === 'display' }]"
            @click="mode = 'display'"
          >
            展示模式
          </button>
        </div>

        <div class="graph-demo__divider"></div>

        <!-- 工具栏按钮 -->
        <button class="graph-demo__btn" @click="handleAddNode" :disabled="mode !== 'edit'">
          + 添加节点
        </button>
        <button class="graph-demo__btn" @click="handleAddEdge" :disabled="mode !== 'edit'">
          + 添加边
        </button>
        <button class="graph-demo__btn" @click="handleUndo" :disabled="!canUndo || mode !== 'edit'">
          撤销
        </button>
        <button class="graph-demo__btn" @click="handleRedo" :disabled="!canRedo || mode !== 'edit'">
          重做
        </button>
        <button class="graph-demo__btn" @click="handleFitView">
          居中
        </button>
        <button class="graph-demo__btn" @click="handleForceLayout" :disabled="mode !== 'edit'">
          力导向
        </button>
        <button class="graph-demo__btn" @click="handleExportImage">
          导出截图
        </button>
        <button class="graph-demo__btn graph-demo__btn--danger" @click="handleClear">
          清空
        </button>

        <div class="graph-demo__divider"></div>

        <!-- 节点形状 -->
        <span class="graph-demo__label">节点形状：</span>
        <select
          class="graph-demo__select"
          v-model="nodeShape"
          :disabled="mode !== 'edit'"
        >
          <option value="rect">矩形</option>
          <option value="circle">圆形</option>
        </select>

        <div class="graph-demo__divider"></div>

        <!-- 切换所有边的类型 -->
        <span class="graph-demo__label">边类型：</span>
        <select
          class="graph-demo__select"
          v-model="selectedEdgeType"
          @change="handleChangeEdgeType"
          :disabled="mode !== 'edit'"
        >
          <option value="line">直线</option>
          <option value="quadratic">二次贝塞尔</option>
          <option value="cubic">三次贝塞尔</option>
        </select>
      </div>
    </header>

    <!-- 主体区域 -->
    <div class="graph-demo__body">
      <!-- 画布区域 -->
      <div class="graph-demo__canvas-area">
        <GraphEditor
          ref="graphEditorRef"
          :mode="mode"
          :storage="storageAdapter"
          :node-shape="nodeShape"
          :selected-node-id="selectedNodeId"
          @node-click="handleNodeClick"
          @update:selectedNodeId="selectedNodeId = $event"
          @ready="handleReady"
        />
      </div>

      <!-- 侧边栏 -->
      <aside class="graph-demo__sidebar" v-if="mode === 'edit'">
        <div class="graph-demo__sidebar-header">
          <h3>节点属性</h3>
        </div>

        <div v-if="!selectedNodeId" class="graph-demo__sidebar-empty">
          <p>点击画布中的节点查看和编辑属性</p>
          <div class="graph-demo__sidebar-tips">
            <p><strong>快捷键：</strong></p>
            <ul>
              <li><kbd>Ctrl+Z</kbd> 撤销</li>
              <li><kbd>Ctrl+Y</kbd> 重做</li>
              <li><kbd>Delete</kbd> 删除选中</li>
              <li><kbd>Ctrl+A</kbd> 全选</li>
              <li><kbd>Esc</kbd> 取消选中</li>
              <li><kbd>拖拽节点</kbd> 连线</li>
            </ul>
          </div>
        </div>

        <div v-else-if="isSelectedEdge" class="graph-demo__sidebar-form">
          <div class="graph-demo__form-group">
            <label>边 ID</label>
            <input type="text" :value="selectedNodeId" disabled />
          </div>

          <div class="graph-demo__form-group">
            <label>名称</label>
            <input
              type="text"
              :value="selectedEdgeLabel"
              @input="handleEdgeLabelChange"
              placeholder="输入边名称"
            />
          </div>

          <p style="color: #999; font-size: 13px; padding: 16px 0;">
            使用上方"边类型"下拉框统一切换所有边的样式
          </p>
        </div>

        <div v-else class="graph-demo__sidebar-form">
          <div class="graph-demo__form-group">
            <label>节点 ID</label>
            <input type="text" :value="selectedNodeId" disabled />
          </div>

          <div class="graph-demo__form-group">
            <label>标签</label>
            <input
              type="text"
              :value="selectedNodeLabel"
              @input="handleLabelChange"
              placeholder="输入节点标签"
            />
          </div>

          <div class="graph-demo__form-group">
            <label>自定义属性 (properties)</label>
            <div
              v-for="(value, key) in selectedNodeProperties"
              :key="key"
              class="graph-demo__prop-row"
            >
              <input
                type="text"
                :value="key"
                @change="(e) => handlePropKeyChange(key, (e.target as HTMLInputElement).value)"
                placeholder="属性名"
              />
              <input
                type="text"
                :value="typeof value === 'string' ? value : JSON.stringify(value)"
                @change="(e) => handlePropValueChange(key, (e.target as HTMLInputElement).value)"
                placeholder="属性值"
              />
              <button class="graph-demo__btn--small graph-demo__btn--danger" @click="handleDeleteProp(key)">×</button>
            </div>
            <button class="graph-demo__btn--small" @click="handleAddProp">+ 添加属性</button>
          </div>

          <button class="graph-demo__btn graph-demo__btn--danger" @click="handleDeleteNode">删除节点</button>
        </div>
      </aside>
    </div>

    <!-- 状态栏 -->
    <footer class="graph-demo__statusbar">
      <span v-if="isDirty" class="graph-demo__status graph-demo__status--dirty">● 未保存</span>
      <span v-else class="graph-demo__status graph-demo__status--saved">● 已保存</span>
      <span class="graph-demo__status-info">
        节点: {{ nodeCount }} | 边: {{ edgeCount }}
      </span>
    </footer>

    <!-- 截图预览弹层 -->
    <div v-if="exportedImage" class="graph-demo__overlay" @click="exportedImage = ''">
      <div class="graph-demo__overlay-content" @click.stop>
        <h3>导出截图</h3>
        <img :src="exportedImage" alt="Graph Export" />
        <button class="graph-demo__btn" @click="exportedImage = ''">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GraphDemo —— GraphEditor 组件的 Playground 演示页面
 * 作为组件的使用示例，演示所有功能
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import GraphEditor from '@/components/GraphEditor/GraphEditor.vue'
import type { NodeData, EdgeData, GraphData } from '@/components/GraphEditor/types/graph'
import type { StorageAdapter } from '@/components/GraphEditor/types/adapter'
import type { Operation } from '@/components/GraphEditor/types/operations'
import { applyOperations } from '@/components/GraphEditor/utils/patch'

// ==================== Refs ====================

const graphEditorRef = ref<InstanceType<typeof GraphEditor>>()
const mode = ref<'edit' | 'display'>('edit')
const selectedNodeId = ref<string | null>(null)
const selectedEdgeType = ref<'line' | 'quadratic' | 'cubic'>('line')
const nodeShape = ref<'rect' | 'circle'>('rect')
const exportedImage = ref('')
const isDirty = ref(false)

// 节点数统计
const nodeCount = ref(3)
const edgeCount = ref(2)

// ==================== localStorage StorageAdapter ====================

const STORAGE_KEY = 'graph-editor-demo-data'
const PLAYGROUND_STATE_KEY = 'graph-editor-demo-state'

/** Playground UI 状态持久化 */
interface PlaygroundState {
  mode: 'edit' | 'display'
  selectedEdgeType: 'line' | 'quadratic' | 'cubic'
  nodeShape: 'rect' | 'circle'
}

function savePlaygroundState(): void {
  const state: PlaygroundState = {
    mode: mode.value,
    selectedEdgeType: selectedEdgeType.value,
    nodeShape: nodeShape.value,
  }
  localStorage.setItem(PLAYGROUND_STATE_KEY, JSON.stringify(state))
}

function loadPlaygroundState(): void {
  const raw = localStorage.getItem(PLAYGROUND_STATE_KEY)
  if (!raw) return
  try {
    const state = JSON.parse(raw) as PlaygroundState
    if (state.mode) mode.value = state.mode
    if (state.selectedEdgeType) selectedEdgeType.value = state.selectedEdgeType
    if (state.nodeShape) nodeShape.value = state.nodeShape
  } catch {
    // ignore parse error
  }
}

/**
 * localStorage 实现的 StorageAdapter
 *
 * 实际业务中替换为 axios 示例：
 * ```ts
 * const adapter: StorageAdapter = {
 *   async load() {
 *     const { data } = await axios.get('/api/graph/data')
 *     return data
 *   },
 *   async save(operations, version) {
 *     await axios.post('/api/graph/operations', { operations, version })
 *   },
 * }
 * ```
 */
const storageAdapter: StorageAdapter = {
  async load(): Promise<GraphData> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw) as GraphData
        return data
      } catch {
        console.warn('[Storage] 数据解析失败，使用默认数据')
      }
    }
    return getDefaultData()
  },
  async save(operations: Operation[], version?: number): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEY)
    let data: GraphData

    if (raw) {
      data = JSON.parse(raw) as GraphData
      // 版本检查（模拟乐观锁）
      if (version !== undefined && data.version !== version) {
        const err = new Error('数据冲突') as Error & { status: number }
        err.status = 409
        throw err
      }
      data = applyOperations(data, operations)
      data.version = (data.version || 0) + 1
    } else {
      data = applyOperations(getDefaultData(), operations)
      data.version = 1
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    isDirty.value = false

    // 更新统计
    nodeCount.value = data.nodes.length
    edgeCount.value = data.edges.length
  },
  async saveFull(data: GraphData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: (data.version || 0) + 1 }))
  },
}

/**
 * 预设初始数据
 */
function getDefaultData(): GraphData {
  return {
    nodes: [
      {
        id: 'node-1',
        label: 'Vue 3',
        x: 300,
        y: 200,
        properties: { version: '3.5', type: 'framework' },
      },
      {
        id: 'node-2',
        label: 'TypeScript',
        x: 500,
        y: 200,
        properties: { version: '5.7', type: 'language' },
      },
      {
        id: 'node-3',
        label: 'AntV G6',
        x: 400,
        y: 400,
        properties: { version: '4.8', type: 'library' },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'line', label: '依赖' },
      { id: 'edge-2', source: 'node-1', target: 'node-3', type: 'quadratic', label: '使用' },
    ],
    version: 1,
  }
}

// ==================== 选中节点属性编辑 ====================

/** 判断当前选中项是节点还是边 */
const isSelectedNode = computed(() => {
  if (!selectedNodeId.value || !graphEditorRef.value) return false
  const allData = graphEditorRef.value.getAllData()
  return allData.nodes.some((n) => n.id === selectedNodeId.value)
})

const isSelectedEdge = computed(() => {
  if (!selectedNodeId.value || !graphEditorRef.value) return false
  const allData = graphEditorRef.value.getAllData()
  return allData.edges.some((e) => e.id === selectedNodeId.value)
})

const selectedNodeLabel = computed(() => {
  if (!selectedNodeId.value || !graphEditorRef.value) return ''
  const allData = graphEditorRef.value.getAllData()
  const node = allData.nodes.find((n) => n.id === selectedNodeId.value)
  return node?.label || ''
})

const selectedNodeProperties = computed(() => {
  if (!selectedNodeId.value || !graphEditorRef.value) return {}
  const allData = graphEditorRef.value.getAllData()
  const node = allData.nodes.find((n) => n.id === selectedNodeId.value)
  return node?.properties || {}
})

/** 当前选中边的名称 */
const selectedEdgeLabel = computed(() => {
  if (!selectedNodeId.value || !graphEditorRef.value) return ''
  const allData = graphEditorRef.value.getAllData()
  const edge = allData.edges.find((e) => e.id === selectedNodeId.value)
  return edge?.label || ''
})

/**
 * 节点标签变更
 */
function handleLabelChange(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  if (!selectedNodeId.value || !graphEditorRef.value) return
  graphEditorRef.value.updateNode(selectedNodeId.value, { label: value })
  isDirty.value = true
}

/**
 * 边标签变更
 */
function handleEdgeLabelChange(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  if (!selectedNodeId.value || !graphEditorRef.value) return
  graphEditorRef.value.updateEdge(selectedNodeId.value, { label: value })
  isDirty.value = true
}

/**
 * 属性键变更
 */
function handlePropKeyChange(oldKey: string, newKey: string): void {
  if (!selectedNodeId.value || !graphEditorRef.value) return
  const props = { ...selectedNodeProperties.value }
  const value = props[oldKey]
  delete props[oldKey]
  if (newKey) {
    props[newKey] = value
  }
  graphEditorRef.value.updateNode(selectedNodeId.value, { properties: props })
  isDirty.value = true
}

/**
 * 属性值变更
 */
function handlePropValueChange(key: string, value: string): void {
  if (!selectedNodeId.value || !graphEditorRef.value) return
  const props = { ...selectedNodeProperties.value }

  // 尝试解析 JSON
  try {
    props[key] = JSON.parse(value)
  } catch {
    props[key] = value
  }

  graphEditorRef.value.updateNode(selectedNodeId.value, { properties: props })
  isDirty.value = true
}

/**
 * 添加属性
 */
function handleAddProp(): void {
  if (!selectedNodeId.value || !graphEditorRef.value) return
  const props = { ...selectedNodeProperties.value, newKey: '' }
  graphEditorRef.value.updateNode(selectedNodeId.value, { properties: props })
  isDirty.value = true
}

/**
 * 删除属性
 */
function handleDeleteProp(key: string): void {
  if (!selectedNodeId.value || !graphEditorRef.value) return
  const props = { ...selectedNodeProperties.value }
  delete props[key]
  graphEditorRef.value.updateNode(selectedNodeId.value, { properties: props })
  isDirty.value = true
}

// ==================== 工具栏操作 ====================

function handleNodeClick(data: NodeData): void {
  console.log('[GraphDemo] 节点点击:', data)
}

function handleReady(_graph: unknown): void {
  console.log('[GraphDemo] 图实例就绪')
}

/**
 * 添加节点
 */
function handleAddNode(): void {
  if (!graphEditorRef.value) return
  const id = graphEditorRef.value.addNode({
    label: `节点 ${Date.now() % 10000}`,
    properties: { added: new Date().toISOString() },
  })
  selectedNodeId.value = id
  nodeCount.value += 1
  isDirty.value = true
}

/**
 * 添加边（连接两个已有节点）
 */
function handleAddEdge(): void {
  if (!graphEditorRef.value) return
  const data = graphEditorRef.value.getAllData()
  if (data.nodes.length < 2) {
    alert('至少需要两个节点才能添加边')
    return
  }

  // 连接第一个和最后一个节点
  const source = data.nodes[0]
  const target = data.nodes[data.nodes.length - 1]

  graphEditorRef.value.addEdge({
    source: source.id,
    target: target.id,
    type: selectedEdgeType.value,
    label: `${source.label} → ${target.label}`,
  })

  edgeCount.value += 1
  isDirty.value = true
}

/**
 * 撤销
 */
const canUndo = computed(() => {
  // 通过 G6 的 undo stack 间接判断
  return true
})

const canRedo = computed(() => {
  return true
})

function handleUndo(): void {
  graphEditorRef.value?.undo()
  isDirty.value = true
}

function handleRedo(): void {
  graphEditorRef.value?.redo()
  isDirty.value = true
}

/**
 * 居中
 */
function handleFitView(): void {
  graphEditorRef.value?.fitView()
}

/**
 * 一键力导向 —— 重新执行力导向布局
 */
function handleForceLayout(): void {
  const editor = graphEditorRef.value
  if (!editor) return
  editor.forceLayout()
  isDirty.value = true
}

/**
 * 导出截图
 */
async function handleExportImage(): Promise<void> {
  try {
    if (!graphEditorRef.value) return
    const dataUrl = await graphEditorRef.value.exportImage({
      backgroundColor: '#ffffff',
      padding: 30,
    })
    exportedImage.value = dataUrl
  } catch (err) {
    console.error('[GraphDemo] 导出截图失败:', err)
    alert('导出截图失败')
  }
}

/**
 * 清空画布
 */
function handleClear(): void {
  if (!confirm('确定要清空画布吗？此操作不可撤销。')) return
  graphEditorRef.value?.clear()
  nodeCount.value = 0
  edgeCount.value = 0
  isDirty.value = true
}

/**
 * 切换画布上所有边的类型
 */
function handleChangeEdgeType(): void {
  if (!graphEditorRef.value) return

  const data = graphEditorRef.value.getAllData()

  data.edges.forEach((e) => {
    graphEditorRef.value!.updateEdge(e.id, {
      type: selectedEdgeType.value,
    })
  })

  isDirty.value = true
}

/**
 * 删除选中节点
 */
function handleDeleteNode(): void {
  if (!selectedNodeId.value || !graphEditorRef.value) return
  if (!confirm(`确定删除节点 "${selectedNodeLabel.value}"？`)) return

  graphEditorRef.value.deleteNode(selectedNodeId.value)
  selectedNodeId.value = null
  nodeCount.value = Math.max(0, nodeCount.value - 1)
  isDirty.value = true
}

// ==================== 初始化数据 ====================

onMounted(() => {
  // 恢复 Playground UI 状态
  loadPlaygroundState()

  // 检查是否有已保存数据，没有则写入默认数据
  const existing = localStorage.getItem(STORAGE_KEY)
  if (!existing) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getDefaultData()))
    console.log('[GraphDemo] 已写入默认演示数据')
  }
})

// Playground UI 状态变化自动持久化
watch(mode, savePlaygroundState)
watch(selectedEdgeType, savePlaygroundState)
watch(nodeShape, savePlaygroundState)

onBeforeUnmount(() => {
  // cleanup
})
</script>

<style lang="scss" scoped>
.graph-demo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: #fff;
    border-bottom: 1px solid #e8ecf1;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #1a1a2e;
    white-space: nowrap;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
    justify-content: flex-end;
  }

  &__btn-group {
    display: flex;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    overflow: hidden;

    .graph-demo__btn {
      border-radius: 0;
      border: none;
      border-right: 1px solid #d0d5dd;

      &:last-child {
        border-right: none;
      }
    }
  }

  &__btn {
    padding: 6px 14px;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    background: #fff;
    color: #333;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: #f0f2f5;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--active {
      background: #4B7BEC;
      color: #fff;
      border-color: #4B7BEC;

      &:hover {
        background: #3B6BDB;
      }
    }

    &--danger {
      color: #e74c3c;
      border-color: #e74c3c;

      &:hover:not(:disabled) {
        background: #fdf0ef;
      }
    }

    &--small {
      padding: 2px 8px;
      font-size: 12px;
      border: 1px solid #d0d5dd;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;

      &:hover {
        background: #f0f2f5;
      }
    }
  }

  &__divider {
    width: 1px;
    height: 24px;
    background: #e8ecf1;
  }

  &__select {
    padding: 6px 10px;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__label {
    font-size: 13px;
    color: #666;
    white-space: nowrap;
  }

  &__body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  &__canvas-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    padding: 8px;
  }

  &__sidebar {
    width: 300px;
    border-left: 1px solid #e8ecf1;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }

  &__sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #e8ecf1;

    h3 {
      margin: 0;
      font-size: 15px;
      color: #1a1a2e;
    }
  }

  &__sidebar-empty {
    padding: 24px 16px;
    color: #999;
    font-size: 13px;
    text-align: center;

    p {
      margin: 0 0 16px;
    }
  }

  &__sidebar-tips {
    text-align: left;
    background: #f8f9fb;
    border-radius: 8px;
    padding: 12px 16px;

    p {
      margin: 0 0 8px;
      font-size: 12px;
      color: #333;
    }

    ul {
      margin: 0;
      padding-left: 16px;

      li {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }
    }

    kbd {
      background: #e8ecf1;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 11px;
      font-family: monospace;
    }
  }

  &__sidebar-form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 12px;
      font-weight: 500;
      color: #555;
    }

    input {
      padding: 8px 10px;
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      font-size: 13px;
      outline: none;

      &:focus {
        border-color: #4B7BEC;
        box-shadow: 0 0 0 2px rgba(75, 123, 236, 0.1);
      }

      &:disabled {
        background: #f5f5f5;
        color: #999;
      }
    }
  }

  &__prop-row {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;

    input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #d0d5dd;
      border-radius: 4px;
      font-size: 12px;
      outline: none;

      &:focus {
        border-color: #4B7BEC;
      }
    }
  }

  &__statusbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 20px;
    background: #fff;
    border-top: 1px solid #e8ecf1;
    flex-shrink: 0;
    font-size: 12px;
  }

  &__status {
    &--dirty {
      color: #e74c3c;
    }

    &--saved {
      color: #27ae60;
    }
  }

  &__status-info {
    color: #999;
    margin-left: auto;
  }

  &__overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  &__overlay-content {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    max-width: 80vw;
    max-height: 80vh;
    overflow: auto;

    h3 {
      margin: 0 0 16px;
    }

    img {
      max-width: 100%;
      border: 1px solid #e8ecf1;
      border-radius: 8px;
    }

    .graph-demo__btn {
      margin-top: 16px;
    }
  }
}
</style>
