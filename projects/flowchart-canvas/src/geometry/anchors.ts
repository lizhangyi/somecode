// geometry/anchors.ts — 锚点渲染 + 位置计算 + 命中检测（纯函数）

import type { FlowNode, AnchorDir, Point, RenderCtx, Viewport } from '../core/types'
import { ANCHOR_RADIUS, ANCHOR_HIT_RADIUS } from './config'

/**
 * 获取节点某方向锚点在画布坐标系中的位置
 */
export function getAnchorPosition(node: FlowNode, dir: AnchorDir): Point {
  const { x, y, width, height, shape } = node

  if (shape === 'circle') {
    const r = Math.min(width, height) / 2
    switch (dir) {
      case 'top':    return { x, y: y - r }
      case 'right':  return { x: x + r, y }
      case 'bottom': return { x, y: y + r }
      case 'left':   return { x: x - r, y }
    }
  }

  switch (dir) {
    case 'top':    return { x, y: y - height / 2 }
    case 'right':  return { x: x + width / 2, y }
    case 'bottom': return { x, y: y + height / 2 }
    case 'left':   return { x: x - width / 2, y }
  }
}

/**
 * 绘制节点周围的4个锚点（选中时显示）
 */
export function drawAnchors(
  rc: RenderCtx, node: FlowNode,
  hoveredNodeId: string | null, hoveredDir: AnchorDir | null,
): void {
  const { ctx, viewport, theme } = rc
  const scale = viewport.scale
  const radius = ANCHOR_RADIUS / scale

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  ctx.save()

  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const isHovered = hoveredNodeId === node.id && hoveredDir === dir

    ctx.fillStyle = isHovered ? theme.anchorHover : theme.anchor
    ctx.strokeStyle = theme.nodeFill
    ctx.lineWidth = 2 / scale

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, isHovered ? radius * 1.3 : radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * 命中检测：检测点击是否命中某节点的锚点
 */
export function hitTestAnchor(point: Point, node: FlowNode, viewport: Viewport): AnchorDir | null {
  const scale = viewport.scale
  const hitRadius = ANCHOR_HIT_RADIUS / scale

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const d = Math.hypot(point.x - pos.x, point.y - pos.y)
    if (d <= hitRadius) return dir
  }
  return null
}

/**
 * 绘制目标节点的锚点（connecting 状态悬浮在目标节点上时）
 * 显示全部4个锚点，高亮预选锚点
 */
export function drawTargetAnchors(
  rc: RenderCtx, node: FlowNode, bestDir: AnchorDir | null,
): void {
  const { ctx, viewport, theme } = rc
  const scale = viewport.scale
  const radius = ANCHOR_RADIUS / scale

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  ctx.save()

  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const isBest = dir === bestDir

    ctx.fillStyle = isBest ? theme.anchorHover : theme.anchor
    ctx.strokeStyle = theme.nodeFill
    ctx.lineWidth = 2 / scale
    ctx.globalAlpha = isBest ? 1.0 : 0.7

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, isBest ? radius * 1.4 : radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.globalAlpha = 1.0
  ctx.restore()
}
