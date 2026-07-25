<template>
  <div class="graph-editor" ref="containerRef" tabindex="0" @keydown="handleKeydown" @contextmenu.prevent>
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
import type { Graph, Item } from '@antv/g6'
import { useGraphInstance } from './composables/useGraphInstance'
import { useCommandManager } from './composables/useCommandManager'
import {
  AddNodeCommand,
  DeleteNodeCommand,
  UpdateNodeCommand,
  AddEdgeCommand,
  DeleteEdgeCommand,
  UpdateEdgeCommand,
  CompositeCommand,
  CloneNodeCommand,
  ReverseEdgeCommand,
} from './composables/commands'
import { useGraphSync } from './composables/useGraphSync'
import { RECT_NODE_TYPE, CIRCLE_NODE_TYPE, DEFAULT_EDGE_STYLE } from './composables/graphConfig'
import { generateId } from './utils/idGenerator'
import type { NodeData, EdgeData, GraphData, EdgeType } from './types/graph'
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
    /** 是否启用 tooltip（默认开启） */
    showTooltip?: boolean
  }>(),
  {
    nodeKey: 'id',
    selectedNodeId: null,
    showMinimap: true,
    showZoomControls: true,
    gridSize: 20,
    nodeShape: 'rect',
    showTooltip: true,
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
  /** 节点点击（shift 表示是否为 Shift 多选点击，用于外壳维护点击顺序以定边方向） */
  nodeClick: [data: NodeData, shift: boolean]
  /** 选中节点 ID 更新（用于 v-model，仅单选时回填，多选时为 null） */
  'update:selectedNodeId': [id: string | null]
  /** 选择集合变化（节点 + 边 id 列表），用于外壳批量操作 UI */
  selectionChange: [payload: { nodes: string[]; edges: string[] }]
  /** 右键菜单请求（外壳渲染浮动菜单） */
  contextmenu: [payload: { x: number; y: number; itemType: 'node' | 'edge' | 'blank'; id: string | null }]
  /** 节点悬浮提示（外壳渲染 tooltip 展示备注 properties，离开节点时 payload 为 null） */
  nodeHover: [payload: { id: string; label: string; properties: Record<string, unknown>; x: number; y: number } | null]
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
  setGridVisible,
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

// ==================== 选择状态辅助 ====================

/** 从 G6 事件安全读取 shiftKey（兼容 originalEvent） */
function getShiftKey(evt: Record<string, unknown>): boolean {
  const e = evt as { shiftKey?: boolean; originalEvent?: { shiftKey?: boolean } }
  return Boolean(e.shiftKey || e.originalEvent?.shiftKey)
}

/** 清除所有节点/边的 selected 视觉态（不触发 emit） */
function clearSelectedStates(): void {
  const graph = graphInstance.value
  if (!graph) return
  graph.findAllByState('node', 'selected').forEach((n) => {
    graph.setItemState(n, 'selected', false)
  })
  graph.findAllByState('edge', 'selected').forEach((e) => {
    graph.setItemState(e, 'selected', false)
  })
}

/** 清除选中并向外壳同步（用于空白点击 / Esc / 删除后） */
function clearSelection(): void {
  clearSelectedStates()
  emit('update:selectedNodeId', null)
  emit('selectionChange', { nodes: [], edges: [] })
}

/**
 * 向外壳广播当前选择集合。
 * 单选节点 / 单选边时同步回填 update:selectedNodeId（供侧栏编辑），
 * 多选 / 混合选择时回填 null（由外壳批量工具栏接管）。
 */
function emitSelectionChange(): void {
  const graph = graphInstance.value
  if (!graph) return
  const nodeIds = graph.findAllByState('node', 'selected').map((n) => n.getID() as string)
  const edgeIds = graph.findAllByState('edge', 'selected').map((e) => e.getID() as string)
  emit('selectionChange', { nodes: nodeIds, edges: edgeIds })

  let singleId: string | null = null
  if (nodeIds.length === 1 && edgeIds.length === 0) singleId = nodeIds[0]
  else if (nodeIds.length === 0 && edgeIds.length === 1) singleId = edgeIds[0]
  emit('update:selectedNodeId', singleId)
}

// ==================== 初始化图实例 ====================

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
    const typedItem = item as unknown as { hasState: (s: string) => boolean; getID: () => string }

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

    emit('nodeClick', nodeData, getShiftKey(evt))

    // 编辑模式：处理多选（Shift 切换）与单选
    if (props.mode === 'edit') {
      if (getShiftKey(evt)) {
        // Shift+点击：在现有选择上切换该节点
        graph.setItemState(item, 'selected', !typedItem.hasState('selected'))
      } else {
        // 普通点击：清除其他选中再选当前
        clearSelectedStates()
        graph.setItemState(item, 'selected', true)
      }
      emitSelectionChange()
    } else {
      emit('update:selectedNodeId', nodeData.id)
    }
  })

  // 节点悬浮检测：用 mousemove + 碰撞检测（比 mouseenter/mouseleave 更可靠）
  // 命中节点 → 广播 tooltip 数据（外壳渲染）；移到空白/移出 → 广播 null 关闭 tooltip
  let hoverPending = false
  graph.on('mousemove', (evt: Record<string, unknown>) => {
    if (hoverPending) return
    hoverPending = true
    requestAnimationFrame(() => {
      hoverPending = false

      const mx = (evt.x as number) || 0
      const my = (evt.y as number) || 0

      // 找到鼠标下方的节点
      const nodes = graph.getNodes()
      const hovered = nodes.find((node: { getBBox: () => { minX: number; minY: number; maxX: number; maxY: number } }) => {
        const b = node.getBBox()
        return mx >= b.minX && mx <= b.maxX && my >= b.minY && my <= b.maxY
      })

      if (hovered) {
        // 编辑模式：高亮节点（显示锚点圆圈）
        if (props.mode === 'edit') {
          graph.findAllByState('node', 'hover').forEach((n: { getModel: () => Record<string, unknown> }) => {
            graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'hover', false)
          })
          graph.setItemState(hovered as unknown as Parameters<Graph['setItemState']>[0], 'hover', true)
        }
        // 悬浮 tooltip（受 showTooltip 开关控制）
        if (props.showTooltip) {
          const model = hovered.getModel() as Record<string, unknown>
          emit('nodeHover', {
            id: model.id as string,
            label: (model.label as string) || '',
            properties: (model.properties as Record<string, unknown>) || {},
            x: (evt.clientX as number) || 0,
            y: (evt.clientY as number) || 0,
          })
        }
      } else {
        if (props.mode === 'edit') {
          graph.findAllByState('node', 'hover').forEach((n: { getModel: () => Record<string, unknown> }) => {
            graph.setItemState(n as unknown as Parameters<Graph['setItemState']>[0], 'hover', false)
          })
        }
        // 未命中节点：关闭 tooltip（仅当开关开启时曾广播）
        if (props.showTooltip) {
          emit('nodeHover', null)
        }
      }
    })
  })

  // 清除所有选中状态（复用组件级 clearSelection：清除 G6 视觉态 + 父组件 selectedNodeId）
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

  // 边点击（编辑模式下选中边，支持 Shift 多选）
  if (props.mode === 'edit') {
    graph.on('edge:click', (evt) => {
      const { item } = evt
      if (!item) return
      const typedItem = item as unknown as { hasState: (s: string) => boolean }
      if (getShiftKey(evt)) {
        graph.setItemState(item, 'selected', !typedItem.hasState('selected'))
      } else {
        clearSelectedStates()
        graph.setItemState(item, 'selected', true)
      }
      emitSelectionChange()
    })
  }

  // 框选（brush-select）完成后，同步选择集合到外壳批量工具栏
  graph.on('nodeselectchange', () => {
    emitSelectionChange()
  })

  // 右键菜单：区分节点 / 边 / 空白，选中目标（若未选中则仅选中它）并广播屏幕坐标
  graph.on('contextmenu', (evt: Record<string, unknown>) => {
    if (props.mode !== 'edit') return
    const item = evt.item as
      | { getID: () => string; hasState: (s: string) => boolean; getType?: () => string }
      | undefined
    let itemType: 'node' | 'edge' | 'blank' = 'blank'
    let id: string | null = null
    if (item) {
      const t = item.getType?.()
      itemType = t === 'edge' ? 'edge' : 'node'
      id = item.getID()
      // 右键对象未选中时仅选中它；已选中则保留多选，便于整组删除
      if (!item.hasState('selected')) {
        clearSelectedStates()
        graph.setItemState(item as unknown as Parameters<Graph['setItemState']>[0], 'selected', true)
      }
      emitSelectionChange()
    }
    const clientX = (evt.clientX as number) || 0
    const clientY = (evt.clientY as number) || 0
    emit('contextmenu', { x: clientX, y: clientY, itemType, id })
  })

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
        // 统一走 addEdge：同方向不重复、反向则转双向箭头
        const newId = addEdge({ source: sourceNodeId, target: targetId, type: 'line', label: '' })
        if (newId) emit('dataChange', operationQueue.value, currentVersion.value)
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
 * 全选（节点 + 边）
 */
