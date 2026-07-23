<template>
  <div class="graph-editor" ref="containerRef" tabindex="0" @keydown="handleKeydown">
    <!-- 加载中插槽 -->
    <div v-if="loading" class="graph-editor__loading">
      <slot name="loading">
        <span>加载中...</span>
      </slot>
    </div>

    <!-- 空状态插槽 -->
    <div v-else-if="isEmpty" class="graph-editor__empty">
      <slot name="empty">
        <span>暂无数据</span>
      </slot>
    </div>

    <!-- ���布容器 -->
    <div
      class="graph-editor__canvas-wrapper"
      ref="canvasWrapperRef"
      :style="{ display: loading || isEmpty ? 'none' : 'block' }"
    ></div>

    <!-- Minimap 缩略图容器 -->
    <div v-if="showMinimap && !loading && !isEmpty" class="graph-editor__minimap" ref="minimapRef"></div>

    <!-- 缩放控制 -->
    <div v-if="showZoomControls && !loading && !isEmpty" class="graph-editor__zoom-controls">
      <button title="放大" @click="zoomIn">+</button>
      <span class="graph-editor__zoom-controls__percent">{{ zoomPercent }}%</span>
      <button title="缩小" @click="zoomOut">-</button>
    </div>

    <!-- 未保存指示器 -->
    <div v-if="hasPendingChanges && !loading" class="graph-editor__unsaved-indicator">
      未保存
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GraphEditor —— 关系图编辑器主组件
 *
 * 使用方式：
 * <GraphEditor mode="edit" :storage="adapter" v-model:selected-node-id="selectedId" @node-click="handleClick" />
 */
import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  computed,
  useSlots,
  type Ref,
} from 'vue'
import type { Graph } from '@antv/g6'
import { useGraphInstance } from './composables/useGraphInstance'
import { useCommandManager } from './composables/useCommandManager'
import {
  AddNodeCommand,
  DeleteNodeCommand,
  UpdateNodeCommand,
  AddEdgeCommand,
  DeleteEdgeCommand,
  UpdateEdgeCommand,
} from './composables/commands'
import { useGraphSync } from './composables/useGraphSync'
import { generateId } from './utils/idGenerator'
import type { NodeData, EdgeData, GraphData } from './types/graph'
import type { StorageAdapter } from './types/adapter'

// ==================== Props ====================

const props = withDefaults(
  defineProps<{
    /** 模式：编辑 / 展示 */
    mode: 'edit' | 'display'
    /** 存储适配器（必传） */
    storage: StorageAdapter
    /** 力导向布局配置 */
    layout?: Record<string, unknown>
    /** 节点唯一键 */
    nodeKey?: string
    /** 默认初始数据 */
    defaultData?: GraphData
    /** 选中节点 ID（支持 v-model） */
    selectedNodeId?: string | null
    /** 是否显示 Minimap */
    showMinimap?: boolean
    /** 是否显示缩放控件 */
    showZoomControls?: boolean
  }>(),
  {
    nodeKey: 'id',
    selectedNodeId: null,
    showMinimap: true,
    showZoomControls: true,
    layout: () => ({
      type: 'force',
      preventOverlap: true,
      nodeStrength: -200,
      edgeStrength: 0.1,
      nodeSize: 40,
      linkDistance: 200,
    }),
  },
)

// ==================== Emits ====================

const emit = defineEmits<{
  /** 节点点击 */
  nodeClick: [data: NodeData]
  /** 选中节点 ID 更新（用于 v-model） */
  'update:selectedNodeId': [id: string | null]
  /** 数据变更 */
  dataChange: [operations: import('./types/operations').Operation[], version?: number]
  /** 图实例就绪 */
  ready: [graphInstance: Graph]
  /** 加载状态 */
  loading: [status: boolean]
}>()

// ==================== Template Refs ====================

const containerRef = ref<HTMLDivElement>()
const canvasWrapperRef = ref<HTMLDivElement>()
const minimapRef = ref<HTMLDivElement>()

// ==================== Composables ====================

const {
  graphInstance,
  createGraph,
  destroyGraph,
  renderData,
  getCurrentData,
  fitView,
  exportImage,
} = useGraphInstance()

const {
  state: cmdState,
  operationQueue,
  execute,
  undo: cmdUndo,
  redo: cmdRedo,
  clearHistory,
  clearQueue,
  hasPendingChanges,
} = useCommandManager()

const {
  isSaving,
  lastError,
  flush,
  cancel,
  onConflict: conflictCb,
} = useGraphSync(
  operationQueue,
  props.storage,
  () => currentVersion.value,
  () => {
    clearQueue()
    currentVersion.value = (currentVersion.value || 0) + 1
  },
)

