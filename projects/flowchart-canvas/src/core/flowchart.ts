// core/flowchart.ts — Flowchart 主类（公共 API 入口）

import type {
  FlowchartOptions, ThemeOption, ThemeColors, EventMap,
  FlowNode, FlowEdge, NodeShape, AnchorDir, LineType, Viewport, Point,
  FlowchartData, Command, ExportImageOptions, ExportBackground, ExportSVGOptions,
} from './types'
import { EventEmitter } from './event-emitter'
import { FlowchartState } from './state'
import { resolveTheme } from './theme'
import { CanvasHelper } from '../engine/canvas'
import { HistoryManager } from '../engine/history'
import { InteractionManager } from '../engine/interaction'
import { TextEditor } from '../engine/text-editor'
import { ContextMenu } from '../engine/context-menu'
import { render, renderForExport } from '../engine/renderer'
import { generateSVG } from '../engine/svg-exporter'
import {
  DEFAULT_NODE_SIZE, NODE_ID_PREFIX, EDGE_ID_PREFIX, DATA_VERSION,
  DEFAULT_MIN_SCALE, DEFAULT_MAX_SCALE, ZOOM_STEP,
} from '../geometry/config'
import { uid, clamp } from '../geometry/geometry'

/**
 * Flowchart — Headless 流程图库主入口
 *
 * 用法：
 *   const fc = new Flowchart(canvas, { theme: 'dark' })
 *   fc.addNode('rect', 100, 100, '开始')
 *   fc.on('selection:change', (e) => console.log(e.selectedIds))
 *
 * 库不提供任何预设 UI，所有操作通过实例 API 完成。
 */
export class Flowchart {
  // --- 内部模块（引擎模块通过 fc 访问） ---
  readonly state: FlowchartState
  readonly emitter: EventEmitter
  readonly canvasHelper: CanvasHelper
  readonly history: HistoryManager

  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _theme: ThemeColors
  private _options: Required<FlowchartOptions>
  private interaction: InteractionManager
  private textEditor: TextEditor | null = null
  private contextMenu: ContextMenu | null = null

  private rafId: number | null = null
  private destroyed = false

