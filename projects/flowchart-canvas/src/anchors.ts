// anchors.ts — 锚点渲染 + 位置计算 + 命中检测

import type { FlowNode, AnchorDir, Point } from './types'
import { ctx } from './canvas'
import { viewport, hoveredAnchorNodeId, hoveredAnchorDir } from './state'
import { THEME, ANCHOR_RADIUS, ANCHOR_HIT_RADIUS } from './config'

/**
 * 获取节点某方向锚点在画布坐标系中的位置
 */
export function getAnchorPosition(node: FlowNode, dir: AnchorDir): Point {
  const { x, y, width, height, shape } = node

  // 圆形和菱形锚点在边界上
  if (shape === 'circle') {
    const r = Math.min(width, height) / 2
    switch (dir) {
      case 'top': return { x, y: y - r }
      case 'right': return { x: x + r, y }
      case 'bottom': return { x, y: y + r }
      case 'left': return { x: x - r, y }
    }
  }

  // 矩形和圆角矩形锚点在边缘中点
  switch (dir) {
    case 'top': return { x, y: y - height / 2 }
    case 'right': return { x: x + width / 2, y }
    case 'bottom': return { x, y: y + height / 2 }
    case 'left': return { x: x - width / 2, y }
  }
}

/**
 * 绘制节点周围的4个锚点（选中时显示）
 * 调用时ctx应已设置为视口变换
 */
export function drawAnchors(node: FlowNode) {
  const scale = viewport.scale
  const radius = ANCHOR_RADIUS / scale  // 锚点大小保持视觉一致

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  ctx.save()

  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const isHovered = hoveredAnchorNodeId === node.id && hoveredAnchorDir === dir

    ctx.fillStyle = isHovered ? THEME.anchorHover : THEME.anchor
    ctx.strokeStyle = THEME.nodeFill
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
 * 返回命中的锚点方向，未命中返回null
 */
export function hitTestAnchor(point: Point, node: FlowNode): AnchorDir | null {
  // 锚点命中检测在屏幕坐标系进行（因为锚点大小是屏幕像素固定的）
  // 但传入的point是画布坐标，需要转换
  const scale = viewport.scale
  const hitRadius = ANCHOR_HIT_RADIUS / scale  // 转为画布坐标

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const dist = Math.hypot(point.x - pos.x, point.y - pos.y)
    if (dist <= hitRadius) {
      return dir
    }
  }
  return null
}

/**
 * 绘制目标节点的锚点（connecting状态悬浮在目标节点上时）
 * 显示全部4个锚点，高亮预选锚点
 */
export function drawTargetAnchors(node: FlowNode, bestDir: AnchorDir | null) {
  const scale = viewport.scale
  const radius = ANCHOR_RADIUS / scale

  const dirs: AnchorDir[] = ['top', 'right', 'bottom', 'left']
  ctx.save()

  for (const dir of dirs) {
    const pos = getAnchorPosition(node, dir)
    const isBest = dir === bestDir

    ctx.fillStyle = isBest ? THEME.anchorHover : THEME.anchor
    ctx.strokeStyle = THEME.nodeFill
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