// ==================== State ====================

const loading = ref(false)
const isEmpty = ref(false)
const currentVersion = ref<number | undefined>(undefined)
const graphReady = ref(false)
const zoomPercent = ref(100)

/**
 * 初始化图实例
 */
async function initGraph(): Promise<void> {
  if (!canvasWrapperRef.value) return

  loading.value = true
  emit('loading', true)

  try {
    // 加载数据
    const data = await props.storage.load()
    currentVersion.value = data.version

    if (!data.nodes || data.nodes.length === 0) {
      isEmpty.value = true
      loading.value = false
      emit('loading', false)
      return
    }

    isEmpty.value = false

    // 先关闭 loading，确保 canvas 容器可见后再测量尺寸
    loading.value = false
    emit('loading', false)
    await nextTick()

    const rect = canvasWrapperRef.value.getBoundingClientRect()
    const graph = createGraph(
      canvasWrapperRef.value,
      rect.width,
      rect.height,
      { mode: props.mode, layout: props.layout },
    )

    // 绑定事件
    bindGraphEvents(graph)

    // 渲染数据
    renderData(data)

    // 初始化 Minimap
    if (props.showMinimap && minimapRef.value) {
      initMinimap(graph)
    }

    graphReady.value = true
    emit('ready', graph)
  } catch (err) {
    console.error('[GraphEditor] 初始化失败:', err)
    alert('图组件初始化失败，请检查存储适配器。')
  } finally {
    loading.value = false
    emit('loading', false)
  }
}

/**
 * 绑定 G6 事件
 */
