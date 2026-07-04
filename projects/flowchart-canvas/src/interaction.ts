// interaction.ts — 交互核心：鼠标/键盘事件分发 + 状态机管理

import type { Point, NodeShape, AnchorDir, FlowNode, FlowEdge } from './types'
import { canvas, screenToCanvas, getCanvasSize } from './canvas'
import {
  viewport, interactionState, selectedIds,
  nodes, edges, tempConnection,
  addNode, removeNode, updateNode, addEdge, removeEdge,
  select, selectNone, selectAdd, isSelected,
  setInteractionState, setTempConnection, setHoveredAnchor,
  setDragNode, setPanStart, setBoxSelect,
  setScale, setOffset, markDirty, forceRender, getSelectedNodes, getSelectedEdges,
  dragNodeId, dragStartCanvas, dragNodeStartPos,
  panStartScreen, panStartOffset,
  boxSelectStart, snapToGrid,
  hoveredAnchorNodeId, applySnap, toggleSnapToGrid,
  defaultLineType,
} from './state'
import { hitTestNode, getAllNodes } from './nodes'
import { hitTestEdge } from './edges'
import { hitTestAnchor, getAnchorPosition } from './anchors'
import { execute, undo, redo } from './history'
import { startEdit, isEditing } from './texteditor'
import { render } from './renderer'
import { MIN_SCALE, MAX_SCALE, ZOOM_STEP } from './config'
import { clamp } from './utils/geometry'
import { showContextMenu, closeContextMenu, isContextMenuOpen } from './contextmenu'

// --- 内部状态 ---
let spacePressed = false
let mouseDownPos: Point = { x: 0, y: 0 }

/**
 * 初始化所有交互事件
 */
export function initInteraction() {
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('dblclick', onDblClick)
  canvas.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', () => forceRender(render))
}

// --- 鼠标事件 ---

function onMouseDown(e: MouseEvent) {
  if (isEditing()) return

  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const canvasPt = screenToCanvas(e.clientX, e.clientY)
  mouseDownPos = { x: screenX, y: screenY }

  // 中键拖拽 或 空格+左键 → 平移
  if (e.button === 1 || (e.button === 0 && spacePressed)) {
    setInteractionState('panning')
    setPanStart({ x: screenX, y: screenY })
    canvas.classList.add('panning-active')
    e.preventDefault()
    return
  }

  if (e.button !== 0) return

  // 检查是否点击了选中节点的锚点
  for (const id of selectedIds) {
    const node = nodes.get(id)
    if (!node) continue
    const anchorDir = hitTestAnchor(canvasPt, node)
    if (anchorDir) {
      // 开始连线
      const sourcePos = getAnchorPosition(node, anchorDir)
      setInteractionState('connecting')
      setTempConnection({
        sourceId: node.id,
        sourceAnchor: anchorDir,
        sourcePos,
        currentPos: canvasPt,
        lineType: defaultLineType,
      })
      canvas.classList.add('connecting')
      return
    }
  }

  // 检查是否点击了节点
  const hitNode = hitTestNode(canvasPt)
  if (hitNode) {
    if (e.shiftKey) {
      if (isSelected(hitNode.id)) {
        selectedIds.delete(hitNode.id)
      } else {
        selectAdd(hitNode.id)
      }
    } else if (!isSelected(hitNode.id)) {
      select(hitNode.id)
    }
    // 开始拖拽
    setInteractionState('dragging-node')
    setDragNode(hitNode.id, canvasPt, { x: hitNode.x, y: hitNode.y })
    forceRender(render)
    return
  }

  // 检查是否点击了连线
  const hitEdge = hitTestEdge(canvasPt)
  if (hitEdge) {
    select(hitEdge.id)
    forceRender(render)
    return
  }

  // 点击空白 → 框选
  setInteractionState('box-selecting')
  setBoxSelect({ x: screenX, y: screenY }, { x: screenX, y: screenY })
  if (!e.shiftKey) selectNone()
  forceRender(render)
}