function selectAll(): void {
  const graph = graphInstance.value
  if (!graph) return

  graph.getNodes().forEach((node) => graph.setItemState(node, 'selected', true))
  graph.getEdges().forEach((edge) => graph.setItemState(edge, 'selected', true))
  emitSelectionChange()
}

/**
 * 构建批量删除命令：
 * - 被删节点连带的关联边由 DeleteNodeCommand 负责清理，因此这些边不单独生成命令；
 * - 仅当边的两个端点都“不被删除”时，才生成独立的 DeleteEdgeCommand，避免重复删除。
 * 返回的命令数组由调用方聚合为 CompositeCommand，保证一次撤销还原全部。
 */
function buildDeleteCommands(nodeIds: string[], edgeIds: string[]): Array<
  DeleteNodeCommand | DeleteEdgeCommand
> {
  const graph = graphInstance.value
  if (!graph) return []
  const nodeIdSet = new Set(nodeIds)
  const cmds: Array<DeleteNodeCommand | DeleteEdgeCommand> = []

  edgeIds.forEach((id) => {
    const edgeItem = graph.findById(id)
    if (!edgeItem) return
    const m = edgeItem.getModel() as Record<string, unknown>
    const src = m.source as string
    const tgt = m.target as string
    if (!nodeIdSet.has(src) && !nodeIdSet.has(tgt)) {
      cmds.push(new DeleteEdgeCommand(graph, id))
    }
  })

  nodeIds.forEach((id) => {
    cmds.push(new DeleteNodeCommand(graph, id))
  })

  return cmds
}

