// engine/interaction.ts — 交互核心：鼠标/键盘事件分发 + 状态机管理

import type { Flowchart } from '../core/flowchart'
import type { Point, NodeShape, AnchorDir, FlowNode, FlowEdge, ResizeHandle } from '../core/types'
import { hitTestNode, hitTestResizeHandle, getResizeCursor } from '../geometry/nodes'
import { hitTestEdge, hitTestEdgeEndpoint } from '../geometry/edges'
import { hitTestAnchor, getAnchorPosition } from '../geometry/anchors'
import { ZOOM_STEP, MIN_NODE_WIDTH, MIN_NODE_HEIGHT, GRID_SIZE } from '../geometry/config'
import { clamp, snapToGridValue } from '../geometry/geometry'

/**
 * 交互管理器
 * 管理 Canvas 上的鼠标/键盘事件，驱动状态机
 * 每个 Flowchart 实例拥有独立的 InteractionManager
 */
export class InteractionManager {
  private fc: Flowchart
  private canvas: HTMLCanvasElement

  private spacePressed = false
  private mouseDownPos: Point = { x: 0, y: 0 }

  // 绑定的事件处理器引用（用于销毁时移除）
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseMove: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void
  private boundWheel: (e: WheelEvent) => void
  private boundDblClick: (e: MouseEvent) => void
  private boundContextMenu: (e: MouseEvent) => void
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void

