// renderer.ts — 渲染管线

import { ctx, applyTransform, applyViewportTransform, getCanvasSize } from './canvas'
import { nodes, edges, selectedIds, interactionState, tempConnection, boxSelectStart, boxSelectEnd, hoveredAnchorNodeId, hoveredAnchorDir } from './state'
import { THEME } from './config'
import { drawGrid } from './grid'
import { drawNode } from './nodes'
import { drawEdge, drawTempEdge } from './edges'
import { drawAnchors, drawTargetAnchors } from './anchors'

/**
 * 主渲染函数：按层依次绘制
 */
export function render() {
  const { width, height } = getCanvasSize()

  // 1. 清空画布 + 背景（屏幕坐标系）
  applyTransform()
  ctx.fillStyle = THEME.background
  ctx.fillRect(0, 0, width, height)

  // 2. 切换到画布坐标系（视口变换）
  applyViewportTransform()

  // 3. 背景网格
  drawGrid(width, height)

  // 4. 所有连线
  for (const edge of edges.values()) {
    drawEdge(edge)
  }

  // 5. 临时连线（connecting状态）
  if (interactionState === 'connecting' && tempConnection) {
    drawTempEdge()
  }

  // 6. 所有节点
  for (const node of nodes.values()) {
    drawNode(node, selectedIds.has(node.id))
  }

  // 7. 选中节点的锚点
  for (const id of selectedIds) {
    const node = nodes.get(id)
    if (node) drawAnchors(node)
  }

  // 7.5 连线状态下悬浮目标节点的锚点
  if (interactionState === 'connecting' && hoveredAnchorNodeId) {
    const node = nodes.get(hoveredAnchorNodeId)
    if (node && !selectedIds.has(node.id)) {
      drawTargetAnchors(node, hoveredAnchorDir)
    }
  }

  // 8. 框选矩形（屏幕坐标系）
  if (interactionState === 'box-selecting') {
    applyTransform()
    const x = Math.min(boxSelectStart.x, boxSelectEnd.x)
    const y = Math.min(boxSelectStart.y, boxSelectEnd.y)
    const w = Math.abs(boxSelectEnd.x - boxSelectStart.x)
    const h = Math.abs(boxSelectEnd.y - boxSelectStart.y)
    ctx.fillStyle = THEME.selectionBox
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = THEME.selectionBoxBorder
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
  }
}
