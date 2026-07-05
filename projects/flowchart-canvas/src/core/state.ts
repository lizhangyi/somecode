// core/state.ts — 实例状态类（替代全局 state 模块）

import type {
  FlowNode, FlowEdge, Viewport, InteractionState, Point, TempConnection,
  NodeShape, AnchorDir, LineType, ResizeHandle,
} from './types'
import { DEFAULT_NODE_SIZE, NODE_ID_PREFIX, EDGE_ID_PREFIX, GRID_SIZE } from '../geometry/config'
import { uid, clamp, snapToGridValue } from '../geometry/geometry'

/**
 * 流程图状态容器
 * 所有可变状态都存为实例字段，每个 Flowchart 实例拥有独立的 State
 */
export class FlowchartState {
  // --- 核心数据 ---
  readonly nodes = new Map<string, FlowNode>()
  readonly edges = new Map<string, FlowEdge>()
  viewport: Viewport = { scale: 1, offsetX: 0, offsetY: 0 }
  readonly selectedIds = new Set<string>()

  // --- 交互状态 ---
  interactionState: InteractionState = 'idle'
  tempConnection: TempConnection | null = null
  hoveredAnchorNodeId: string | null = null
  hoveredAnchorDir: AnchorDir | null = null

  // --- 重连状态 ---
  reconnectEdgeId: string | null = null
  reconnectEnd: 'source' | 'target' | null = null
  hoveredEdgeEnd: { edgeId: string; end: 'source' | 'target' } | null = null

