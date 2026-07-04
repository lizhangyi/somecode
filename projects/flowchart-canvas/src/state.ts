// state.ts — 全局状态管理

import type { FlowNode, FlowEdge, Viewport, InteractionState, Point, TempConnection, NodeShape, AnchorDir, LineType, ResizeHandle } from './types'
import { DEFAULT_NODE_SIZE, NODE_ID_PREFIX, EDGE_ID_PREFIX, MIN_SCALE, MAX_SCALE, GRID_SIZE, applyTheme } from './config'
import { uid, clamp, snapToGridValue } from './utils/geometry'

// --- 多画布 localStorage 持久化 ---
const STORE_KEY = 'flowchart-canvas-store'
const OLD_STORAGE_KEY = 'flowchart-canvas-state' // 旧版单画布 key，用于迁移

export interface CanvasMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

interface CanvasData extends CanvasMeta {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: Viewport
}

interface StoreData {
  canvases: CanvasData[]
  activeId: string | null
  settings: {
    snapToGrid: boolean
    defaultLineType: LineType
    colorMode: ColorMode
  }
}

function defaultStore(): StoreData {
  return { canvases: [], activeId: null, settings: { snapToGrid: true, defaultLineType: 'bezier', colorMode: 'auto' } }
}

/** 读取 store（含旧格式自动迁移） */
function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.canvases)) return parsed
    }

    // 迁移旧版单画布格式
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY)
    if (oldRaw) {
      const old = JSON.parse(oldRaw)
      if (old && old.nodes) {
        const id = uid('canvas-')
        const now = Date.now()
        const store: StoreData = {
          canvases: [{
            id, name: '未命名画布', createdAt: now, updatedAt: now,
            nodes: old.nodes, edges: old.edges || [],
            viewport: old.viewport || { scale: 1, offsetX: 0, offsetY: 0 },
          }],
          activeId: id,
          settings: {
            snapToGrid: old.snapToGrid ?? true,
            defaultLineType: old.defaultLineType ?? 'bezier',
            colorMode: old.colorMode ?? 'auto',
          },
        }
        saveStore(store)
        localStorage.removeItem(OLD_STORAGE_KEY)
        return store
      }
    }
    return defaultStore()
  } catch {
    return defaultStore()
  }
}

function saveStore(store: StoreData) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch (e) {
    console.warn('保存画布存储失败:', e)
  }
}

