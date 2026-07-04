// edges.ts — 连线渲染 + 命中检测

import type { FlowEdge, FlowNode, Point, AnchorDir } from './types'
import { ctx } from './canvas'
import { viewport, nodes, edges, tempConnection, isSelected } from './state'
import { THEME, EDGE_HIT_THRESHOLD } from './config'
import { getControlPoints, cubicBezier, bezierTangent, distToBezier } from './utils/bezier'
import { getAnchorPosition } from './anchors'

/**
 * 绘制单条连线
 * 调用时ctx应已设置为视口变换
 */
export function drawEdge(edge: FlowEdge) {
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return

  const p0 = getAnchorPosition(source, edge.sourceAnchor)
  const p3 = getAnchorPosition(target, edge.targetAnchor)
  const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)

  const scale = viewport.scale
  const selected = isSelected(edge.id)

  ctx.save()
  ctx.strokeStyle = selected ? THEME.edgeSelected : THEME.edge
  ctx.lineWidth = (selected ? 2.5 : 2) / scale
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  ctx.stroke()

  // 箭头
  drawArrow(p2, p3, scale, selected)

  // 标签
  if (edge.label) {
    const midT = 0.5
    const mid = cubicBezier(midT, p0, p1, p2, p3)
    ctx.fillStyle = THEME.nodeText
    ctx.font = '12px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 标签背景
    const metrics = ctx.measureText(edge.label)
    const padX = 6, padY = 3
    ctx.fillStyle = 'rgba(30, 30, 60, 0.9)'
    ctx.fillRect(mid.x - metrics.width / 2 - padX, mid.y - 10, metrics.width + padX * 2, 18)
    ctx.fillStyle = THEME.nodeText
    ctx.fillText(edge.label, mid.x, mid.y)
  }

  ctx.restore()
}

/**
 * 绘制临时连线（connecting状态时的预览线）
 * 当悬浮在目标节点上时，吸附到预览锚点并显示箭头
 */
export function drawTempEdge() {
  if (!tempConnection) return
  const { sourcePos, currentPos, sourceAnchor, previewTargetId, previewTargetAnchor } = tempConnection

  let endPoint = currentPos
  let targetDir: AnchorDir
  let isSnapped = false

  if (previewTargetId && previewTargetAnchor) {
    const targetNode = nodes.get(previewTargetId)
    if (targetNode) {
      endPoint = getAnchorPosition(targetNode, previewTargetAnchor)
      targetDir = previewTargetAnchor
      isSnapped = true
    } else {
      targetDir = estimateTargetDir(sourcePos, currentPos, sourceAnchor)
    }
  } else {
    targetDir = estimateTargetDir(sourcePos, currentPos, sourceAnchor)
  }

  const { p1, p2 } = getControlPoints(sourcePos, endPoint, sourceAnchor, targetDir)

  const scale = viewport.scale
  ctx.save()
  ctx.strokeStyle = isSnapped ? THEME.edgeSelected : THEME.tempEdge
  ctx.lineWidth = 2 / scale
  ctx.lineCap = 'round'
  ctx.setLineDash([8 / scale, 4 / scale])

  ctx.beginPath()
  ctx.moveTo(sourcePos.x, sourcePos.y)
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, endPoint.x, endPoint.y)
  ctx.stroke()

  ctx.setLineDash([])

  if (isSnapped) {
    // 吸附时在终点画箭头，预览最终连线效果
    drawArrow(p2, endPoint, scale, true)
  } else {
    // 自由拖拽时画小圆点
    ctx.fillStyle = THEME.tempEdge
    ctx.beginPath()
    ctx.arc(currentPos.x, currentPos.y, 4 / scale, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 根据相对位置估算目标锚点方向 */
function estimateTargetDir(from: Point, to: Point, sourceDir: AnchorDir): AnchorDir {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // 如果源是水平方向，目标也倾向于水平；源是垂直方向，目标也倾向于垂直
  if (sourceDir === 'left' || sourceDir === 'right') {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom')
  } else {
    return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'top' : 'bottom') : (dx > 0 ? 'left' : 'right')
  }
}

/** 绘制箭头 */
function drawArrow(p2: Point, p3: Point, scale: number, selected: boolean) {
  const tangent = bezierTangent(p2, p3, p2, p3) // 简化：用p3-p2方向
  const angle = Math.atan2(tangent.y, tangent.x)
  const arrowSize = 10 / scale

  ctx.save()
  ctx.fillStyle = selected ? THEME.edgeSelected : THEME.edge
  ctx.translate(p3.x, p3.y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-arrowSize, -arrowSize * 0.4)
  ctx.lineTo(-arrowSize, arrowSize * 0.4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * 命中检测：返回点击位置命中的连线（从后往前）
 */
export function hitTestEdge(point: Point): FlowEdge | null {
  const edgeArray = Array.from(edges.values()).reverse()
  for (const edge of edgeArray) {
    const source = nodes.get(edge.sourceId)
    const target = nodes.get(edge.targetId)
    if (!source || !target) continue

    const p0 = getAnchorPosition(source, edge.sourceAnchor)
    const p3 = getAnchorPosition(target, edge.targetAnchor)
    const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)

    const d = distToBezier(point, p0, p1, p2, p3)
    if (d < EDGE_HIT_THRESHOLD) {
      return edge
    }
  }
  return null
}

/** 获取所有连线 */
export function getAllEdges(): FlowEdge[] {
  return Array.from(edges.values())
}
