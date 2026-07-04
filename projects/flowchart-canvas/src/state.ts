// state.ts — 全局状态管理

import type { FlowNode, FlowEdge, Viewport, InteractionState, Point, TempConnection, NodeShape, AnchorDir } from './types'
import { DEFAULT_NODE_SIZE, NODE_ID_PREFIX, EDGE_ID_PREFIX, MIN_SCALE, MAX_SCALE, GRID_SIZE } from './config'
import { uid, clamp, snapToGridValue } from './utils/geometry'

// --- localStorage 持久化 ---
const STORAGE_KEY = 'flowchart-canvas-state'

export interface StoredState {
  version: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: Viewport
  snapToGrid: boolean
}

/** 保存当前状态到 localStorage */
export function saveState() {
  try {
    const data: StoredState = {
      version: '1.0.0',
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      viewport: { ...viewport },
      snapToGrid,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // localStorage 满或不可用时静默失败
    console.warn('保存画布状态失败:', e)
  }
}

/** 从 localStorage 恢复状态，返回是否恢复成功 */
export function loadState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data: StoredState = JSON.parse(raw)
    if (!data.nodes || !Array.isArray(data.nodes)) return false

    // 清空当前状态
    nodes.clear()
    edges.clear()
    selectedIds.clear()

    // 恢复节点和连线
    for (const node of data.nodes) nodes.set(node.id, node)
    for (const edge of data.edges) edges.set(edge.id, edge)

    // 恢复视口
    if (data.viewport) {
      viewport.scale = clamp(data.viewport.scale ?? 1, MIN_SCALE, MAX_SCALE)
      viewport.offsetX = data.viewport.offsetX ?? 0
      viewport.offsetY = data.viewport.offsetY ?? 0
    }

    // 恢复设置
    if (typeof data.snapToGrid === 'boolean') {
      snapToGrid = data.snapToGrid
    }

    return true
  } catch (e) {
    console.warn('恢复画布状态失败:', e)
    return false
  }
}

/** 清除存档 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY)
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