function bindGraphEvents(graph: Graph): void {
  // 节点点击
  graph.on('node:click', (evt) => {
    const { item } = evt
    if (!item) return

    const model = item.getModel() as Record<string, unknown>
    const nodeData: NodeData = {
      id: model.id as string,
      label: (model.label as string) || '',
      x: model.x as number | undefined,
      y: model.y as number | undefined,
      fx: (model.fx ?? model.x) as number | undefined,
      fy: (model.fy ?? model.y) as number | undefined,
      properties: (model.properties as Record<string, unknown>) || {},
    }

    emit('nodeClick', nodeData)
    emit('update:selectedNodeId', nodeData.id)

    // 仅在编辑模式下选中（先清除其他选中，再选当前）
    if (props.mode === 'edit') {
      graph.findAllByState('node', 'selected').forEach((n: { getModel: () => Record<string, unknown> }) => {
        graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
      })
      graph.findAllByState('edge', 'selected').forEach((e: { getModel: () => Record<string, unknown> }) => {
        graph.setItemState(e as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
      })
      graph.setItemState(item, 'selected', true)
    }
  })

  // 节点悬浮 —— 显示锚点圆圈（用 mousemove + 碰撞检测，比 mouseenter/mouseleave 更可靠）
  let hoverPending = false
  graph.on('mousemove', (evt: Record<string, unknown>) => {
    if (props.mode !== 'edit' || hoverPending) return
    hoverPending = true
    requestAnimationFrame(() => {
      hoverPending = false

      const mx = (evt.x as number) || 0
      const my = (evt.y as number) || 0

      // 清除所有节点的 hover 状态
      graph.findAllByState('node', 'hover').forEach((n: { getModel: () => Record<string, unknown> }) => {
        graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'hover', false)
      })

      // 找到鼠标下方的节点
      const nodes = graph.getNodes()
      const hovered = nodes.find((node: { getBBox: () => { minX: number; minY: number; maxX: number; maxY: number } }) => {
        const b = node.getBBox()
        return mx >= b.minX && mx <= b.maxX && my >= b.minY && my <= b.maxY
      })

      if (hovered) {
        graph.setItemState(hovered as unknown as Parameters<Graph['setItemState']>[0], 'hover', true)
      }
    })
  })

  // 画布空白区域点击 —— 取消选中
  graph.on('canvas:click', () => {
    emit('update:selectedNodeId', null)
    graph.getNodes().forEach((node: { getModel: () => Record<string, unknown> }) => {
      graph.setItemState(node as Parameters<Graph['setItemState']>[0], 'selected', false)
    })
  })

  // 创建边事件（拖拽连线）
  graph.on('aftercreateedge', (evt: Record<string, unknown>) => {
    if (!evt.edge) return
    const edgeModel = (evt.edge as { getModel: () => Record<string, unknown> }).getModel()
    const edgeData: EdgeData = {
      id: edgeModel.id as string,
      source: edgeModel.source as string,
      target: edgeModel.target as string,
      type: (edgeModel.type as EdgeData['type']) || 'line',
      label: (edgeModel.label as string) || '',
    }

    const command = new AddEdgeCommand(graph, edgeData)
    execute(command)
    emit('dataChange', operationQueue.value, currentVersion.value)
  })

  // 边点击（编辑模式下选中边）
  if (props.mode === 'edit') {
    graph.on('edge:click', (evt: { item?: { getModel: () => Record<string, unknown> } }) => {
      const { item } = evt
      if (!item) return
      const model = item.getModel() as Record<string, unknown>
      emit('update:selectedNodeId', model.id as string)
      // 先清除其他选中，再选当前边
      graph.findAllByState('node', 'selected').forEach((n: { getModel: () => Record<string, unknown> }) => {
        graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
      })
      graph.findAllByState('edge', 'selected').forEach((e: { getModel: () => Record<string, unknown> }) => {
        graph.setItemState(e as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
      })
      graph.setItemState(item as unknown as Parameters<Graph['setItemState']>[0], 'selected', true)
    })
  }

  // 自定义拖拽连线（替代 create-edge behavior，避免与 drag-node 冲突）
  setupCustomEdgeCreation(graph)

  // 节点拖拽结束 —— 写入 fx/fy 防止力导向回弹 + 通过命令系统更新存储
  graph.on('node:dragend', (evt) => {
    const { item } = evt
    if (!item) return
    const model = item.getModel() as Record<string, unknown>

    // 直接在 model 上写入 fx/fy（避免 updateItem 导致文字重影）
    model.fx = model.x
    model.fy = model.y

    // 通过命令系统更新位置，触发 operationQueue → useGraphSync → 存储
    if (props.mode === 'edit') {
      const nodeId = model.id as string
      const x = model.x as number
      const y = model.y as number
      if (nodeId && x !== undefined && y !== undefined) {
        const command = new UpdateNodeCommand(graph, nodeId, { x, y, fx: x, fy: y })
        execute(command)
      }
    }
  })

  // 缩放监听
  graph.on('viewportchange', () => {
    const zoom = graph.getZoom()
    zoomPercent.value = Math.round(zoom * 100)
  })
}

/**
 * 自定义拖拽连线
 * 监听 mousedown 在锚点圆圈上，拖出临时虚线，松手到目标节点时创建边
 * 完全绕过 G6 create-edge behavior，不与 drag-node 冲突
 */
function setupCustomEdgeCreation(graph: Graph): void {
  let drawing = false
  let sourceNodeId = ''
  let tempEdge: Record<string, unknown> | null = null

  // 三角形箭头 SVG path
  const ARROW_PATH = 'M 0,0 L 6,-4 L 6,4 Z'

  // 从锚点圆圈按下 → 开始画临时线
  graph.on('node:mousedown', (evt: Record<string, unknown>) => {
    if (props.mode !== 'edit') return

    const shape = evt.shape as { get?: (k: string) => unknown } | undefined
    if (!shape || typeof shape.get !== 'function') return

    const shapeName = shape.get('name') as string | undefined
    if (!shapeName || !shapeName.startsWith('anchor-')) return

    const item = evt.item as { getID: () => string } | undefined
    if (!item) return

    drawing = true
    sourceNodeId = item.getID()

    // G6 事件中 x/y 已经是画布坐标
    const pt = { x: (evt.x as number) || 0, y: (evt.y as number) || 0 }

    tempEdge = graph.addItem('edge', {
      id: 'temp-drawing-edge',
      source: sourceNodeId,
      target: pt,
      style: {
        stroke: '#4B7BEC',
        lineWidth: 2,
        lineDash: [6, 4],
        endArrow: {
          path: ARROW_PATH,
          fill: '#4B7BEC',
        },
      },
    }) as unknown as Record<string, unknown>
  })

  // 移动鼠标 → 更新临时线终点
  graph.on('mousemove', (evt: Record<string, unknown>) => {
    if (!drawing || !tempEdge) return
    graph.updateItem(tempEdge as unknown as Parameters<Graph['updateItem']>[0], {
      target: { x: (evt.x as number) || 0, y: (evt.y as number) || 0 },
    })
  })

  // 松开鼠标 → 命中目标节点则创建边，否则取消
  graph.on('mouseup', (evt: Record<string, unknown>) => {
    if (!drawing) return
    drawing = false

    if (tempEdge) {
      graph.removeItem(tempEdge as unknown as Parameters<Graph['removeItem']>[0])
      tempEdge = null
    }

    const mx = (evt.x as number) || 0
    const my = (evt.y as number) || 0

    const nodes = graph.getNodes()
    const hitNode = nodes.find((node: { getBBox: () => { minX: number; minY: number; maxX: number; maxY: number } }) => {
      const b = node.getBBox()
      return mx >= b.minX && mx <= b.maxX && my >= b.minY && my <= b.maxY
    })

    if (hitNode) {
      const targetId = (hitNode.getModel() as Record<string, unknown>).id as string
      if (targetId && targetId !== sourceNodeId) {
        // 检查是否已存在相同方向的边
        const allEdges = graph.getEdges()
        const dup = allEdges.some((e: { getModel: () => Record<string, unknown> }) => {
          const m = e.getModel()
          return (m.source === sourceNodeId && m.target === targetId)
            || (m.source === targetId && m.target === sourceNodeId)
        })
        if (!dup) {
          const edgeData: EdgeData = {
            id: generateId('edge'),
            source: sourceNodeId,
            target: targetId,
            type: 'line',
            label: '',
          }
          const command = new AddEdgeCommand(graph, edgeData)
          execute(command)
          emit('dataChange', operationQueue.value, currentVersion.value)
        }
      }
    }
    sourceNodeId = ''
  })
}

/**
 * 初始化 Minimap 缩略图
 */
async function initMinimap(graph: Graph): Promise<void> {
  try {
    const { Minimap } = await import('@antv/g6')

    if (minimapRef.value) {
      const minimap = new Minimap({
        container: minimapRef.value,
        size: [180, 120],
        className: 'graph-editor-minimap',
        type: 'delegate',
        delegateStyle: {
          fill: '#4B7BEC',
          stroke: '#3B6BDB',
        },
        viewportStyle: {
          fill: '#4B7BEC',
          stroke: '#3B6BDB',
          fillOpacity: 0.1,
        },
        refresh: true,
      })
      graph.addPlugin(minimap)
    }
  } catch (err) {
    console.warn('[GraphEditor] Minimap 初始化失败:', err)
  }
}

// ==================== Mode Watch ====================

watch(
  () => props.mode,
  async (newMode) => {
    if (!graphReady.value || !canvasWrapperRef.value) return

    const graph = graphInstance.value
    if (!graph) return

    if (newMode === 'edit') {
      graph.setMode('default')
      const savedData = graph.save()
      graph.changeData(savedData)
    } else {
      // 展示模式：禁用编辑交互
      const modes = graph.get('modes') as Record<string, string[]>
      if (modes.default && modes.default.length > 0) {
        graph.setMode('display')
      }
    }
  },
)

// ==================== Keyboard Shortcuts ====================

/**
 * 键盘快捷键处理
 */
function handleKeydown(e: KeyboardEvent): void {
  if (props.mode !== 'edit') return

  const graph = graphInstance.value
  if (!graph) return

  // Ctrl+Z 撤销
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    cmdUndo()
    return
  }

  // Ctrl+Y 或 Ctrl+Shift+Z 重做
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    cmdRedo()
    return
  }

  // Delete 删除选中
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteSelected()
    return
  }

  // Ctrl+A 全选
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    selectAll()
    return
  }

  // Esc 取消选中
  if (e.key === 'Escape') {
    e.preventDefault()
    graph.getNodes().forEach((node) => graph.setItemState(node, 'selected', false))
    graph.getEdges().forEach((edge) => graph.setItemState(edge, 'selected', false))
    emit('update:selectedNodeId', null)
    return
  }

  // Ctrl+C 复制选中节点
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    // 复制逻辑在 P2 中实现
  }

  // Ctrl+V 粘贴
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    // 粘贴逻辑在 P2 中实现
  }
}