  constructor(canvas: HTMLCanvasElement, options?: FlowchartOptions) {
    this._canvas = canvas
    this._options = {
      theme: options?.theme ?? 'dark',
      snapToGrid: options?.snapToGrid ?? true,
      defaultLineType: options?.defaultLineType ?? 'bezier',
      contextMenu: options?.contextMenu ?? true,
      textEditor: options?.textEditor ?? true,
      minScale: options?.minScale ?? DEFAULT_MIN_SCALE,
      maxScale: options?.maxScale ?? DEFAULT_MAX_SCALE,
    }

    // 初始化各模块
    this.state = new FlowchartState()
    this.state.snapToGrid = this._options.snapToGrid
    this.state.defaultLineType = this._options.defaultLineType
    this.state.minScale = this._options.minScale
    this.state.maxScale = this._options.maxScale

    this.emitter = new EventEmitter()
    this.canvasHelper = new CanvasHelper(canvas)
    this._ctx = this.canvasHelper.ctx
    this._theme = resolveTheme(this._options.theme)

    this.history = new HistoryManager(() => {
      this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() })
    })

    // 可选功能
    if (this._options.textEditor) {
      this.textEditor = new TextEditor(this)
    }
    if (this._options.contextMenu) {
      this.contextMenu = new ContextMenu(this)
    }

    // 交互管理器（最后初始化，依赖以上模块）
    this.interaction = new InteractionManager(this)

    // 启动渲染
    this.markDirty()
    this.scheduleRender()
  }

  // ============================================================
  //  只读属性
  // ============================================================

  get canvas(): HTMLCanvasElement { return this._canvas }
  get ctx(): CanvasRenderingContext2D { return this._ctx }
  get theme(): ThemeColors { return this._theme }
  get options(): Required<FlowchartOptions> { return this._options }

  // ============================================================
  //  事件系统
  // ============================================================

  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void {
    return this.emitter.on(event, listener)
  }

  off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    this.emitter.off(event, listener)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload)
  }

  // ============================================================
  //  渲染控制
  // ============================================================

  markDirty(): void {
    this.state.markDirty()
  }

  forceRender(): void {
    this.state.markDirty()
    this.scheduleRender()
  }

  render(): void {
    render(this)
  }

  private scheduleRender(): void {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      if (this.state.isDirty()) {
        this.state.clearDirty()
        render(this)
      }
    })
  }

  // ============================================================
  //  主题
  // ============================================================

  setTheme(theme: ThemeOption): void {
    this._theme = resolveTheme(theme)
    this._options.theme = theme
    this.emit('theme:change', { theme: this._theme })
    this.forceRender()
  }

  // ============================================================
  //  节点操作（公共 API，带事件 + 历史）
  // ============================================================

  addNode(shape: NodeShape, x: number, y: number, text?: string): FlowNode {
    const node = this.state.addNode(shape, x, y, text)
    this.history.execute({
      type: 'add-node',
      do: () => { this.state.nodes.set(node.id, node); this.state.markDirty() },
      undo: () => { this.state.removeNode(node.id) },
    })
    this.emit('node:add', { node })
    this.notifyDirty()
    this.forceRender()
    return node
  }

  removeNode(id: string): void {
    const node = this.state.nodes.get(id)
    if (!node) return
    // 收集关联边
    const relatedEdges: FlowEdge[] = []
    for (const edge of this.state.edges.values()) {
      if (edge.sourceId === id || edge.targetId === id) {
        relatedEdges.push({ ...edge })
      }
    }
    this.history.execute({
      type: 'delete-node',
      do: () => { this.state.removeNode(id) },
      undo: () => {
        this.state.nodes.set(node.id, { ...node })
        for (const e of relatedEdges) this.state.edges.set(e.id, { ...e })
        this.state.markDirty()
      },
    })
    this.emit('node:remove', { id })
    this.notifyDirty()
    this.forceRender()
  }

  updateNode(id: string, updates: Partial<FlowNode>): void {
    const node = this.state.nodes.get(id)
    if (!node) return
    this.state.updateNode(id, updates)
    this.emit('node:update', { node: this.state.getNode(id)!, changes: updates })
    this.notifyDirty()
    this.forceRender()
  }

  getNode(id: string): FlowNode | undefined {
    return this.state.getNode(id)
  }

  getAllNodes(): FlowNode[] {
    return this.state.getAllNodes()
  }

  // ============================================================
  //  连线操作（公共 API，带事件 + 历史）
  // ============================================================

  addEdge(
    sourceId: string, sourceAnchor: AnchorDir,
    targetId: string, targetAnchor: AnchorDir,
    label?: string,
  ): FlowEdge | null {
    const edge = this.state.addEdge(sourceId, sourceAnchor, targetId, targetAnchor, label)
    if (!edge) return null
    this.history.execute({
      type: 'add-edge',
      do: () => { this.state.edges.set(edge.id, edge); this.state.markDirty() },
      undo: () => { this.state.edges.delete(edge.id); this.state.markDirty() },
    })
    this.emit('edge:add', { edge })
    this.notifyDirty()
    this.forceRender()
    return edge
  }

  removeEdge(id: string): void {
    const edge = this.state.edges.get(id)
    if (!edge) return
    this.history.execute({
      type: 'delete-edge',
      do: () => { this.state.edges.delete(id); this.state.selectedIds.delete(id); this.state.markDirty() },
      undo: () => { this.state.edges.set(edge.id, { ...edge }); this.state.markDirty() },
    })
    this.emit('edge:remove', { id })
    this.notifyDirty()
    this.forceRender()
  }

  getEdge(id: string): FlowEdge | undefined {
    return this.state.getEdge(id)
  }

  getAllEdges(): FlowEdge[] {
    return this.state.getAllEdges()
  }

  // ============================================================
  //  选中操作
  // ============================================================

  select(id: string): void {
    this.state.select(id)
    this.emitSelectionChange()
    this.forceRender()
  }

  selectAdd(id: string): void {
    this.state.selectAdd(id)
    this.emitSelectionChange()
    this.forceRender()
  }

  selectNone(): void {
    this.state.selectNone()
    this.emitSelectionChange()
    this.forceRender()
  }

  isSelected(id: string): boolean {
    return this.state.isSelected(id)
  }

  getSelectedNodes(): FlowNode[] {
    return this.state.getSelectedNodes()
  }

  getSelectedEdges(): FlowEdge[] {
    return this.state.getSelectedEdges()
  }

  /** 内部方法：通知选中变化 */
  emitSelectionChange(): void {
    this.emit('selection:change', {
      selectedIds: Array.from(this.state.selectedIds),
      selectedEdgeIds: Array.from(this.state.selectedEdgeIds),
    })
  }

  // ============================================================
  //  视口操作
  // ============================================================

  setScale(scale: number, centerScreen?: Point): void {
    this.state.setScale(scale, centerScreen)
    this.emitViewportChange()
    this.forceRender()
  }

  /** 放大（以画布中心为锚点） */
  zoomIn(): void {
    const { width, height } = this.canvasHelper.getCanvasSize()
    const newScale = clamp(
      this.state.viewport.scale + ZOOM_STEP,
      this._options.minScale,
      this._options.maxScale,
    )
    this.setScale(newScale, { x: width / 2, y: height / 2 })
  }

  /** 缩小（以画布中心为锚点） */
  zoomOut(): void {
    const { width, height } = this.canvasHelper.getCanvasSize()
    const newScale = clamp(
      this.state.viewport.scale - ZOOM_STEP,
      this._options.minScale,
      this._options.maxScale,
    )
    this.setScale(newScale, { x: width / 2, y: height / 2 })
  }

  /** 设置缩放比例（以画布中心为锚点） */
  setZoom(scale: number): void {
    const { width, height } = this.canvasHelper.getCanvasSize()
    this.setScale(scale, { x: width / 2, y: height / 2 })
  }

  setOffset(x: number, y: number): void {
    this.state.setOffset(x, y)
    this.emitViewportChange()
    this.forceRender()
  }

  resetViewport(): void {
    this.state.resetViewport()
    this.emitViewportChange()
    this.forceRender()
  }

  getViewport(): Viewport {
    return { ...this.state.viewport }
  }

  /** 适配视图：缩放和平移使所有节点可见 */
  fitView(): void {
    const allNodes = this.state.getAllNodes()
    if (allNodes.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of allNodes) {
      minX = Math.min(minX, node.x - node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    }

    const contentW = maxX - minX
    const contentH = maxY - minY
    const { width, height } = this.canvasHelper.getCanvasSize()

    const padding = 60
    const scaleX = (width - padding * 2) / contentW
    const scaleY = (height - padding * 2) / contentH
    const newScale = clamp(Math.min(scaleX, scaleY, this._options.maxScale), this._options.minScale, this._options.maxScale)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    this.state.setScale(newScale)
    this.state.setOffset(
      width / 2 - centerX * newScale,
      height / 2 - centerY * newScale,
    )
    this.emitViewportChange()
    this.forceRender()
  }

  /** 内部方法：通知视口变化 */
  emitViewportChange(): void {
    this.emit('viewport:change', { viewport: { ...this.state.viewport } })
  }

  // ============================================================
  //  设置
  // ============================================================

  setSnapToGrid(enabled: boolean): void {
    this.state.snapToGrid = enabled
    this.notifyDirty()
    this.forceRender()
  }

  toggleSnapToGrid(): void {
    this.state.toggleSnapToGrid()
    this.notifyDirty()
    this.forceRender()
  }

  setDefaultLineType(type: LineType): void {
    const oldType = this.state.defaultLineType
    if (oldType === type) return

    // 记录所有边的旧 lineType，用于撤销
    const oldTypes: [string, LineType | undefined][] = []
    for (const edge of this.state.edges.values()) {
      oldTypes.push([edge.id, edge.lineType])
      edge.lineType = type
    }

    this.state.setDefaultLineType(type)

    this.history.execute({
      type: 'set-default-line-type',
      do: () => {
        for (const [id] of oldTypes) {
          const e = this.state.edges.get(id)
          if (e) e.lineType = type
        }
        this.state.setDefaultLineType(type)
        this.state.markDirty()
      },
      undo: () => {
        for (const [id, old] of oldTypes) {
          const e = this.state.edges.get(id)
          if (e) e.lineType = old
        }
        this.state.setDefaultLineType(oldType)
        this.state.markDirty()
      },
    })

    this.notifyDirty()
    this.forceRender()
    this.emit('line-type:change', { lineType: this.state.defaultLineType })
  }

  toggleDefaultLineType(): void {
    const newType = this.state.defaultLineType === 'bezier' ? 'orthogonal' : 'bezier'
    this.setDefaultLineType(newType)
  }

  // ============================================================
  //  历史
  // ============================================================

  undo(): void {
    this.history.undo()
    this.notifyDirty()
    this.forceRender()
  }

  redo(): void {
    this.history.redo()
    this.notifyDirty()
    this.forceRender()
  }

  canUndo(): boolean {
    return this.history.canUndo()
  }

  canRedo(): boolean {
    return this.history.canRedo()
  }

  clearHistory(): void {
    this.history.clear()
  }

  // ============================================================
  //  序列化
  // ============================================================

  toJSON(): string {
    const data: FlowchartData = {
      version: DATA_VERSION,
      nodes: this.state.getAllNodes(),
      edges: this.state.getAllEdges(),
      defaultLineType: this.state.defaultLineType,
    }
    return JSON.stringify(data, null, 2)
  }

  fromJSON(json: string): boolean {
    try {
      const data: FlowchartData = JSON.parse(json)
      if (!data.nodes || !data.edges) return false

      this.state.clear()
      this.history.clear()

      for (const node of data.nodes) this.state.nodes.set(node.id, node)
      for (const edge of data.edges) this.state.edges.set(edge.id, edge)

      if (data.defaultLineType === 'bezier' || data.defaultLineType === 'orthogonal') {
        this.state.setDefaultLineType(data.defaultLineType)
      }

      this.forceRender()
      this.notifyDirty()
      return true
    } catch (e) {
      console.error('[Flowchart] fromJSON 失败:', e)
      return false
    }
  }

  // ============================================================
  //  导出图片
  // ============================================================

  /**
   * 导出当前画布为 PNG 图片
   * @param options.background 背景模式：'grid' 带网格背景，'transparent' 透明背景，默认 'grid'
   * @param options.scale 导出倍率，1 = 原始 CSS 尺寸，2 = 2x 高清，默认 1
   * @returns PNG 格式的 data URL
   */
  exportImage(options?: ExportImageOptions): string {
    const background: ExportBackground = options?.background ?? 'grid'
    const scale = options?.scale ?? 1
    const { width, height } = this.canvasHelper.getCanvasSize()
    const dpr = this.canvasHelper.getDPR() * scale

    // 创建离屏 canvas
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = Math.round(width * dpr)
    exportCanvas.height = Math.round(height * dpr)
    const ctx = exportCanvas.getContext('2d')!

    // 渲染内容到离屏 canvas
    renderForExport(this, ctx, width, height, dpr, background)

    // PNG 支持透明通道
    return exportCanvas.toDataURL('image/png')
  }

  /**
   * 导出当前画布为 SVG 矢量图
   * SVG 放大不失真，可用 Figma / Illustrator 等工具编辑
   * @param options.background 背景模式：'grid' 网格背景，'transparent' 透明，默认 'transparent'
   * @param options.padding 内容边距，默认 40
   * @returns SVG XML 字符串
   */
  exportSVG(options?: ExportSVGOptions): string {
    return generateSVG(this, options)
  }

  // ============================================================
  //  高级操作
  // ============================================================

  /** 删除选中的节点和连线 */
  deleteSelected(): void {
    const selNodes = this.state.getSelectedNodes()
    const selEdges = this.state.getSelectedEdges()
    if (selNodes.length === 0 && selEdges.length === 0) return

    const deletedNodes = selNodes.map(n => ({ ...n }))
    const deletedEdges = selEdges.map(e => ({ ...e }))
    const nodeIdSet = new Set(selNodes.map(n => n.id))
    const cascadedEdges: FlowEdge[] = []
    for (const edge of this.state.edges.values()) {
      if (nodeIdSet.has(edge.sourceId) || nodeIdSet.has(edge.targetId)) {
        if (!deletedEdges.some(e => e.id === edge.id)) {
          cascadedEdges.push({ ...edge })
        }
      }
    }

    this.history.execute({
      type: 'delete',
      do: () => {
        for (const n of deletedNodes) this.state.removeNode(n.id)
        for (const e of [...deletedEdges, ...cascadedEdges]) this.state.removeEdge(e.id)
      },
      undo: () => {
        for (const n of deletedNodes) this.state.nodes.set(n.id, n)
        for (const e of [...deletedEdges, ...cascadedEdges]) this.state.edges.set(e.id, e)
        this.state.markDirty()
      },
    })

    for (const n of deletedNodes) this.emit('node:remove', { id: n.id })
    for (const e of deletedEdges) this.emit('edge:remove', { id: e.id })
    this.emitSelectionChange()
    this.notifyDirty()
    this.forceRender()
  }

  /** 在画布中心添加节点 */
  addNodeAtCenter(shape: NodeShape): FlowNode {
    const { width, height } = this.canvasHelper.getCanvasSize()
    const canvasX = (width / 2 - this.state.viewport.offsetX) / this.state.viewport.scale
    const canvasY = (height / 2 - this.state.viewport.offsetY) / this.state.viewport.scale

    const node = this.state.addNode(shape, canvasX, canvasY)
    this.state.select(node.id)
    this.history.execute({
      type: 'add-node',
      do: () => { this.state.nodes.set(node.id, node); this.state.markDirty() },
      undo: () => { this.state.removeNode(node.id) },
    })
    this.emit('node:add', { node })
    this.emitSelectionChange()
    this.notifyDirty()
    this.forceRender()
    return node
  }

  // ============================================================
  //  内部方法（供引擎模块调用）
  // ============================================================

  /** 通知数据变化（消费者可监听 dirty 事件做持久化） */
  notifyDirty(): void {
    this.emit('dirty', undefined)
  }

  /** 是否正在编辑文字（供交互管理器检查） */
  isEditing(): boolean {
    return this.textEditor?.isEditing() ?? false
  }

  /** 开始编辑节点文字 */
  startEdit(node: FlowNode): void {
    this.textEditor?.startEdit(node)
  }

  /** 右键菜单是否打开 */
  isContextMenuOpen(): boolean {
    return this.contextMenu?.isOpen() ?? false
  }

  /** 显示右键菜单 */
  showContextMenu(screenX: number, screenY: number, target: 'canvas' | FlowNode | FlowEdge): void {
    this.contextMenu?.show(screenX, screenY, target)
  }

  /** 关闭右键菜单 */
  closeContextMenu(): void {
    this.contextMenu?.close()
  }

  // ============================================================
  //  销毁
  // ============================================================

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.emit('destroy', undefined)

    this.interaction.destroy()
    this.textEditor?.destroy()
    this.contextMenu?.destroy()
    this.canvasHelper.destroy()
    this.emitter.clear()

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.state.clear()
    this.history.clear()
  }
}
