// engine/renderer.ts — 渲染管线

import type { Flowchart } from '../core/flowchart'
import type { RenderCtx, ExportBackground } from '../core/types'
import { drawGrid } from '../geometry/grid'
import { drawNode, drawResizeHandles } from '../geometry/nodes'
import { drawEdge, drawTempEdge, drawEdgeEndpoints } from '../geometry/edges'
import { drawAnchors, drawTargetAnchors } from '../geometry/anchors'

/**
 * 主渲染函数：按层依次绘制
 * 从 Flowchart 实例读取所有状态和配置
 */
export function render(fc: Flowchart): void {
  const { ctx, state, theme, canvasHelper } = fc
  const { width, height } = canvasHelper.getCanvasSize()

  const rc: RenderCtx = { ctx, viewport: state.viewport, theme }

  // 1. 清空画布 + 背景（屏幕坐标系）
  canvasHelper.applyTransform()
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, width, height)

  // 2. 切换到画布坐标系（视口变换）
  canvasHelper.applyViewportTransform(state.viewport)

  // 3. 背景网格
  drawGrid(ctx, state.viewport, theme, width, height)

  // 4. 所有连线
  for (const edge of state.edges.values()) {
    drawEdge(rc, edge, state.nodes, state.selectedIds.has(edge.id))
  }

  // 5. 临时连线（connecting / reconnecting 状态）
  if ((state.interactionState === 'connecting' || state.interactionState === 'reconnecting') && state.tempConnection) {
    drawTempEdge(rc, state.tempConnection, state.nodes)
  }

  // 6. 所有节点
  for (const node of state.nodes.values()) {
    drawNode(rc, node, state.selectedIds.has(node.id))
  }

  // 7. 选中节点的锚点
  for (const id of state.selectedIds) {
    const node = state.nodes.get(id)
    if (node) drawAnchors(rc, node, state.hoveredAnchorNodeId, state.hoveredAnchorDir)
  }

  // 7.5 连线/重连状态下悬浮目标节点的锚点
  if ((state.interactionState === 'connecting' || state.interactionState === 'reconnecting') && state.hoveredAnchorNodeId) {
    const node = state.nodes.get(state.hoveredAnchorNodeId)
    if (node && !state.selectedIds.has(node.id)) {
      drawTargetAnchors(rc, node, state.hoveredAnchorDir)
    }
  }

  // 7.6 选中连线的端点手柄 + 选中节点的 resize 手柄（idle 状态下显示）
  if (state.interactionState === 'idle') {
    for (const id of state.selectedIds) {
      const edge = state.edges.get(id)
      if (edge) drawEdgeEndpoints(rc, edge, state.nodes, state.hoveredEdgeEnd)
      const node = state.nodes.get(id)
      if (node) drawResizeHandles(rc, node)
    }
  }

  // 8. 框选矩形（屏幕坐标系）
  if (state.interactionState === 'box-selecting') {
    canvasHelper.applyTransform()
    const x = Math.min(state.boxSelectStart.x, state.boxSelectEnd.x)
    const y = Math.min(state.boxSelectStart.y, state.boxSelectEnd.y)
    const w = Math.abs(state.boxSelectEnd.x - state.boxSelectStart.x)
    const h = Math.abs(state.boxSelectEnd.y - state.boxSelectStart.y)
    ctx.fillStyle = theme.selectionBox
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = theme.selectionBoxBorder
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
  }
}

/**
 * 导出渲染：只绘制内容（连线 + 节点），不绘制交互元素（选中框、锚点、手柄等）
 * 可选背景模式：grid（带网格背景色）或 transparent（透明）
 */
export function renderForExport(
  fc: Flowchart,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  background: ExportBackground,
): void {
  const { state, theme } = fc
  const viewport = state.viewport
  const rc: RenderCtx = { ctx, viewport, theme }

  // 1. 屏幕坐标系：背景填充（仅 grid 模式）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (background === 'grid') {
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, width, height)
  }

  // 2. 切换到画布坐标系
  ctx.setTransform(
    dpr * viewport.scale, 0,
    0, dpr * viewport.scale,
    dpr * viewport.offsetX,
    dpr * viewport.offsetY,
  )

  // 3. 背景网格（仅 grid 模式）
  if (background === 'grid') {
    drawGrid(ctx, viewport, theme, width, height)
  }

  // 4. 所有连线（不显示选中高亮）
  for (const edge of state.edges.values()) {
    drawEdge(rc, edge, state.nodes, false)
  }

  // 5. 所有节点（不显示选中高亮）
  for (const node of state.nodes.values()) {
    drawNode(rc, node, false)
  }
}