/** 获取画布列表（按更新时间降序） */
export function getCanvasList(): CanvasMeta[] {
  return loadStore().canvases
    .map(c => ({ id: c.id, name: c.name, createdAt: c.createdAt, updatedAt: c.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 获取当前激活画布 ID */
export function getActiveCanvasId(): string | null {
  return loadStore().activeId
}

/** 获取当前激活画布名称 */
export function getActiveCanvasName(): string {
  const store = loadStore()
  return store.canvases.find(c => c.id === store.activeId)?.name || '未命名画布'
}

/** 将内存中的节点/连线/视口写入 store 中当前激活的画布 */
export function saveState() {
  const store = loadStore()
  if (!store.activeId) {
    // 无激活画布，自动创建一个
    const id = uid('canvas-')
    const now = Date.now()
    store.canvases.push({
      id, name: '未命名画布', createdAt: now, updatedAt: now,
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      viewport: { ...viewport },
    })
    store.activeId = id
  } else {
    const canvas = store.canvases.find(c => c.id === store.activeId)
    if (canvas) {
      canvas.nodes = Array.from(nodes.values())
      canvas.edges = Array.from(edges.values())
      canvas.viewport = { ...viewport }
      canvas.updatedAt = Date.now()
    }
  }
  // 同步全局设置
  store.settings.snapToGrid = snapToGrid
  store.settings.defaultLineType = defaultLineType
  store.settings.colorMode = colorMode
  saveStore(store)
}

/** 从 store 恢复状态到内存（加载激活画布 + 全局设置） */
export function loadState(): boolean {
  const store = loadStore()

  // 恢复全局设置
  snapToGrid = store.settings.snapToGrid ?? true
  defaultLineType = store.settings.defaultLineType ?? 'bezier'
  if (store.settings.colorMode) setColorMode(store.settings.colorMode)

  if (!store.activeId) return false
  const canvas = store.canvases.find(c => c.id === store.activeId)
  if (!canvas || !canvas.nodes) return false

  nodes.clear()
  edges.clear()
  selectedIds.clear()
  for (const node of canvas.nodes) nodes.set(node.id, node)
  for (const edge of canvas.edges) edges.set(edge.id, edge)
  viewport.scale = clamp(canvas.viewport.scale ?? 1, MIN_SCALE, MAX_SCALE)
  viewport.offsetX = canvas.viewport.offsetX ?? 0
  viewport.offsetY = canvas.viewport.offsetY ?? 0
  return true
}

/** 新建画布：保存当前 → 创建空画布 → 切换为激活 */
export function createCanvas(name: string): string {
  saveState()
  const store = loadStore()
  const id = uid('canvas-')
  const now = Date.now()
  store.canvases.push({
    id, name: name || '未命名画布', createdAt: now, updatedAt: now,
    nodes: [], edges: [], viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  })
  store.activeId = id
  saveStore(store)

  nodes.clear()
  edges.clear()
  selectedIds.clear()
  resetViewport()
  return id
}

/** 切换到指定画布：保存当前 → 加载目标画布到内存 */
export function switchCanvas(id: string) {
  saveState()
  const store = loadStore()
  const canvas = store.canvases.find(c => c.id === id)
  if (!canvas) return
  store.activeId = id
  saveStore(store)

  nodes.clear()
  edges.clear()
  selectedIds.clear()
  for (const node of canvas.nodes) nodes.set(node.id, node)
  for (const edge of canvas.edges) edges.set(edge.id, edge)
  viewport.scale = clamp(canvas.viewport.scale ?? 1, MIN_SCALE, MAX_SCALE)
  viewport.offsetX = canvas.viewport.offsetX ?? 0
  viewport.offsetY = canvas.viewport.offsetY ?? 0
  markDirty()
}

/** 重命名当前激活画布 */
export function renameCanvas(name: string) {
  const store = loadStore()
  const canvas = store.canvases.find(c => c.id === store.activeId)
  if (canvas) {
    canvas.name = name || '未命名画布'
    canvas.updatedAt = Date.now()
    saveStore(store)
  }
}

/** 删除指定画布，若删除的是当前激活画布则自动切换到最近的画布 */
export function deleteCanvas(id: string) {
  const store = loadStore()
  store.canvases = store.canvases.filter(c => c.id !== id)

  if (store.activeId === id) {
    const remaining = [...store.canvases].sort((a, b) => b.updatedAt - a.updatedAt)
    if (remaining.length > 0) {
      store.activeId = remaining[0].id
      const canvas = remaining[0]
      nodes.clear()
      edges.clear()
      selectedIds.clear()
      for (const node of canvas.nodes) nodes.set(node.id, node)
      for (const edge of canvas.edges) edges.set(edge.id, edge)
      viewport.scale = clamp(canvas.viewport.scale ?? 1, MIN_SCALE, MAX_SCALE)
      viewport.offsetX = canvas.viewport.offsetX ?? 0
      viewport.offsetY = canvas.viewport.offsetY ?? 0
    } else {
      // 没有画布了，创建一个空的
      const newId = uid('canvas-')
      const now = Date.now()
      store.canvases.push({
        id: newId, name: '未命名画布', createdAt: now, updatedAt: now,
        nodes: [], edges: [], viewport: { scale: 1, offsetX: 0, offsetY: 0 },
      })
      store.activeId = newId
      nodes.clear()
      edges.clear()
      selectedIds.clear()
      resetViewport()
    }
  }
  saveStore(store)
  markDirty()
}

/** 清除所有存档（重置） */
export function clearState() {
  localStorage.removeItem(STORE_KEY)
  localStorage.removeItem(OLD_STORAGE_KEY)
}


// --- 核心状态 ---
export const nodes = new Map<string, FlowNode>()
export const edges = new Map<string, FlowEdge>()
export const viewport: Viewport = { scale: 1, offsetX: 0, offsetY: 0 }
export const selectedIds = new Set<string>()

// --- 交互状态 ---
export let interactionState: InteractionState = 'idle'
export let tempConnection: TempConnection | null = null
export let hoveredAnchorNodeId: string | null = null
export let hoveredAnchorDir: AnchorDir | null = null

// --- 重连状态 ---
export let reconnectEdgeId: string | null = null
export let reconnectEnd: 'source' | 'target' | null = null
export let hoveredEdgeEnd: { edgeId: string; end: 'source' | 'target' } | null = null

// --- Resize 状态 ---
export let resizeNodeId: string | null = null
export let resizeHandle: ResizeHandle | null = null
export let resizeStartCanvas: Point = { x: 0, y: 0 }
export let resizeStartNode: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 }
export let hoveredResizeHandle: { nodeId: string; handle: ResizeHandle } | null = null

// --- 剪贴板 ---
export let clipboardNodes: FlowNode[] = []
export let clipboardEdges: FlowEdge[] = []

export function setClipboard(ns: FlowNode[], es: FlowEdge[]) {
  clipboardNodes = ns.map(n => ({ ...n }))
  clipboardEdges = es.map(e => ({ ...e }))
}

/** 获取剪贴板内容（供 contextmenu 使用） */
export function getClipboard(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return { nodes: clipboardNodes, edges: clipboardEdges }
}

// --- 拖拽状态 ---
export let dragNodeId: string | null = null
export let dragStartCanvas: Point = { x: 0, y: 0 }
export let dragNodeStartPos: Point = { x: 0, y: 0 }

// --- 平移状态 ---
export let panStartScreen: Point = { x: 0, y: 0 }
export let panStartOffset: Point = { x: 0, y: 0 }

// --- 框选状态 ---
export let boxSelectStart: Point = { x: 0, y: 0 }
export let boxSelectEnd: Point = { x: 0, y: 0 }

// --- 对齐模式 ---
export let snapToGrid = true

// --- 默认连线类型 ---
export let defaultLineType: LineType = 'bezier'

/** 切换默认连线类型 */
export function toggleDefaultLineType() {
  defaultLineType = defaultLineType === 'bezier' ? 'orthogonal' : 'bezier'
  markDirty()
}

/** 设置默认连线类型 */
export function setDefaultLineType(type: LineType) {
  defaultLineType = type
  markDirty()
}

// --- 颜色模式 ---
export type ColorMode = 'dark' | 'light' | 'auto'
export let colorMode: ColorMode = 'auto'

/** 解析颜色模式为实际主题（auto → 根据系统偏好） */
export function getResolvedTheme(mode: ColorMode): 'dark' | 'light' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

/** 应用颜色模式（解析 auto → 实际主题） */
export function setColorMode(mode: ColorMode) {
  colorMode = mode
  const resolved = getResolvedTheme(mode)
  applyTheme(resolved)
  document.documentElement.setAttribute('data-theme', resolved)
  markDirty()
}

/** 对齐到网格（如果 snapToGrid 开启） */
export function applySnap(value: number): number {
  return snapToGrid ? snapToGridValue(value, GRID_SIZE) : value
}

/** 切换网格对齐模式 */
export function toggleSnapToGrid() {
  snapToGrid = !snapToGrid
  markDirty()
}

// --- 渲染控制 ---
let dirty = true
let rafId: number | null = null

/** 标记需要重绘 */
export function markDirty() {
  dirty = true
}

/** 是否需要重绘 */
export function isDirty(): boolean {
  return dirty
}

/** 清除脏标记 */
export function clearDirty() {
  dirty = false
}

// --- 状态修改器 ---

export function setInteractionState(s: InteractionState) {
  interactionState = s
  markDirty()
}

export function setTempConnection(tc: TempConnection | null) {
  tempConnection = tc
  markDirty()
}

export function setHoveredAnchor(nodeId: string | null, dir: AnchorDir | null) {
  hoveredAnchorNodeId = nodeId
  hoveredAnchorDir = dir
  markDirty()
}

export function setReconnect(edgeId: string | null, end: 'source' | 'target' | null) {
  reconnectEdgeId = edgeId
  reconnectEnd = end
  markDirty()
}

export function setHoveredEdgeEnd(edgeId: string | null, end: 'source' | 'target' | null) {
  hoveredEdgeEnd = (edgeId && end) ? { edgeId, end } : null
  markDirty()
}

export function setResize(nodeId: string | null, handle: ResizeHandle | null, startCanvas?: Point, startNode?: { x: number; y: number; width: number; height: number }) {
  resizeNodeId = nodeId
  resizeHandle = handle
  if (startCanvas) resizeStartCanvas = startCanvas
  if (startNode) resizeStartNode = startNode
  markDirty()
}

export function setHoveredResizeHandle(nodeId: string | null, handle: ResizeHandle | null) {
  hoveredResizeHandle = (nodeId && handle) ? { nodeId, handle } : null
  markDirty()
}

export function setDragNode(id: string | null, startCanvas: Point, startPos: Point) {
  dragNodeId = id
  dragStartCanvas = startCanvas
  dragNodeStartPos = startPos
}

export function setPanStart(screen: Point) {
  panStartScreen = screen
  panStartOffset = { x: viewport.offsetX, y: viewport.offsetY }
}

export function setBoxSelect(start: Point, end?: Point) {
  boxSelectStart = start
  boxSelectEnd = end || start
  markDirty()
}

// --- 节点操作 ---

export function addNode(shape: NodeShape, x: number, y: number, text?: string): FlowNode {
  const size = DEFAULT_NODE_SIZE[shape]
  const node: FlowNode = {
    id: uid(NODE_ID_PREFIX),
    shape,
    x,
    y,
    width: size.width,
    height: size.height,
    text: text || '',
  }
  nodes.set(node.id, node)
  markDirty()
  return node
}

export function removeNode(id: string) {
  nodes.delete(id)
  // 同时删除关联的边
  for (const [eid, edge] of edges) {
    if (edge.sourceId === id || edge.targetId === id) {
      edges.delete(eid)
    }
  }
  selectedIds.delete(id)
  markDirty()
}

export function updateNode(id: string, updates: Partial<FlowNode>) {
  const node = nodes.get(id)
  if (!node) return
  Object.assign(node, updates)
  markDirty()
}

export function getNode(id: string): FlowNode | undefined {
  return nodes.get(id)
}

// --- 连线操作 ---

export function addEdge(
  sourceId: string,
  sourceAnchor: AnchorDir,
  targetId: string,
  targetAnchor: AnchorDir,
  label?: string
): FlowEdge | null {
  if (sourceId === targetId) return null
  // 检查是否已存在相同连线
  for (const edge of edges.values()) {
    if (edge.sourceId === sourceId && edge.targetId === targetId &&
        edge.sourceAnchor === sourceAnchor && edge.targetAnchor === targetAnchor) {
      return null
    }
  }
  const edge: FlowEdge = {
    id: uid(EDGE_ID_PREFIX),
    sourceId,
    sourceAnchor,
    targetId,
    targetAnchor,
    label,
  }
  edges.set(edge.id, edge)
  markDirty()
  return edge
}

export function removeEdge(id: string) {
  edges.delete(id)
  selectedIds.delete(id)
  markDirty()
}

export function getEdge(id: string): FlowEdge | undefined {
  return edges.get(id)
}

// --- 选中操作 ---

export function select(id: string) {
  selectedIds.clear()
  selectedIds.add(id)
  markDirty()
}

export function selectAdd(id: string) {
  selectedIds.add(id)
  markDirty()
}

export function selectNone() {
  selectedIds.clear()
  markDirty()
}

export function isSelected(id: string): boolean {
  return selectedIds.has(id)
}

export function getSelectedNodes(): FlowNode[] {
  const result: FlowNode[] = []
  for (const id of selectedIds) {
    const node = nodes.get(id)
    if (node) result.push(node)
  }
  return result
}

export function getSelectedEdges(): FlowEdge[] {
  const result: FlowEdge[] = []
  for (const id of selectedIds) {
    const edge = edges.get(id)
    if (edge) result.push(edge)
  }
  return result
}

// --- 视口操作 ---

export function setScale(scale: number, centerScreen?: Point) {
  const newScale = clamp(scale, MIN_SCALE, MAX_SCALE)
  if (centerScreen) {
    // 以屏幕坐标为中心缩放
    const canvasX = (centerScreen.x - viewport.offsetX) / viewport.scale
    const canvasY = (centerScreen.y - viewport.offsetY) / viewport.scale
    viewport.scale = newScale
    viewport.offsetX = centerScreen.x - canvasX * newScale
    viewport.offsetY = centerScreen.y - canvasY * newScale
  } else {
    viewport.scale = newScale
  }
  markDirty()
}

export function setOffset(x: number, y: number) {
  viewport.offsetX = x
  viewport.offsetY = y
  markDirty()
}

export function resetViewport() {
  viewport.scale = 1
  viewport.offsetX = 0
  viewport.offsetY = 0
  markDirty()
}

// --- 渲染调度 ---

export function scheduleRender(renderFn: () => void) {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (isDirty()) {
      clearDirty()
      renderFn()
    }
  })
}

/** 强制下一帧渲染（用于拖拽等连续场景） */
export function forceRender(renderFn: () => void) {
  markDirty()
  scheduleRender(renderFn)
}