/**
 * 删除选中项（节点 + 边），聚合为单条组合命令，一次撤销还原全部
 */
function deleteSelected(): void {
  const graph = graphInstance.value
  if (!graph) return

  const nodeIds = graph.findAllByState('node', 'selected').map((n) => n.getID() as string)
  const edgeIds = graph.findAllByState('edge', 'selected').map((e) => e.getID() as string)
  const cmds = buildDeleteCommands(nodeIds, edgeIds)
  if (cmds.length === 0) return

  execute(new CompositeCommand(cmds, '批量删除选中项'))
  clearSelection()
  emit('dataChange', operationQueue.value, currentVersion.value)
}

/**
 * 按 id 列表批量删除（节点与边混合），一次撤销还原全部
 */
function deleteItems(ids: string[]): void {
  const graph = graphInstance.value
  if (!graph || ids.length === 0) return

  const nodeIds: string[] = []
  const edgeIds: string[] = []
  ids.forEach((id) => {
    const item = graph.findById(id)
    if (!item) return
    const t = (item as { getType?: () => string }).getType?.()
    if (t === 'edge') edgeIds.push(id)
    else nodeIds.push(id)
  })

  const cmds = buildDeleteCommands(nodeIds, edgeIds)
  if (cmds.length === 0) return

  execute(new CompositeCommand(cmds, '批量删除'))
  clearSelection()
  emit('dataChange', operationQueue.value, currentVersion.value)
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
    type: data.type || (props.nodeShape === 'circle' ? CIRCLE_NODE_TYPE : RECT_NODE_TYPE),
  }

  const command = new AddNodeCommand(graph, nodeData)
  execute(command)
  isEmpty.value = false
  return nodeData.id
}