/**
 * 全选
 */
function selectAll(): void {
  const graph = graphInstance.value
  if (!graph) return

  const nodes = graph.getNodes()
  nodes.forEach((node) => graph.setItemState(node, 'selected', true))
}

/**
 * 删除选中项
 */
function deleteSelected(): void {
  const graph = graphInstance.value
  if (!graph) return

  // 删除选中的边
  const selectedEdges = graph.findAllByState('edge', 'selected')
  selectedEdges.forEach((edge) => {
    const model = edge.getModel() as Record<string, unknown>
    const command = new DeleteEdgeCommand(graph, model.id as string)
    execute(command)
  })

  // 删除选中的节点
  const selectedNodes = graph.findAllByState('node', 'selected')
  selectedNodes.forEach((node) => {
    const model = node.getModel() as Record<string, unknown>
    const command = new DeleteNodeCommand(graph, model.id as string)
    execute(command)
  })

  emit('update:selectedNodeId', null)
}

// ==================== Expose ====================

/**
 * 更新节点
 */
function updateNode(id: string, data: Partial<NodeData>): void {
  const graph = graphInstance.value
  if (!graph) return

  const command = new UpdateNodeCommand(graph, id, data)
  execute(command)
}

/**
 * 更新边
 */
function updateEdge(id: string, data: Partial<EdgeData>): void {
  const graph = graphInstance.value
  if (!graph) return

  const command = new UpdateEdgeCommand(graph, id, data)
  execute(command)
}

