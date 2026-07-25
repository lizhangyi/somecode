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
    /** 网格大小（0 表示不显示网格） */
    gridSize?: number
    /** 节点形状：rect 圆角矩形 / circle 圆形 */
    nodeShape?: 'rect' | 'circle'
  }>(),
  {
    nodeKey: 'id',
    selectedNodeId: null,
    showMinimap: true,
    showZoomControls: true,
    gridSize: 20,
    nodeShape: 'rect',
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
  forceLayout,
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
      { mode: props.mode, layout: props.layout, gridSize: props.gridSize },
    )

    // 绑定事件
    bindGraphEvents(graph)

    // 渲染数据
    renderData(data, props.nodeShape)

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

  // 清除所有选中状态（G6 视觉态 + 父组件 selectedNodeId）
  function clearSelection(): void {
    emit('update:selectedNodeId', null)
    graph.findAllByState('node', 'selected').forEach((n: { getModel: () => Record<string, unknown> }) => {
      graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
    })
    graph.findAllByState('edge', 'selected').forEach((e: { getModel: () => Record<string, unknown> }) => {
      graph.setItemState(e as unknown as Parameters<Graph['setItemState']>[0], 'selected', false)
    })
  }

  // 方案 A：canvas:click 仅在点击空白（非节点/边）时触发，直接清除选中
  graph.on('canvas:click', () => {
    clearSelection()
  })

  // 方案 B：通用 click 兜底（drag-canvas 等行为可能吞掉 canvas:click）。
  // 当 evt.item 为空 => 点击空白，清除选中；点中节点/边时 evt.item 有值，不清除。
  graph.on('click', (evt: { item?: unknown }) => {
    if (!evt.item) clearSelection()
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

  // 节点拖拽结束 —— 写入 fx/fy 防止力导向回弹 + 吸附网格 + 通过命令系统更新存储
  graph.on('node:dragend', (evt) => {
    const { item } = evt
    if (!item) return
    const model = item.getModel() as Record<string, unknown>

    // 吸附到网格
    const gs = props.gridSize ?? 0
    if (gs > 0) {
      const snappedX = Math.round((model.x as number) / gs) * gs
      const snappedY = Math.round((model.y as number) / gs) * gs
      model.x = snappedX
      model.y = snappedY
    }

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

  // 缩放监听 + 网格跟随
  graph.on('viewportchange', () => {
    const zoom = graph.getZoom()
    zoomPercent.value = Math.round(zoom * 100)

    // 同步网格 overlay：网格 div 始终 100% 铺满容器（不会露白边）。
    // 平移用 background-position 体现（仅保留一个周期内位移），缩放用背景周期 gridSize*zoom 体现。
    // group 矩阵为 [a,0,0, 0,d,0, e,f,1]，a=d=zoom，e/f 为画布平移（像素）。
    const container = graph.get('container') as HTMLElement
    if (container && props.gridSize > 0) {
      const gridEl = container.querySelector('.g6-grid-overlay') as HTMLElement
      if (gridEl) {
        const matrix = (graph.getGroup().getMatrix() || [1, 0, 0, 0, 1, 0, 0, 0, 1]) as number[]
        const zoomM = matrix[0]
        const tx = matrix[6]
        const ty = matrix[7]
        const p = props.gridSize * zoomM
        gridEl.style.backgroundImage = [
          `repeating-linear-gradient(0deg, transparent, transparent ${p - 1}px, rgba(136,136,136,0.18) ${p - 1}px, rgba(136,136,136,0.18) ${p}px)`,
          `repeating-linear-gradient(90deg, transparent, transparent ${p - 1}px, rgba(136,136,136,0.18) ${p - 1}px, rgba(136,136,136,0.18) ${p}px)`,
        ].join(',')
        // 偏移取模一个周期：网格可无限重复，方向与画布平移一致（tx 增大 → 网格右移）
        const ox = ((tx % p) + p) % p
        const oy = ((ty % p) + p) % p
        gridEl.style.backgroundPosition = `${ox}px ${oy}px`
      }
    }
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

  const gs = props.gridSize ?? 0
  const snap = (v: number | undefined): number | undefined => {
    if (v === undefined || gs <= 0) return v
    return Math.round(v / gs) * gs
  }

  const nodeData: NodeData = {
    id: data.id || generateId('node'),
    label: data.label || '新节点',
    x: snap(data.x),
    y: snap(data.y),
    fx: snap(data.fx),
    fy: snap(data.fy),
    properties: data.properties || {},
    style: data.style,
    type: data.type,
  }

  const command = new AddNodeCommand(graph, nodeData)
  execute(command)
  isEmpty.value = false
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
  isEmpty.value = false
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
async function clear(): Promise<void> {
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

  // 立即持久化删除操作（必须 await，确保保存完成后再清历史）
  await flush()

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

/**
 * 一键力导向 —— 清除固定位置后重新布局，并通过命令系统持久化新位置
 */
function forceLayoutExpose(): void {
  const graph = graphInstance.value
  if (!graph || props.mode !== 'edit') return

  // 执行力导向布局（清除 fx/fy → layout → fitView）
  forceLayout()

  // 布局完成后，为每个节点的位置创建 UpdateNodeCommand（持久化新位置 + 重新固定）
  graph.getNodes().forEach((node) => {
    const model = node.getModel() as Record<string, unknown>
    // 直接写 fx/fy 锁定新位置
    model.fx = model.x
    model.fy = model.y
    const command = new UpdateNodeCommand(graph, model.id as string, {
      x: model.x as number,
      y: model.y as number,
      fx: model.fx as number,
      fy: model.fy as number,
    })
    execute(command)
  })
}

/**
 * 切换节点形状（圆形 / 矩形）
 */
function setNodeShape(shape: 'rect' | 'circle'): void {
  if (!graphInstance.value) return
  const data = getCurrentData()
  renderData(data, shape)
}

/**
 * 搜索节点：按标签模糊匹配，高亮命中节点并居中到第一个匹配项
 * @param keyword 搜索关键字
 * @returns 匹配到的节点数量
 */
function searchNode(keyword: string): number {
  const graph = graphInstance.value
  if (!graph) return 0

  // 清除上一次的高亮（节点 + 边）
  graph.getNodes().forEach((n) => {
    graph.setItemState(n, 'search-highlight', false)
  })
  graph.getEdges().forEach((e) => {
    graph.setItemState(e, 'search-highlight', false)
  })

  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return 0

  const matched = graph.getNodes().filter((n) => {
    const model = n.getModel() as Record<string, unknown>
    const label = (model.label as string) || ''
    return label.toLowerCase().includes(kw)
  })

  // 高亮目标节点 + 其直接相连的一级节点 + 它们之间的连线
  const highlightSet = new Set<ReturnType<Graph['getNodes']>[number]>()
  const edgeSet = new Set<ReturnType<Graph['getEdges']>[number]>()
  matched.forEach((n) => {
    highlightSet.add(n)
    const neighbors = n.getNeighbors()
    neighbors.forEach((nb) => highlightSet.add(nb))
    const edges = n.getEdges()
    edges.forEach((e) => edgeSet.add(e))
  })
  highlightSet.forEach((n) => {
    graph.setItemState(n, 'search-highlight', true)
  })
  edgeSet.forEach((e) => {
    graph.setItemState(e, 'search-highlight', true)
  })

  if (matched.length > 0) {
    graph.focusItem(matched[0], true)
  }

  return matched.length
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
  forceLayout: forceLayoutExpose,
  setNodeShape,
  searchNode,
})

// ==================== Lifecycle ====================

// 监听节点形状切换，重渲染画布
watch(
  () => props.nodeShape,
  (newShape) => {
    if (graphReady.value && graphInstance.value) {
      const data = getCurrentData()
      renderData(data, newShape)
    }
  },
)

onMounted(async () => {
  await initGraph()

  // 冲突回调 —— 自动刷新
  conflictCb.value = async () => {
    alert('数据冲突：数据已被其他人修改，即将刷新页面。')
    await refresh()
  }
})

onBeforeUnmount(async () => {
  // 销毁前立即保存待处理的操作
  await flush()
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