/**
 * 添加边
 * - 同方向边已存在：不重复添加（两点之间同方向只允许一条）
 * - 反向边已存在：不新增，而是把已有反向边改为双向箭头（加 startArrow）
 * - 否则：新增一条边
 * 返回：新边 id / 已有同方向边 id / 转为双向的反向边 id；若没有任何改动（同方向已存在且无转换）返回 ''
 */
function addEdge(data: Partial<EdgeData> & { source: string; target: string }): string {
  const graph = graphInstance.value
  if (!graph) return ''

  const source = data.source
  const target = data.target

  const edges = getCurrentData().edges

  // 同方向边已存在 → 不重复添加（无任何改动）
  const sameDir = edges.find((e) => e.source === source && e.target === target)
  if (sameDir) return ''

  // 反向边已存在 → 改为双向箭头（加 startArrow），不新增边
  const reverse = edges.find((e) => e.source === target && e.target === source)
  if (reverse) {
    const stroke = (reverse.style?.stroke as string) || DEFAULT_EDGE_STYLE.stroke
    const startArrow = { path: DEFAULT_EDGE_STYLE.endArrow.path as string, fill: stroke }
    updateEdge(reverse.id, { style: { ...(reverse.style || {}), startArrow } })
    return reverse.id
  }

  const edgeData: EdgeData = {
    id: data.id || generateId('edge'),
    source,
    target,
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
 * 批量更新多个节点的属性（如批量改色），聚合为单条组合命令，一次撤销
 * @param ids 节点 id 列表
 * @param data 需要更新的节点字段（如 { style: { fill: '#fff' } }）
 */
function updateNodes(ids: string[], data: Partial<NodeData>): void {
  const graph = graphInstance.value
  if (!graph || ids.length === 0) return

  const cmds = ids
    .map((id) => {
      const item = graph.findById(id)
      if (!item) return null
      const t = (item as { getType?: () => string }).getType?.()
      return t === 'edge' ? null : new UpdateNodeCommand(graph, id, data)
    })
    .filter((c): c is UpdateNodeCommand => c !== null)

  if (cmds.length === 0) return
  execute(new CompositeCommand(cmds, '批量更新节点'))
  emit('dataChange', operationQueue.value, currentVersion.value)
}

/**
 * 获取当前选中项（节点 + 边）的完整数据
 */
function getSelectedItems(): { nodes: NodeData[]; edges: EdgeData[] } {
  const graph = graphInstance.value
  if (!graph) return { nodes: [], edges: [] }

  const nodes: NodeData[] = graph.findAllByState('node', 'selected').map((n) => {
    const m = n.getModel() as Record<string, unknown>
    return {
      id: m.id as string,
      label: (m.label as string) || '',
      x: m.x as number | undefined,
      y: m.y as number | undefined,
      fx: (m.fx ?? m.x) as number | undefined,
      fy: (m.fy ?? m.y) as number | undefined,
      properties: (m.properties as Record<string, unknown>) || {},
      type: (m.type as string) || RECT_NODE_TYPE,
      style: (m.style as Record<string, unknown>) || {},
    }
  })

  const edges: EdgeData[] = graph.findAllByState('edge', 'selected').map((e) => {
    const m = e.getModel() as Record<string, unknown>
    return {
      id: m.id as string,
      source: m.source as string,
      target: m.target as string,
      type: ((m.type as string) || 'line') as EdgeData['type'],
      label: (m.label as string) || '',
      style: (m.style as Record<string, unknown>) || {},
    }
  })

  return { nodes, edges }
}

/**
 * 在画布客户端坐标处新建节点（用于右键菜单“在此新建节点”）
 * 将屏幕坐标转换为图坐标后交给 addNode（自动吸附网格、跟随当前形状）
 * @param clientX 鼠标事件 clientX
 * @param clientY 鼠标事件 clientY
 * @returns 新建节点 id
 */
function addNodeAtClient(clientX: number, clientY: number): string {
  const graph = graphInstance.value
  if (!graph) return ''

  const container = graph.get('container') as HTMLElement
  const rect = container.getBoundingClientRect()
  const canvasX = clientX - rect.left
  const canvasY = clientY - rect.top
  const point = graph.getPointByCanvas(canvasX, canvasY)

  const id = addNode({ x: point.x, y: point.y })
  emit('dataChange', operationQueue.value, currentVersion.value)
  return id
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
  emit('selectionChange', { nodes: [], edges: [] })
  emit('update:selectedNodeId', null)
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
 * 切换画布上所有边的类型（直线 / 二次贝塞尔 / 三次贝塞尔）
 * 将本次真正发生变化的边聚合为一条组合命令：
 * - 一次撤销即可还原全部边类型
 * - 组合命令的 toOperation 展开为每条边的 update 操作，保证同步/持久化覆盖所有变更
 * @param type 目标边类型
 */
function setEdgeType(type: EdgeType): void {
  const graph = graphInstance.value
  if (!graph) return

  const subCommands: UpdateEdgeCommand[] = []
  graph.getEdges().forEach((edge) => {
    const model = edge.getModel() as { id?: string; type?: EdgeType }
    // 仅对类型真正发生变化的边生成子命令，避免产生无意义的空操作
    if (model.id && model.type !== type) {
      subCommands.push(new UpdateEdgeCommand(graph, model.id, { type }))
    }
  })

  if (subCommands.length === 0) return
  const command = new CompositeCommand(subCommands, `批量切换边类型: ${type}`)
  execute(command)
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

/**
 * 清除路径高亮（节点 + 边）
 */
function clearPath(): void {
  const graph = graphInstance.value
  if (!graph) return
  graph.getNodes().forEach((n) => graph.setItemState(n, 'path-highlight', false))
  graph.getEdges().forEach((e) => graph.setItemState(e, 'path-highlight', false))
}

/**
 * 最短路径搜索：输入起止节点，返回并高亮最短路径上的所有节点与连线
 * 使用自建 BFS（无额外依赖），按无向图求最短跳数路径
 */
function findPath(startId: string, endId: string): { found: boolean; length: number; nodeIds: string[]; edgeIds: string[] } {
  const graph = graphInstance.value
  const empty = { found: false, length: 0, nodeIds: [] as string[], edgeIds: [] as string[] }
  if (!graph || !startId || !endId) return empty

  // 先清除上一次路径高亮
  clearPath()

  // 起点终点相同：0 跳，仅高亮自身
  if (startId === endId) {
    const item = graph.findById(startId)
    if (item) graph.setItemState(item, 'path-highlight', true)
    return { found: true, length: 0, nodeIds: [startId], edgeIds: [] }
  }

  // 先清除上一次路径高亮
  clearPath()

  // 构建无向邻接表 + 边映射
  const adj = new Map<string, string[]>()
  const edgeMap = new Map<string, Item>()
  graph.getEdges().forEach((e) => {
    const src = e.getSource().getID() as string
    const tgt = e.getTarget().getID() as string
    if (!adj.has(src)) adj.set(src, [])
    if (!adj.has(tgt)) adj.set(tgt, [])
    adj.get(src)!.push(tgt)
    adj.get(tgt)!.push(src)
    edgeMap.set(`${src}->${tgt}`, e)
    edgeMap.set(`${tgt}->${src}`, e)
  })

  if (!adj.has(startId) || !adj.has(endId)) return empty

  // BFS 找最短路径，记录前驱
  const prev = new Map<string, string>()
  const visited = new Set<string>([startId])
  const queue: string[] = [startId]
  let found = false
  while (queue.length > 0) {
    const cur = queue.shift() as string
    if (cur === endId) {
      found = true
      break
    }
    const neighbors = adj.get(cur) || []
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb)
        prev.set(nb, cur)
        queue.push(nb)
      }
    }
  }

  if (!found) return empty

  // 回溯路径节点
  const nodeIds: string[] = []
  let step: string | undefined = endId
  while (step !== undefined) {
    nodeIds.unshift(step)
    if (step === startId) break
    step = prev.get(step)
  }

  // 高亮路径节点
  nodeIds.forEach((id) => {
    const item = graph.findById(id)
    if (item) graph.setItemState(item, 'path-highlight', true)
  })

  // 高亮路径连线
  const edgeIds: string[] = []
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = nodeIds[i]
    const b = nodeIds[i + 1]
    const edge = edgeMap.get(`${a}->${b}`)
    if (edge) {
      graph.setItemState(edge, 'path-highlight', true)
      edgeIds.push(edge.getID() as string)
    }
  }

  // 居中到起点（保证路径可见）
  const startItem = graph.findById(startId)
  if (startItem) graph.focusItem(startItem, true)

  return { found: true, length: nodeIds.length - 1, nodeIds, edgeIds }
}