  constructor(fc: Flowchart) {
    this.fc = fc
    this.canvas = fc.canvas

    this.boundMouseDown = (e) => this.onMouseDown(e)
    this.boundMouseMove = (e) => this.onMouseMove(e)
    this.boundMouseUp = (e) => this.onMouseUp(e)
    this.boundWheel = (e) => this.onWheel(e)
    this.boundDblClick = (e) => this.onDblClick(e)
    this.boundContextMenu = (e) => this.onContextMenu(e)
    this.boundKeyDown = (e) => this.onKeyDown(e)
    this.boundKeyUp = (e) => this.onKeyUp(e)

    this.canvas.addEventListener('mousedown', this.boundMouseDown)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.canvas.addEventListener('mouseup', this.boundMouseUp)
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })
    this.canvas.addEventListener('dblclick', this.boundDblClick)
    this.canvas.addEventListener('contextmenu', this.boundContextMenu)
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)
  }

  /** 销毁，移除所有事件监听 */
  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.boundMouseDown)
    this.canvas.removeEventListener('mousemove', this.boundMouseMove)
    this.canvas.removeEventListener('mouseup', this.boundMouseUp)
    this.canvas.removeEventListener('wheel', this.boundWheel)
    this.canvas.removeEventListener('dblclick', this.boundDblClick)
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu)
    document.removeEventListener('keydown', this.boundKeyDown)
    document.removeEventListener('keyup', this.boundKeyUp)
  }

  // --- 便捷访问器 ---

  private get state() { return this.fc.state }
  private get canvasHelper() { return this.fc.canvasHelper }

  private screenToCanvas(clientX: number, clientY: number): Point {
    return this.canvasHelper.screenToCanvas(clientX, clientY, this.state.viewport)
  }

  // --- 鼠标事件 ---

  private onMouseDown(e: MouseEvent): void {
    if (this.fc.isEditing()) return

    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const canvasPt = this.screenToCanvas(e.clientX, e.clientY)
    this.mouseDownPos = { x: screenX, y: screenY }

    // 中键拖拽 或 空格+左键 → 平移
    if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
      this.state.setInteractionState('panning')
      this.state.setPanStart({ x: screenX, y: screenY })
      this.canvas.classList.add('panning-active')
      e.preventDefault()
      return
    }

    if (e.button !== 0) return

    // 检查 resize 手柄
    for (const id of this.state.selectedIds) {
      const node = this.state.nodes.get(id)
      if (!node) continue
      const handle = hitTestResizeHandle(canvasPt, node, this.state.viewport)
      if (handle) {
        this.state.setInteractionState('resizing')
        this.state.setResize(node.id, handle, canvasPt, { x: node.x, y: node.y, width: node.width, height: node.height })
        return
      }
    }

    // 检查锚点 → 开始连线
    for (const id of this.state.selectedIds) {
      const node = this.state.nodes.get(id)
      if (!node) continue
      const anchorDir = hitTestAnchor(canvasPt, node, this.state.viewport)
      if (anchorDir) {
        const sourcePos = getAnchorPosition(node, anchorDir)
        this.state.setInteractionState('connecting')
        this.state.setTempConnection({
          sourceId: node.id,
          sourceAnchor: anchorDir,
          sourcePos,
          currentPos: canvasPt,
          lineType: this.state.defaultLineType,
        })
        this.canvas.classList.add('connecting')
        return
      }
    }

    // 检查选中连线的端点手柄（重连）
    for (const id of this.state.selectedIds) {
      const edge = this.state.edges.get(id)
      if (!edge) continue
      const end = hitTestEdgeEndpoint(canvasPt, edge, this.state.nodes, this.state.viewport)
      if (end) {
        this.startReconnect(edge, end, canvasPt)
        return
      }
    }

    // 检查节点点击
    const hitNode = hitTestNode(canvasPt, this.state.nodes)
    if (hitNode) {
      if (e.shiftKey) {
        if (this.state.isSelected(hitNode.id)) {
          this.state.selectedIds.delete(hitNode.id)
          this.fc.emitSelectionChange()
        } else {
          this.state.selectAdd(hitNode.id)
          this.fc.emitSelectionChange()
        }
      } else if (!this.state.isSelected(hitNode.id)) {
        this.state.select(hitNode.id)
        this.fc.emitSelectionChange()
      }
      // 设置多节点拖拽：如果点击的节点已在选中集合中，则拖拽所有选中节点
      const idsToDrag = this.state.selectedIds.has(hitNode.id)
        ? Array.from(this.state.selectedIds)
        : [hitNode.id]
      const startPositions = new Map<string, { x: number; y: number }>()
      for (const id of idsToDrag) {
        const node = this.state.nodes.get(id)
        if (node) startPositions.set(id, { x: node.x, y: node.y })
      }
      this.state.setInteractionState('dragging-node')
      this.state.setDragNodes(idsToDrag, canvasPt, startPositions)
      this.fc.forceRender()
      return
    }

    // 检查连线点击
    const hitEdge = hitTestEdge(canvasPt, this.state.edges, this.state.nodes)
    if (hitEdge) {
      this.state.select(hitEdge.id)
      this.fc.emitSelectionChange()
      this.fc.forceRender()
      return
    }

    // 空白 → 框选
    this.state.setInteractionState('box-selecting')
    this.state.setBoxSelect({ x: screenX, y: screenY }, { x: screenX, y: screenY })
    if (!e.shiftKey) {
      this.state.selectNone()
      this.fc.emitSelectionChange()
    }
    this.fc.forceRender()
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const canvasPt = this.screenToCanvas(e.clientX, e.clientY)

    switch (this.state.interactionState) {
      case 'idle': {
        // resize 手柄 hover
        let resizeHovered = false
        for (const id of this.state.selectedIds) {
          const node = this.state.nodes.get(id)
          if (!node) continue
          const handle = hitTestResizeHandle(canvasPt, node, this.state.viewport)
          if (handle) {
            this.state.setHoveredResizeHandle(node.id, handle)
            this.canvas.style.cursor = getResizeCursor(handle)
            resizeHovered = true
            break
          }
        }
        if (!resizeHovered && this.state.hoveredResizeHandle !== null) {
          this.state.setHoveredResizeHandle(null, null)
        }
        if (resizeHovered) break

        // 锚点 hover
        let hovered = false
        for (const id of this.state.selectedIds) {
          const node = this.state.nodes.get(id)
          if (!node) continue
          const dir = hitTestAnchor(canvasPt, node, this.state.viewport)
          if (dir) {
            this.state.setHoveredAnchor(node.id, dir)
            hovered = true
            break
          }
        }
        if (!hovered && this.state.hoveredAnchorNodeId !== null) {
          this.state.setHoveredAnchor(null, null)
        }

        // 连线端点 hover
        let edgeHovered = false
        for (const id of this.state.selectedIds) {
          const edge = this.state.edges.get(id)
          if (!edge) continue
          const end = hitTestEdgeEndpoint(canvasPt, edge, this.state.nodes, this.state.viewport)
          if (end) {
            this.state.setHoveredEdgeEnd(edge.id, end)
            edgeHovered = true
            break
          }
        }
        if (!edgeHovered && this.state.hoveredEdgeEnd !== null) {
          this.state.setHoveredEdgeEnd(null, null)
        }

        // 鼠标样式
        if (edgeHovered) {
          this.canvas.style.cursor = 'crosshair'
        } else if (this.spacePressed) {
          this.canvas.classList.add('panning')
          this.canvas.style.cursor = ''
        } else {
          this.canvas.classList.remove('panning')
          this.canvas.style.cursor = ''
        }
        break
      }

      case 'dragging-node': {
        if (this.state.dragNodeIds.length > 0) {
          const dx = canvasPt.x - this.state.dragStartCanvas.x
          const dy = canvasPt.y - this.state.dragStartCanvas.y
          for (const id of this.state.dragNodeIds) {
            const start = this.state.dragNodeStartPositions.get(id)
            if (!start) continue
            this.state.updateNode(id, {
              x: this.state.applySnap(start.x + dx),
              y: this.state.applySnap(start.y + dy),
            })
          }
          this.fc.forceRender()
        }
        break
      }

      case 'connecting': {
        if (this.state.tempConnection) {
          this.state.tempConnection.currentPos = canvasPt
          this.updateConnectionPreview(canvasPt, this.state.tempConnection.sourceId)
          this.fc.forceRender()
        }
        break
      }

      case 'reconnecting': {
        if (this.state.tempConnection) {
          this.state.tempConnection.currentPos = canvasPt
          this.updateConnectionPreview(canvasPt, this.state.tempConnection.sourceId)
          this.fc.forceRender()
        }
        break
      }

      case 'panning': {
        const dx = screenX - this.state.panStartScreen.x
        const dy = screenY - this.state.panStartScreen.y
        this.state.setOffset(this.state.panStartOffset.x + dx, this.state.panStartOffset.y + dy)
        this.fc.emitViewportChange()
        this.fc.forceRender()
        break
      }

      case 'box-selecting': {
        this.state.setBoxSelect(this.state.boxSelectStart, { x: screenX, y: screenY })
        this.fc.forceRender()
        break
      }

      case 'resizing': {
        if (this.state.resizeNodeId && this.state.resizeHandle) {
          const node = this.state.nodes.get(this.state.resizeNodeId)
          if (node) {
            const newBounds = this.calculateResize(
              this.state.resizeHandle, canvasPt, this.state.resizeStartNode, this.state.snapToGrid,
            )
            this.state.updateNode(this.state.resizeNodeId, newBounds)
            this.fc.forceRender()
          }
        }
        break
      }
    }
  }

  private onMouseUp(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    switch (this.state.interactionState) {
      case 'dragging-node': {
        // 收集所有被拖拽节点的位置变化，合并为一次撤销操作
        const changes: { id: string; oldX: number; oldY: number; newX: number; newY: number }[] = []
        for (const id of this.state.dragNodeIds) {
          const node = this.state.nodes.get(id)
          if (!node) continue
          const start = this.state.dragNodeStartPositions.get(id)
          if (!start) continue
          if (node.x !== start.x || node.y !== start.y) {
            changes.push({ id, oldX: start.x, oldY: start.y, newX: node.x, newY: node.y })
          }
        }
        if (changes.length > 0) {
          this.fc.history.execute({
            type: 'move-nodes',
            do: () => {
              for (const c of changes) this.state.updateNode(c.id, { x: c.newX, y: c.newY })
            },
            undo: () => {
              for (const c of changes) this.state.updateNode(c.id, { x: c.oldX, y: c.oldY })
            },
          })
        }
        this.state.setDragNodes(null, { x: 0, y: 0 }, new Map())
        this.state.setInteractionState('idle')
        break
      }

      case 'connecting': {
        if (this.state.tempConnection) {
          if (this.state.tempConnection.previewTargetId && this.state.tempConnection.previewTargetAnchor) {
            const targetNode = this.state.nodes.get(this.state.tempConnection.previewTargetId)
            if (targetNode && targetNode.id !== this.state.tempConnection.sourceId) {
              const lineType = this.state.tempConnection.lineType || this.state.defaultLineType
              const edge = this.state.addEdge(
                this.state.tempConnection.sourceId, this.state.tempConnection.sourceAnchor,
                targetNode.id, this.state.tempConnection.previewTargetAnchor,
              )
              if (edge) {
                edge.lineType = lineType
                this.fc.history.execute({
                  type: 'add-edge',
                  do: () => { this.state.edges.set(edge.id, edge); this.state.markDirty() },
                  undo: () => { this.state.edges.delete(edge.id); this.state.markDirty() },
                })
                this.fc.emit('edge:add', { edge })
              }
            }
          }
          this.state.setTempConnection(null)
          this.state.setHoveredAnchor(null, null)
          this.canvas.classList.remove('connecting')
        }
        this.state.setInteractionState('idle')
        break
      }

      case 'reconnecting': {
        if (this.state.tempConnection && this.state.reconnectEdgeId) {
          const edge = this.state.edges.get(this.state.reconnectEdgeId)
          if (edge && this.state.tempConnection.previewTargetId && this.state.tempConnection.previewTargetAnchor) {
            const newNodeId = this.state.tempConnection.previewTargetId
            const newAnchor = this.state.tempConnection.previewTargetAnchor

            if (this.state.reconnectEnd === 'source') {
              if (newNodeId !== edge.targetId) {
                const oldSourceId = edge.sourceId, oldSourceAnchor = edge.sourceAnchor
                this.fc.history.execute({
                  type: 'reconnect-edge-source',
                  do: () => { edge.sourceId = newNodeId; edge.sourceAnchor = newAnchor; this.state.markDirty() },
                  undo: () => { edge.sourceId = oldSourceId; edge.sourceAnchor = oldSourceAnchor; this.state.markDirty() },
                })
              }
            } else if (this.state.reconnectEnd === 'target') {
              if (newNodeId !== edge.sourceId) {
                const oldTargetId = edge.targetId, oldTargetAnchor = edge.targetAnchor
                this.fc.history.execute({
                  type: 'reconnect-edge-target',
                  do: () => { edge.targetId = newNodeId; edge.targetAnchor = newAnchor; this.state.markDirty() },
                  undo: () => { edge.targetId = oldTargetId; edge.targetAnchor = oldTargetAnchor; this.state.markDirty() },
                })
              }
            }
          }
          this.state.setTempConnection(null)
          this.state.setHoveredAnchor(null, null)
          this.state.setReconnect(null, null)
          this.canvas.classList.remove('connecting')
        }
        this.state.setInteractionState('idle')
        this.fc.forceRender()
        break
      }

      case 'panning': {
        this.canvas.classList.remove('panning-active')
        if (!this.spacePressed) this.canvas.classList.remove('panning')
        this.state.setInteractionState('idle')
        break
      }

      case 'box-selecting': {
        const x1 = Math.min(this.state.boxSelectStart.x, screenX)
        const y1 = Math.min(this.state.boxSelectStart.y, screenY)
        const x2 = Math.max(this.state.boxSelectStart.x, screenX)
        const y2 = Math.max(this.state.boxSelectStart.y, screenY)

        if (Math.abs(screenX - this.mouseDownPos.x) > 3 || Math.abs(screenY - this.mouseDownPos.y) > 3) {
          let changed = false
          for (const node of this.state.nodes.values()) {
            const screen = {
              x: node.x * this.state.viewport.scale + this.state.viewport.offsetX,
              y: node.y * this.state.viewport.scale + this.state.viewport.offsetY,
            }
            if (screen.x >= x1 && screen.x <= x2 && screen.y >= y1 && screen.y <= y2) {
              this.state.selectAdd(node.id)
              changed = true
            }
          }
          if (changed) this.fc.emitSelectionChange()
        }
        this.state.setInteractionState('idle')
        this.fc.forceRender()
        break
      }

      case 'resizing': {
        if (this.state.resizeNodeId) {
          const node = this.state.nodes.get(this.state.resizeNodeId)
          if (node) {
            const newX = node.x, newY = node.y, newW = node.width, newH = node.height
            const { x: oldX, y: oldY, width: oldW, height: oldH } = this.state.resizeStartNode
            if (newX !== oldX || newY !== oldY || newW !== oldW || newH !== oldH) {
              const nodeId = this.state.resizeNodeId
              this.fc.history.execute({
                type: 'resize-node',
                do: () => this.state.updateNode(nodeId, { x: newX, y: newY, width: newW, height: newH }),
                undo: () => this.state.updateNode(nodeId, { x: oldX, y: oldY, width: oldW, height: oldH }),
              })
            }
          }
        }
        this.state.setResize(null, null)
        this.state.setInteractionState('idle')
        break
      }
    }
  }

  // --- 右键菜单 ---

  private onContextMenu(e: MouseEvent): void {
    if (this.fc.isEditing()) return
    e.preventDefault()

    const canvasPt = this.screenToCanvas(e.clientX, e.clientY)

    const hitEdge = hitTestEdge(canvasPt, this.state.edges, this.state.nodes)
    if (hitEdge) {
      this.state.select(hitEdge.id)
      this.fc.emitSelectionChange()
      this.fc.showContextMenu(e.clientX, e.clientY, hitEdge)
      this.fc.forceRender()
      return
    }

    const hitNode = hitTestNode(canvasPt, this.state.nodes)
    if (hitNode) {
      if (!this.state.isSelected(hitNode.id)) {
        this.state.select(hitNode.id)
        this.fc.emitSelectionChange()
      }
      this.fc.showContextMenu(e.clientX, e.clientY, hitNode)
      this.fc.forceRender()
      return
    }

    this.state.selectNone()
    this.fc.emitSelectionChange()
    this.fc.showContextMenu(e.clientX, e.clientY, 'canvas')
    this.fc.forceRender()
  }

  // --- 双击 ---

  private onDblClick(e: MouseEvent): void {
    const canvasPt = this.screenToCanvas(e.clientX, e.clientY)
    const hitNode = hitTestNode(canvasPt, this.state.nodes)
    if (hitNode) {
      if (!this.state.isSelected(hitNode.id)) {
        this.state.select(hitNode.id)
        this.fc.emitSelectionChange()
      }
      this.fc.startEdit(hitNode)
    }
  }

  // --- 滚轮缩放 ---

  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    this.state.setScale(this.state.viewport.scale + delta, { x: screenX, y: screenY })
    this.fc.emitViewportChange()
    this.fc.forceRender()
  }

  // --- 键盘事件 ---

  private onKeyDown(e: KeyboardEvent): void {
    if (this.fc.isEditing()) return

    if (e.key === 'Escape') {
      if (this.fc.isContextMenuOpen()) {
        this.fc.closeContextMenu()
        e.preventDefault()
        return
      }
    }

    const isCtrl = e.ctrlKey || e.metaKey

    if (e.code === 'Space' && !this.spacePressed) {
      this.spacePressed = true
      this.canvas.classList.add('panning')
      e.preventDefault()
      return
    }

    if (isCtrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      this.fc.undo()
      return
    }

    if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      this.fc.redo()
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.fc.deleteSelected()
      e.preventDefault()
      return
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.spacePressed = false
      this.canvas.classList.remove('panning')
    }
  }

  // --- 辅助方法 ---

  /** 更新连线预览（connecting / reconnecting 共用） */
  private updateConnectionPreview(canvasPt: Point, excludeId: string): void {
    const tc = this.state.tempConnection
    if (!tc) return

    // 先检查是否直接悬浮在某个目标节点的锚点上
    let foundAnchorNodeId: string | null = null
    let foundAnchorDir: AnchorDir | null = null
    for (const node of this.state.nodes.values()) {
      if (node.id === excludeId) continue
      const dir = hitTestAnchor(canvasPt, node, this.state.viewport)
      if (dir) {
        foundAnchorNodeId = node.id
        foundAnchorDir = dir
        break
      }
    }

    if (foundAnchorNodeId && foundAnchorDir) {
      this.state.setHoveredAnchor(foundAnchorNodeId, foundAnchorDir)
      tc.previewTargetId = foundAnchorNodeId
      tc.previewTargetAnchor = foundAnchorDir
    } else {
      const hitNode = hitTestNode(canvasPt, this.state.nodes)
      if (hitNode && hitNode.id !== excludeId) {
        const bestDir = this.findBestAnchor(hitNode, tc.sourcePos)
        this.state.setHoveredAnchor(hitNode.id, bestDir)
        tc.previewTargetId = hitNode.id
        tc.previewTargetAnchor = bestDir
      } else {
        if (this.state.hoveredAnchorNodeId) {
          this.state.setHoveredAnchor(null, null)
        }
        tc.previewTargetId = undefined
        tc.previewTargetAnchor = undefined
      }
    }
  }

  /** 根据源锚点位置找目标节点最佳锚点 */
  private findBestAnchor(targetNode: FlowNode, sourcePos: Point): AnchorDir {
    const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
    let bestDir: AnchorDir = 'top'
    let bestDist = Infinity
    for (const dir of dirs) {
      const pos = getAnchorPosition(targetNode, dir)
      const d = Math.hypot(pos.x - sourcePos.x, pos.y - sourcePos.y)
      if (d < bestDist) {
        bestDist = d
        bestDir = dir
      }
    }
    return bestDir
  }

  /** 开始重连连线端点 */
  private startReconnect(edge: FlowEdge, end: 'source' | 'target', canvasPt: Point): void {
    this.state.setInteractionState('reconnecting')
    this.state.setReconnect(edge.id, end)

    const lineType = edge.lineType || 'bezier'

    if (end === 'target') {
      const sourceNode = this.state.nodes.get(edge.sourceId)
      if (!sourceNode) return
      const sourcePos = getAnchorPosition(sourceNode, edge.sourceAnchor)
      this.state.setTempConnection({
        sourceId: edge.sourceId,
        sourceAnchor: edge.sourceAnchor,
        sourcePos,
        currentPos: canvasPt,
        lineType,
        reconnectEnd: 'target',
      })
    } else {
      const targetNode = this.state.nodes.get(edge.targetId)
      if (!targetNode) return
      const targetPos = getAnchorPosition(targetNode, edge.targetAnchor)
      this.state.setTempConnection({
        sourceId: edge.targetId,
        sourceAnchor: edge.targetAnchor,
        sourcePos: targetPos,
        currentPos: canvasPt,
        lineType,
        reconnectEnd: 'source',
      })
    }
    this.canvas.classList.add('connecting')
  }

  /** 计算 resize 后的节点几何属性 */
  private calculateResize(
    handle: ResizeHandle,
    mouseCanvas: Point,
    start: { x: number; y: number; width: number; height: number },
    doSnap: boolean,
  ): { x: number; y: number; width: number; height: number } {
    let left = start.x - start.width / 2
    let top = start.y - start.height / 2
    let right = start.x + start.width / 2
    let bottom = start.y + start.height / 2

    const snapVal = (v: number) => doSnap ? snapToGridValue(v, GRID_SIZE) : v

    if (handle.includes('w')) left = snapVal(mouseCanvas.x)
    if (handle.includes('e')) right = snapVal(mouseCanvas.x)
    if (handle.includes('n')) top = snapVal(mouseCanvas.y)
    if (handle.includes('s')) bottom = snapVal(mouseCanvas.y)

    if (right - left < MIN_NODE_WIDTH) {
      if (handle.includes('w')) left = right - MIN_NODE_WIDTH
      else if (handle.includes('e')) right = left + MIN_NODE_WIDTH
    }
    if (bottom - top < MIN_NODE_HEIGHT) {
      if (handle.includes('n')) top = bottom - MIN_NODE_HEIGHT
      else if (handle.includes('s')) bottom = top + MIN_NODE_HEIGHT
    }

    return {
      width: right - left,
      height: bottom - top,
      x: (left + right) / 2,
      y: (top + bottom) / 2,
    }
  }
}
