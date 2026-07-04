// edges.ts — 连线渲染 + 命中检测

import type { FlowEdge, FlowNode, Point, AnchorDir, LineType } from './types'
import { ctx } from './canvas'
import { viewport, nodes, edges, tempConnection, isSelected } from './state'
import { THEME, EDGE_HIT_THRESHOLD } from './config'
import { getControlPoints, cubicBezier, bezierTangent, distToBezier } from './utils/bezier'
import { distToSegment } from './utils/geometry'
import { getAnchorPosition } from './anchors'

/**
 * 获取连线的实际类型（兼容旧数据）
 */
function getLineType(edge: FlowEdge): LineType {
  return edge.lineType || 'bezier'
}

/**
 * 计算正交折线的路径点
 * 返回 [p0, turn1, turn2, p3] 四个点
 */
function getOrthogonalPath(
  p0: Point, dir0: AnchorDir,
  p3: Point, dir3: AnchorDir,
  offset: number = 20
): Point[] {
  // 从锚点沿方向延伸 offset
  const s = anchorOffset(p0, dir0, offset)
  const t = anchorOffset(p3, dir3, offset)

  // 判断两个锚点方向是否平行（都是水平或都是垂直）
  const dir0IsH = dir0 === 'left' || dir0 === 'right'
  const dir3IsH = dir3 === 'left' || dir3 === 'right'

  if (dir0IsH === dir3IsH) {
    // 同方向：需要两个转弯点
    // 设中间参考线位置
    const midX = (s.x + t.x) / 2
    const midY = (s.y + t.y) / 2

    if (dir0IsH) {
      // 都是水平方向：先竖再横再竖
      return [s, { x: s.x, y: midY }, { x: t.x, y: midY }, t]
    } else {
      // 都是垂直方向：先横再竖再横
      return [s, { x: midX, y: s.y }, { x: midX, y: t.y }, t]
    }
  } else {
    // 不同方向：一个转弯点即可
    if (dir0IsH) {
      // 源水平，目标垂直
      return [s, { x: t.x, y: s.y }, t]
    } else {
      // 源垂直，目标水平
      return [s, { x: s.x, y: t.y }, t]
    }
  }
}

/** 锚点方向偏移 */
function anchorOffset(p: Point, dir: AnchorDir, offset: number): Point {
  switch (dir) {
    case 'top': return { x: p.x, y: p.y - offset }
    case 'bottom': return { x: p.x, y: p.y + offset }
    case 'left': return { x: p.x - offset, y: p.y }
    case 'right': return { x: p.x + offset, y: p.y }
  }
}

/**
 * 绘制单条连线
 */
export function drawEdge(edge: FlowEdge) {
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return

  const p0 = getAnchorPosition(source, edge.sourceAnchor)
  const p3 = getAnchorPosition(target, edge.targetAnchor)

  const lineType = getLineType(edge)

  const scale = viewport.scale
  const selected = isSelected(edge.id)

  ctx.save()
  ctx.strokeStyle = selected ? THEME.edgeSelected : THEME.edge
  ctx.lineWidth = (selected ? 2.5 : 2) / scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()

  if (lineType === 'bezier') {
    const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
    ctx.moveTo(p0.x, p0.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ctx.stroke()
    drawArrow(p2, p3, scale, selected, 'bezier')
  } else {
    // orthogonal
    const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) continue
      ctx.lineTo(path[i].x, path[i].y)
    }
    ctx.stroke()
    // 箭头：用最后一段的方向
    const lastSegStart = path[path.length - 2]
    const lastSegEnd = path[path.length - 1]
    drawArrow(lastSegStart, lastSegEnd, scale, selected, 'orthogonal')
  }

  // 标签
  if (edge.label) {
    let mid: Point
    if (lineType === 'bezier') {
      const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
      mid = cubicBezier(0.5, p0, p1, p2, p3)
    } else {
      const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
      // 标签放在中间段的中点
      const seg = path.length >= 3 ? 1 : 0
      mid = {
        x: (path[seg].x + path[seg + 1].x) / 2,
        y: (path[seg].y + path[seg + 1].y) / 2,
      }
    }
    ctx.fillStyle = THEME.nodeText
    ctx.font = '12px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
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
 */
export function drawTempEdge() {
  if (!tempConnection) return
  const { sourcePos, currentPos, sourceAnchor, previewTargetId, previewTargetAnchor } = tempConnection

  const lineType: LineType = (tempConnection as any).lineType || 'bezier'

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

  const scale = viewport.scale
  ctx.save()
  ctx.strokeStyle = isSnapped ? THEME.edgeSelected : THEME.tempEdge
  ctx.lineWidth = 2 / scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([8 / scale, 4 / scale])

  ctx.beginPath()
  if (lineType === 'bezier') {
    const { p1, p2 } = getControlPoints(sourcePos, endPoint, sourceAnchor, targetDir)
    ctx.moveTo(sourcePos.x, sourcePos.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, endPoint.x, endPoint.y)
    ctx.stroke()
    ctx.setLineDash([])
    if (isSnapped) {
      drawArrow(p2, endPoint, scale, true, 'bezier')
    }
  } else {
    const path = getOrthogonalPath(sourcePos, sourceAnchor, endPoint, targetDir)
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) continue
      ctx.lineTo(path[i].x, path[i].y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    if (isSnapped) {
      const lastSegStart = path[path.length - 2]
      drawArrow(lastSegStart, endPoint, scale, true, 'orthogonal')
    }
  }

  if (!isSnapped) {
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
  if (sourceDir === 'left' || sourceDir === 'right') {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom')
  } else {
    return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'top' : 'bottom') : (dx > 0 ? 'left' : 'right')
  }
}

/** 绘制箭头
 *  mode: 'bezier' 用贝塞尔切线，'orthogonal' 用最后一段线段方向
 */
function drawArrow(
  pFrom: Point, pTo: Point,
  scale: number, selected: boolean,
  mode: 'bezier' | 'orthogonal'
) {
  let angle: number
  if (mode === 'bezier') {
    const tangent = bezierTangent(pFrom, pTo, pFrom, pTo)
    angle = Math.atan2(tangent.y, tangent.x)
  } else {
    const dx = pTo.x - pFrom.x
    const dy = pTo.y - pFrom.y
    angle = Math.atan2(dy, dx)
  }
  const arrowSize = 10 / scale

  ctx.save()
  ctx.fillStyle = selected ? THEME.edgeSelected : THEME.edge
  ctx.translate(pTo.x, pTo.y)
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
    const lineType = getLineType(edge)

    if (lineType === 'bezier') {
      const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
      const d = distToBezier(point, p0, p1, p2, p3)
      if (d < EDGE_HIT_THRESHOLD) return edge
    } else {
      // orthogonal：逐段检测
      const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
      for (let i = 0; i < path.length - 1; i++) {
        if (path[i].x === path[i + 1].x && path[i].y === path[i + 1].y) continue
        const d = distToSegment(point, path[i], path[i + 1])
        if (d < EDGE_HIT_THRESHOLD) return edge
      }
    }
  }
  return null
}

/** 获取所有连线 */
export function getAllEdges(): FlowEdge[] {
  return Array.from(edges.values())
}