function onMouseMove(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const canvasPt = screenToCanvas(e.clientX, e.clientY)

  switch (interactionState) {
    case 'idle': {
      // 检查锚点hover
      let hovered = false
      for (const id of selectedIds) {
        const node = nodes.get(id)
        if (!node) continue
        const dir = hitTestAnchor(canvasPt, node)
        if (dir) {
          setHoveredAnchor(node.id, dir)
          hovered = true
          break
        }
      }
      if (!hovered && hoveredAnchorNodeId !== null) {
        setHoveredAnchor(null, null)
      }
      // 鼠标样式
      if (spacePressed) {
        canvas.classList.add('panning')
      } else {
        canvas.classList.remove('panning')
      }
      break
    }

    case 'dragging-node': {
      if (dragNodeId) {
        const dx = canvasPt.x - dragStartCanvas.x
        const dy = canvasPt.y - dragStartCanvas.y
        updateNode(dragNodeId, {
          x: applySnap(dragNodeStartPos.x + dx),
          y: applySnap(dragNodeStartPos.y + dy),
        })
        forceRender(render)
      }
      break
    }

    case 'connecting': {
      if (tempConnection) {
        tempConnection.currentPos = canvasPt

        // 先检查是否直接悬浮在某个目标节点的锚点上
        let foundAnchorNodeId: string | null = null
        let foundAnchorDir: AnchorDir | null = null
        for (const node of nodes.values()) {
          if (node.id === tempConnection.sourceId) continue
          const dir = hitTestAnchor(canvasPt, node)
          if (dir) {
            foundAnchorNodeId = node.id
            foundAnchorDir = dir
            break
          }
        }

        if (foundAnchorNodeId && foundAnchorDir) {
          // 直接命中锚点 → 用该锚点作为预览
          setHoveredAnchor(foundAnchorNodeId, foundAnchorDir)
          tempConnection.previewTargetId = foundAnchorNodeId
          tempConnection.previewTargetAnchor = foundAnchorDir
        } else {
          // 检查是否悬浮在节点body上
          const hitNode = hitTestNode(canvasPt)
          if (hitNode && hitNode.id !== tempConnection.sourceId) {
            // 悬浮在目标节点上 → 计算最佳锚点并展示全部锚点
            const bestDir = findBestAnchor(hitNode, tempConnection.sourcePos)
            setHoveredAnchor(hitNode.id, bestDir)
            tempConnection.previewTargetId = hitNode.id
            tempConnection.previewTargetAnchor = bestDir
          } else {
            // 未悬浮在任何目标上 → 清除预览
            if (hoveredAnchorNodeId) {
              setHoveredAnchor(null, null)
            }
            tempConnection.previewTargetId = undefined
            tempConnection.previewTargetAnchor = undefined
          }
        }
        forceRender(render)
      }
      break
    }

    case 'panning': {
      const dx = screenX - panStartScreen.x
      const dy = screenY - panStartScreen.y
      setOffset(panStartOffset.x + dx, panStartOffset.y + dy)
      forceRender(render)
      break
    }

    case 'box-selecting': {
      setBoxSelect(boxSelectStart, { x: screenX, y: screenY })
      forceRender(render)
      break
    }
  }
}

function onMouseUp(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const canvasPt = screenToCanvas(e.clientX, e.clientY)

  switch (interactionState) {
    case 'dragging-node': {
      if (dragNodeId) {
        const node = nodes.get(dragNodeId)
        if (node) {
          const newX = node.x
          const newY = node.y
          const oldX = dragNodeStartPos.x
          const oldY = dragNodeStartPos.y
          if (newX !== oldX || newY !== oldY) {
            const nodeId = dragNodeId
            execute({
              type: 'move-node',
              do: () => updateNode(nodeId, { x: newX, y: newY }),
              undo: () => updateNode(nodeId, { x: oldX, y: oldY }),
            })
          }
        }
      }
      setDragNode(null, { x: 0, y: 0 }, { x: 0, y: 0 })
      setInteractionState('idle')
      break
    }

    case 'connecting': {
      if (tempConnection) {
        // 使用 mousemove 中计算的预览信息创建连线
        if (tempConnection.previewTargetId && tempConnection.previewTargetAnchor) {
          const targetNode = nodes.get(tempConnection.previewTargetId)
          if (targetNode && targetNode.id !== tempConnection.sourceId) {
            const lineType = tempConnection.lineType || defaultLineType
            const edge = addEdge(
              tempConnection.sourceId,
              tempConnection.sourceAnchor,
              targetNode.id,
              tempConnection.previewTargetAnchor
            )
            if (edge) {
              // 写入连线类型
              edge.lineType = lineType
              execute({
                type: 'add-edge',
                do: () => { edges.set(edge.id, edge); markDirty() },
                undo: () => { edges.delete(edge.id); markDirty() },
              })
            }
          }
        }

        setTempConnection(null)
        setHoveredAnchor(null, null)
        canvas.classList.remove('connecting')
      }
      setInteractionState('idle')
      break
    }

    case 'panning': {
      canvas.classList.remove('panning-active')
      if (!spacePressed) canvas.classList.remove('panning')
      setInteractionState('idle')
      break
    }

    case 'box-selecting': {
      const x1 = Math.min(boxSelectStart.x, screenX)
      const y1 = Math.min(boxSelectStart.y, screenY)
      const x2 = Math.max(boxSelectStart.x, screenX)
      const y2 = Math.max(boxSelectStart.y, screenY)

      if (Math.abs(screenX - mouseDownPos.x) > 3 || Math.abs(screenY - mouseDownPos.y) > 3) {
        for (const node of nodes.values()) {
          const screen = {
            x: node.x * viewport.scale + viewport.offsetX,
            y: node.y * viewport.scale + viewport.offsetY,
          }
          if (screen.x >= x1 && screen.x <= x2 && screen.y >= y1 && screen.y <= y2) {
            selectAdd(node.id)
          }
        }
      }
      setInteractionState('idle')
      forceRender(render)
      break
    }
  }
}