/**
 * 克隆节点（带偏移），新节点固定位置避免布局回弹
 * @param sourceId 源节点 id
 * @param offset 新节点相对源节点的像素偏移
 * @returns 新节点 id
 */
function cloneNode(sourceId: string, offset = 40): string {
  const graph = graphInstance.value
  if (!graph) return ''
  const newId = generateId('node')
  execute(new CloneNodeCommand(graph, sourceId, newId, offset))
  isEmpty.value = false
  emit('dataChange', operationQueue.value, currentVersion.value)
  return newId
}

/**
 * 反转边方向（交换 source / target）
 */
function reverseEdge(id: string): void {
  const graph = graphInstance.value
  if (!graph) return
  execute(new ReverseEdgeCommand(graph, id))
  emit('dataChange', operationQueue.value, currentVersion.value)
}

/**
 * 固定节点：写入 fx/fy 锁定到当前坐标
 */
function pinNode(id: string): void {
  const graph = graphInstance.value
  if (!graph) return
  const item = graph.findById(id)
  if (!item) return
  const m = item.getModel() as { x?: number; y?: number }
  updateNode(id, { fx: m.x, fy: m.y })
}

/**
 * 解除固定：清除 fx/fy，使节点可受力导向影响
 */
function unpinNode(id: string): void {
  const graph = graphInstance.value
  if (!graph) return
  const item = graph.findById(id)
  if (!item) return
  execute(new UpdateNodeCommand(graph, id, { fx: undefined, fy: undefined }))
  emit('dataChange', operationQueue.value, currentVersion.value)
}