  // --- Resize 状态 ---
  resizeNodeId: string | null = null
  resizeHandle: ResizeHandle | null = null
  resizeStartCanvas: Point = { x: 0, y: 0 }
  resizeStartNode: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 }
  hoveredResizeHandle: { nodeId: string; handle: ResizeHandle } | null = null

  // --- 剪贴板 ---
  clipboardNodes: FlowNode[] = []
  clipboardEdges: FlowEdge[] = []

  // --- 拖拽状态 ---
  dragNodeId: string | null = null
  dragStartCanvas: Point = { x: 0, y: 0 }
  dragNodeStartPos: Point = { x: 0, y: 0 }

  // --- 平移状态 ---
  panStartScreen: Point = { x: 0, y: 0 }
  panStartOffset: Point = { x: 0, y: 0 }

  // --- 框选状态 ---
  boxSelectStart: Point = { x: 0, y: 0 }
  boxSelectEnd: Point = { x: 0, y: 0 }

  // --- 设置 ---
  snapToGrid = true
  defaultLineType: LineType = 'bezier'

  // --- 缩放限制 ---
  minScale = 0.2
  maxScale = 3.0

  // --- 渲染控制 ---
  private _dirty = true

  // ============================================================
  //  渲染控制
  // ============================================================

  markDirty(): void { this._dirty = true }
  clearDirty(): void { this._dirty = false }
  isDirty(): boolean { return this._dirty }

  // ============================================================
  //  状态修改器
  // ============================================================

  setInteractionState(s: InteractionState): void {
    this.interactionState = s
    this.markDirty()
  }

  setTempConnection(tc: TempConnection | null): void {
    this.tempConnection = tc
    this.markDirty()
  }

  setHoveredAnchor(nodeId: string | null, dir: AnchorDir | null): void {
    this.hoveredAnchorNodeId = nodeId
    this.hoveredAnchorDir = dir
    this.markDirty()
  }

  setReconnect(edgeId: string | null, end: 'source' | 'target' | null): void {
    this.reconnectEdgeId = edgeId
    this.reconnectEnd = end
    this.markDirty()
  }

  setHoveredEdgeEnd(edgeId: string | null, end: 'source' | 'target' | null): void {
    this.hoveredEdgeEnd = (edgeId && end) ? { edgeId, end } : null
    this.markDirty()
  }

  setResize(
    nodeId: string | null, handle: ResizeHandle | null,
    startCanvas?: Point, startNode?: { x: number; y: number; width: number; height: number },
  ): void {
    this.resizeNodeId = nodeId
    this.resizeHandle = handle
    if (startCanvas) this.resizeStartCanvas = startCanvas
    if (startNode) this.resizeStartNode = startNode
    this.markDirty()
  }

  setHoveredResizeHandle(nodeId: string | null, handle: ResizeHandle | null): void {
    this.hoveredResizeHandle = (nodeId && handle) ? { nodeId, handle } : null
    this.markDirty()
  }

  setDragNode(id: string | null, startCanvas: Point, startPos: Point): void {
    this.dragNodeId = id
    this.dragStartCanvas = startCanvas
    this.dragNodeStartPos = startPos
  }

  setPanStart(screen: Point): void {
    this.panStartScreen = screen
    this.panStartOffset = { x: this.viewport.offsetX, y: this.viewport.offsetY }
  }

  setBoxSelect(start: Point, end?: Point): void {
    this.boxSelectStart = start
    this.boxSelectEnd = end || start
    this.markDirty()
  }

  setClipboard(ns: FlowNode[], es: FlowEdge[]): void {
    this.clipboardNodes = ns.map(n => ({ ...n }))
    this.clipboardEdges = es.map(e => ({ ...e }))
  }

  // ============================================================
  //  设置
  // ============================================================

  applySnap(value: number): number {
    return this.snapToGrid ? snapToGridValue(value, GRID_SIZE) : value
  }

  toggleSnapToGrid(): void {
    this.snapToGrid = !this.snapToGrid
    this.markDirty()
  }

  setDefaultLineType(type: LineType): void {
    this.defaultLineType = type
    this.markDirty()
  }

  toggleDefaultLineType(): void {
    this.defaultLineType = this.defaultLineType === 'bezier' ? 'orthogonal' : 'bezier'
    this.markDirty()
  }

  // ============================================================
  //  节点操作（低级，不带事件/历史）
  // ============================================================

  addNode(shape: NodeShape, x: number, y: number, text?: string): FlowNode {
    const size = DEFAULT_NODE_SIZE[shape]
    const node: FlowNode = {
      id: uid(NODE_ID_PREFIX),
      shape, x, y,
      width: size.width,
      height: size.height,
      text: text || '',
    }
    this.nodes.set(node.id, node)
    this.markDirty()
    return node
  }

  removeNode(id: string): void {
    this.nodes.delete(id)
    // 同时删除关联的边
    for (const [eid, edge] of this.edges) {
      if (edge.sourceId === id || edge.targetId === id) {
        this.edges.delete(eid)
      }
    }
    this.selectedIds.delete(id)
    this.markDirty()
  }

  updateNode(id: string, updates: Partial<FlowNode>): void {
    const node = this.nodes.get(id)
    if (!node) return
    Object.assign(node, updates)
    this.markDirty()
  }

  getNode(id: string): FlowNode | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): FlowNode[] {
    return Array.from(this.nodes.values())
  }

  // ============================================================
  //  连线操作（低级，不带事件/历史）
  // ============================================================

  addEdge(
    sourceId: string, sourceAnchor: AnchorDir,
    targetId: string, targetAnchor: AnchorDir,
    label?: string,
  ): FlowEdge | null {
    if (sourceId === targetId) return null
    // 检查是否已存在相同连线
    for (const edge of this.edges.values()) {
      if (edge.sourceId === sourceId && edge.targetId === targetId &&
          edge.sourceAnchor === sourceAnchor && edge.targetAnchor === targetAnchor) {
        return null
      }
    }
    const edge: FlowEdge = {
      id: uid(EDGE_ID_PREFIX),
      sourceId, sourceAnchor, targetId, targetAnchor, label,
    }
    this.edges.set(edge.id, edge)
    this.markDirty()
    return edge
  }

  removeEdge(id: string): void {
    this.edges.delete(id)
    this.selectedIds.delete(id)
    this.markDirty()
  }

  getEdge(id: string): FlowEdge | undefined {
    return this.edges.get(id)
  }

  getAllEdges(): FlowEdge[] {
    return Array.from(this.edges.values())
  }

  // ============================================================
  //  选中操作
  // ============================================================

  select(id: string): void {
    this.selectedIds.clear()
    this.selectedIds.add(id)
    this.markDirty()
  }

  selectAdd(id: string): void {
    this.selectedIds.add(id)
    this.markDirty()
  }

  selectNone(): void {
    this.selectedIds.clear()
    this.markDirty()
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id)
  }

  getSelectedNodes(): FlowNode[] {
    const result: FlowNode[] = []
    for (const id of this.selectedIds) {
      const node = this.nodes.get(id)
      if (node) result.push(node)
    }
    return result
  }

  getSelectedEdges(): FlowEdge[] {
    const result: FlowEdge[] = []
    for (const id of this.selectedIds) {
      const edge = this.edges.get(id)
      if (edge) result.push(edge)
    }
    return result
  }

  // ============================================================
  //  视口操作
  // ============================================================

  setScale(scale: number, centerScreen?: Point): void {
    const newScale = clamp(scale, this.minScale, this.maxScale)
    if (centerScreen) {
      const canvasX = (centerScreen.x - this.viewport.offsetX) / this.viewport.scale
      const canvasY = (centerScreen.y - this.viewport.offsetY) / this.viewport.scale
      this.viewport.scale = newScale
      this.viewport.offsetX = centerScreen.x - canvasX * newScale
      this.viewport.offsetY = centerScreen.y - canvasY * newScale
    } else {
      this.viewport.scale = newScale
    }
    this.markDirty()
  }

  setOffset(x: number, y: number): void {
    this.viewport.offsetX = x
    this.viewport.offsetY = y
    this.markDirty()
  }

  resetViewport(): void {
    this.viewport.scale = 1
    this.viewport.offsetX = 0
    this.viewport.offsetY = 0
    this.markDirty()
  }

  // ============================================================
  //  清空
  // ============================================================

  clear(): void {
    this.nodes.clear()
    this.edges.clear()
    this.selectedIds.clear()
    this.resetViewport()
    this.markDirty()
  }
}