// --- 右键菜单 ---

function onContextMenu(e: MouseEvent) {
  if (isEditing()) return
  e.preventDefault()

  const canvasPt = screenToCanvas(e.clientX, e.clientY)

  // 优先检查连线
  const hitEdge = hitTestEdge(canvasPt)
  if (hitEdge) {
    select(hitEdge.id)
    showContextMenu(e.clientX, e.clientY, hitEdge)
    forceRender(render)
    return
  }

  // 再检查节点
  const hitNode = hitTestNode(canvasPt)
  if (hitNode) {
    if (!isSelected(hitNode.id)) select(hitNode.id)
    showContextMenu(e.clientX, e.clientY, hitNode)
    forceRender(render)
    return
  }

  // 空白
  selectNone()
  showContextMenu(e.clientX, e.clientY, 'canvas')
  forceRender(render)
}

// --- 双击 ---

function onDblClick(e: MouseEvent) {
  const canvasPt = screenToCanvas(e.clientX, e.clientY)
  const hitNode = hitTestNode(canvasPt)
  if (hitNode) {
    if (!isSelected(hitNode.id)) select(hitNode.id)
    startEdit(hitNode)
  }
}

// --- 滚轮缩放 ---

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newScale = viewport.scale + delta
  setScale(newScale, { x: screenX, y: screenY })
  updateZoomDisplay()
  forceRender(render)
}

// --- 键盘事件 ---

function onKeyDown(e: KeyboardEvent) {
  if (isEditing()) return

  // ESC 关闭右键菜单或退出编辑
  if (e.key === 'Escape') {
    if (isContextMenuOpen()) {
      closeContextMenu()
      e.preventDefault()
      return
    }
  }

  const isCtrl = e.ctrlKey || e.metaKey

  if (e.code === 'Space' && !spacePressed) {
    spacePressed = true
    canvas.classList.add('panning')
    e.preventDefault()
    return
  }

  if (isCtrl && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
    forceRender(render)
    return
  }

  if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
    forceRender(render)
    return
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected()
    e.preventDefault()
    return
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spacePressed = false
    canvas.classList.remove('panning')
  }
}

// --- 辅助函数 ---

/** 删除选中的节点和连线 */
export function deleteSelected() {
  const selNodes = getSelectedNodes()
  const selEdges = getSelectedEdges()
  if (selNodes.length === 0 && selEdges.length === 0) return

  const deletedNodes = selNodes.map(n => ({ ...n }))
  const deletedEdges = selEdges.map(e => ({ ...e }))
  const nodeIdSet = new Set(selNodes.map(n => n.id))
  const cascadedEdges: FlowEdge[] = []
  for (const edge of edges.values()) {
    if (nodeIdSet.has(edge.sourceId) || nodeIdSet.has(edge.targetId)) {
      if (!deletedEdges.some(e => e.id === edge.id)) {
        cascadedEdges.push({ ...edge })
      }
    }
  }

  execute({
    type: 'delete',
    do: () => {
      for (const n of deletedNodes) removeNode(n.id)
      for (const e of [...deletedEdges, ...cascadedEdges]) removeEdge(e.id)
    },
    undo: () => {
      for (const n of deletedNodes) nodes.set(n.id, n)
      for (const e of [...deletedEdges, ...cascadedEdges]) edges.set(e.id, e)
      markDirty()
    },
  })
  forceRender(render)
}

/** 根据源锚点位置找目标节点最佳锚点 */
function findBestAnchor(targetNode: FlowNode, sourcePos: Point): AnchorDir {
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

/** 更新缩放显示 */
export function updateZoomDisplay() {
  const display = document.getElementById('zoom-display')
  if (display) {
    display.textContent = `${Math.round(viewport.scale * 100)}%`
  }
}

/** 适配视图 */
export function fitView() {
  const allNodes = getAllNodes()
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
  const { width, height } = getCanvasSize()

  const padding = 60
  const scaleX = (width - padding * 2) / contentW
  const scaleY = (height - padding * 2) / contentH
  const newScale = clamp(Math.min(scaleX, scaleY, MAX_SCALE), MIN_SCALE, MAX_SCALE)

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  setScale(newScale)
  setOffset(
    width / 2 - centerX * newScale,
    height / 2 - centerY * newScale
  )
  updateZoomDisplay()
  forceRender(render)
}

/** 在画布中心添加节点 */
export function addNodeAtCenter(shape: NodeShape): FlowNode {
  const { width, height } = getCanvasSize()
  const canvasX = (width / 2 - viewport.offsetX) / viewport.scale
  const canvasY = (height / 2 - viewport.offsetY) / viewport.scale

  const node = addNode(shape, canvasX, canvasY)
  select(node.id)

  execute({
    type: 'add-node',
    do: () => { nodes.set(node.id, node); markDirty() },
    undo: () => { removeNode(node.id); markDirty() },
  })

  forceRender(render)
  return node
}