/**
 * 删除节点
 */
function deleteNode(id: string): void {
  const graph = graphInstance.value
  if (!graph) return

  const command = new DeleteNodeCommand(graph, id)
  execute(command)
}

/**
 * 添加节点
 */
function addNode(data: Partial<NodeData> & { id?: string }): string {
  const graph = graphInstance.value
  if (!graph) return ''

  const nodeData: NodeData = {
    id: data.id || generateId('node'),
    label: data.label || '新节点',
    x: data.x,
    y: data.y,
    fx: data.fx,
    fy: data.fy,
    properties: data.properties || {},
    style: data.style,
    type: data.type,
  }

  const command = new AddNodeCommand(graph, nodeData)
  execute(command)
  return nodeData.id
}

/**
 * 添加边
 */
function addEdge(data: Partial<EdgeData> & { source: string; target: string }): string {
  const graph = graphInstance.value
  if (!graph) return ''

  const edgeData: EdgeData = {
    id: data.id || generateId('edge'),
    source: data.source,
    target: data.target,
    type: data.type || 'line',
    label: data.label || '',
    style: data.style,
  }

  const command = new AddEdgeCommand(graph, edgeData)
  execute(command)
  return edgeData.id
}

/**
 * 获取全部数据
 */
function getAllData(): GraphData {
  return getCurrentData()
}

/**
 * 适配视图
 */
function fitViewExpose(padding?: number | number[]): void {
  fitView(padding)
}

/**
 * 撤销
 */
function undo(): void {
  cmdUndo()
}

/**
 * 重做
 */
function redo(): void {
  cmdRedo()
}

/**
 * 清空画布
 */
function clear(): void {
  const graph = graphInstance.value
  if (!graph) return

  const data = getCurrentData()

  // 删除所有边
  data.edges.forEach((e) => {
    const command = new DeleteEdgeCommand(graph, e.id)
    execute(command)
  })

  // 删除所有节点
  data.nodes.forEach((n) => {
    const command = new DeleteNodeCommand(graph, n.id)
    execute(command)
  })

  clearHistory()
  isEmpty.value = true
}

/**
 * 刷新（重新加载数据）
 */
async function refresh(): Promise<void> {
  destroyGraph()
  graphReady.value = false
  clearHistory()
  await initGraph()
}

/**
 * 导出图片
 */
async function exportImageExpose(config?: {
  backgroundColor?: string
  padding?: number | number[]
}): Promise<string> {
  return exportImage(config)
}

/**
 * 缩放控制
 */
function zoomIn(): void {
  const graph = graphInstance.value
  if (!graph) return
  const current = graph.getZoom()
  graph.zoomTo(Math.min(current * 1.2, 5))
  zoomPercent.value = Math.round(graph.getZoom() * 100)
}

function zoomOut(): void {
  const graph = graphInstance.value
  if (!graph) return
  const current = graph.getZoom()
  graph.zoomTo(Math.max(current / 1.2, 0.2))
  zoomPercent.value = Math.round(graph.getZoom() * 100)
}

defineExpose({
  updateNode,
  updateEdge,
  deleteNode,
  addNode,
  addEdge,
  getAllData,
  exportImage: exportImageExpose,
  fitView: fitViewExpose,
  undo,
  redo,
  clear,
  refresh,
})

// ==================== Lifecycle ====================

onMounted(async () => {
  await initGraph()

  // 冲突回调 —— 自动刷新
  conflictCb.value = async () => {
    alert('数据冲突：数据已被其他人修改，即将刷新页面。')
    await refresh()
  }
})

onBeforeUnmount(() => {
  // 销毁前尝试刷新保存
  cancel()
  destroyGraph()
})

// ==================== unsaved 脏检查 ====================

/**
 * 页面关闭前提醒未保存
 */
function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasPendingChanges.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<style lang="scss" scoped>
@use './styles/index.scss';
</style>