/**
 * 批量更新多条边（如切换类型），聚合为单条组合命令，一次撤销
 */
function updateEdges(ids: string[], data: Partial<EdgeData>): void {
  const graph = graphInstance.value
  if (!graph || ids.length === 0) return
  const cmds = ids
    .map((id) => {
      const item = graph.findById(id)
      if (!item) return null
      const t = (item as { getType?: () => string }).getType?.()
      return t === 'node' ? null : new UpdateEdgeCommand(graph, id, data)
    })
    .filter((c): c is UpdateEdgeCommand => c !== null)
  if (cmds.length === 0) return
  execute(new CompositeCommand(cmds, '批量更新边'))
  emit('dataChange', operationQueue.value, currentVersion.value)
}

/**
 * 切换网格背景显示
 */
function toggleGrid(): void {
  const graph = graphInstance.value
  if (!graph) return
  const container = graph.get('container') as HTMLElement
  const has = !!container.querySelector('.g6-grid-overlay')
  setGridVisible(!has)
}

defineExpose({
  updateNode,
  updateEdge,
  deleteNode,
  deleteItems,
  updateNodes,
  addNode,
  addNodeAtClient,
  addEdge,
  getAllData,
  getSelectedItems,
  clearSelection,
  exportImage: exportImageExpose,
  fitView: fitViewExpose,
  undo,
  redo,
  clear,
  refresh,
  forceLayout: forceLayoutExpose,
  setNodeShape,
  setEdgeType,
  searchNode,
  findPath,
  clearPath,
  cloneNode,
  reverseEdge,
  pinNode,
  unpinNode,
  selectAll,
  updateEdges,
  toggleGrid,
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
