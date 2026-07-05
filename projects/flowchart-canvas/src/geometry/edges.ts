// geometry/edges.ts — 连线渲染 + 命中检测（纯函数）

import type {
  FlowEdge, FlowNode, Point, AnchorDir, LineType,
  TempConnection, RenderCtx, Viewport, ThemeColors,
} from '../core/types'
import { EDGE_HIT_THRESHOLD, ANCHOR_RADIUS, ANCHOR_HIT_RADIUS } from './config'
import { getControlPoints, cubicBezier, bezierTangent, distToBezier } from './bezier'
import { distToSegment } from './geometry'
import { getAnchorPosition } from './anchors'

/** 获取连线的实际类型（兼容旧数据） */
function getLineType(edge: FlowEdge): LineType {
  return edge.lineType || 'bezier'
}

/** 近对齐阈值：dy/dx 小于此值时直接连线，不产生弯折 */
const ALIGN_THRESHOLD = 6

/**
 * 计算正交折线的完整绘制路径点（含起点 p0 和终点 p3）
 * 智能路由：自适应偏移、同方向绕行、近对齐直线化、共线简化
 */
export function getOrthogonalPath(
  p0: Point, dir0: AnchorDir,
  p3: Point, dir3: AnchorDir,
  offset?: number,
): Point[] {
  const dx = p3.x - p0.x
  const dy = p3.y - p0.y
  const dist = Math.hypot(dx, dy)
  // 自适应偏移：根据距离缩放，限制在 10~30px
  const off = offset ?? Math.min(30, Math.max(10, dist * 0.2))

  const s = anchorOffset(p0, dir0, off)
  const t = anchorOffset(p3, dir3, off)

  const dir0H = dir0 === 'left' || dir0 === 'right'
  const dir3H = dir3 === 'left' || dir3 === 'right'

  let path: Point[]

  if (dir0H && dir3H) {
    path = routeBothH(p0, s, dir0, p3, t, dir3, dy, off)
  } else if (!dir0H && !dir3H) {
    path = routeBothV(p0, s, dir0, p3, t, dir3, dx, off)
  } else if (dir0H) {
    // 源水平 + 目标垂直：L 路由
    path = [p0, s, { x: t.x, y: s.y }, t, p3]
  } else {
    // 源垂直 + 目标水平：L 路由
    path = [p0, s, { x: s.x, y: t.y }, t, p3]
  }

  return simplifyPath(path)
}

/** 两个水平锚点的路由 */
function routeBothH(
  p0: Point, s: Point, dir0: AnchorDir,
  p3: Point, t: Point, dir3: AnchorDir,
  dy: number, off: number,
): Point[] {
  const sameDir = dir0 === dir3
  const facing = (dir0 === 'right' && dir3 === 'left') || (dir0 === 'left' && dir3 === 'right')

  // 近水平对齐：直接连线
  if (Math.abs(dy) < ALIGN_THRESHOLD) return [p0, p3]

  if (facing) {
    // 相对方向（right→left）：Z 路由
    const midX = (s.x + t.x) / 2
    return [p0, s, { x: midX, y: s.y }, { x: midX, y: t.y }, t, p3]
  }

  if (sameDir) {
    // 同方向（right→right）：绕到外侧再折回
    const turnX = dir0 === 'right'
      ? Math.max(s.x, t.x) + off
      : Math.min(s.x, t.x) - off
    return [p0, s, { x: turnX, y: s.y }, { x: turnX, y: t.y }, t, p3]
  }

  // 相背方向（right→left 但目标在源左侧）：中点 Z 路由
  const midX = (s.x + t.x) / 2
  return [p0, s, { x: midX, y: s.y }, { x: midX, y: t.y }, t, p3]
}

/** 两个垂直锚点的路由 */
function routeBothV(
  p0: Point, s: Point, dir0: AnchorDir,
  p3: Point, t: Point, dir3: AnchorDir,
  dx: number, off: number,
): Point[] {
  const sameDir = dir0 === dir3
  const facing = (dir0 === 'bottom' && dir3 === 'top') || (dir0 === 'top' && dir3 === 'bottom')

  if (Math.abs(dx) < ALIGN_THRESHOLD) return [p0, p3]

  if (facing) {
    const midY = (s.y + t.y) / 2
    return [p0, s, { x: s.x, y: midY }, { x: t.x, y: midY }, t, p3]
  }

  if (sameDir) {
    const turnY = dir0 === 'bottom'
      ? Math.max(s.y, t.y) + off
      : Math.min(s.y, t.y) - off
    return [p0, s, { x: s.x, y: turnY }, { x: t.x, y: turnY }, t, p3]
  }

  const midY = (s.y + t.y) / 2
  return [p0, s, { x: s.x, y: midY }, { x: t.x, y: midY }, t, p3]
}

/**
 * 简化路径：移除重复点和共线点
 * 共线判定：连续三点方向相同（叉积为零且点积为正）
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path

  const result: Point[] = [path[0]]

  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]

    // 跳过重复点
    if (curr.x === prev.x && curr.y === prev.y) continue

    // 检查与前一点是否共线（需有下一个点参与判断）
    if (i < path.length - 1) {
      const next = path[i + 1]
      const dx1 = curr.x - prev.x
      const dy1 = curr.y - prev.y
      const dx2 = next.x - curr.x
      const dy2 = next.y - curr.y
      // 叉积为零 = 共线，点积非负 = 同向
      if (dx1 * dy2 === dy1 * dx2 && dx1 * dx2 >= 0 && dy1 * dy2 >= 0) continue
    }

    result.push(curr)
  }

  return result
}

/** 锚点方向偏移 */
function anchorOffset(p: Point, dir: AnchorDir, offset: number): Point {
  switch (dir) {
    case 'top':    return { x: p.x, y: p.y - offset }
    case 'bottom': return { x: p.x, y: p.y + offset }
    case 'left':   return { x: p.x - offset, y: p.y }
    case 'right':  return { x: p.x + offset, y: p.y }
  }
}

/**
 * 用圆角绘制正交路径（arcTo 拐弯）
 * radius 为 0 时退化为直角
 */
function strokeOrthogonalPath(ctx: CanvasRenderingContext2D, path: Point[], radius: number): void {
  ctx.moveTo(path[0].x, path[0].y)
  if (path.length === 2) {
    ctx.lineTo(path[1].x, path[1].y)
    return
  }
  for (let i = 1; i < path.length - 1; i++) {
    if (radius > 0) {
      ctx.arcTo(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, radius)
    } else {
      ctx.lineTo(path[i].x, path[i].y)
    }
  }
  ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y)
}

/**
 * 绘制单条连线
 */
export function drawEdge(
  rc: RenderCtx, edge: FlowEdge, nodes: Map<string, FlowNode>, isSelected: boolean,
): void {
  const { ctx, viewport, theme } = rc
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return

  const p0 = getAnchorPosition(source, edge.sourceAnchor)
  const p3 = getAnchorPosition(target, edge.targetAnchor)
  const lineType = getLineType(edge)
  const scale = viewport.scale

  ctx.save()
  ctx.strokeStyle = isSelected ? theme.edgeSelected : theme.edge
  ctx.lineWidth = (isSelected ? 2.5 : 2) / scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()

  if (lineType === 'bezier') {
    const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
    ctx.moveTo(p0.x, p0.y)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ctx.stroke()
    drawArrow(ctx, p2, p3, scale, isSelected, theme, 'bezier')
  } else {
    const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
    const cornerRadius = 6 / scale
    strokeOrthogonalPath(ctx, path, cornerRadius)
    ctx.stroke()
    const lastSegStart = path[path.length - 2]
    const lastSegEnd = path[path.length - 1]
    drawArrow(ctx, lastSegStart, lastSegEnd, scale, isSelected, theme, 'orthogonal')
  }

  // 标签
  if (edge.label) {
    let mid: Point
    if (lineType === 'bezier') {
      const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
      mid = cubicBezier(0.5, p0, p1, p2, p3)
    } else {
      const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
      const midIdx = Math.floor((path.length - 1) / 2)
      mid = {
        x: (path[midIdx].x + path[midIdx + 1].x) / 2,
        y: (path[midIdx].y + path[midIdx + 1].y) / 2,
      }
    }
    ctx.fillStyle = theme.nodeText
    ctx.font = '12px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const metrics = ctx.measureText(edge.label)
    const padX = 6, padY = 3
    ctx.fillStyle = 'rgba(30, 30, 60, 0.9)'
    ctx.fillRect(mid.x - metrics.width / 2 - padX, mid.y - 10, metrics.width + padX * 2, 18)
    ctx.fillStyle = theme.nodeText
    ctx.fillText(edge.label, mid.x, mid.y)
  }

  ctx.restore()
}

/**
 * 绘制临时连线（connecting/reconnecting 状态时的预览线）
 */
export function drawTempEdge(
  rc: RenderCtx, tc: TempConnection, nodes: Map<string, FlowNode>,
): void {
  const { ctx, viewport, theme } = rc
  const { sourcePos, currentPos, sourceAnchor, previewTargetId, previewTargetAnchor } = tc

  const lineType: LineType = tc.lineType || 'bezier'
  const reconnectEnd = tc.reconnectEnd

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
  ctx.strokeStyle = isSnapped ? theme.edgeSelected : theme.tempEdge
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
      if (reconnectEnd === 'source') {
        drawArrow(ctx, endPoint, sourcePos, scale, true, theme, 'orthogonal')
      } else {
        drawArrow(ctx, p2, endPoint, scale, true, theme, 'bezier')
      }
    }
  } else {
    const path = getOrthogonalPath(sourcePos, sourceAnchor, endPoint, targetDir)
    const cornerRadius = 6 / scale
    strokeOrthogonalPath(ctx, path, cornerRadius)
    ctx.stroke()
    ctx.setLineDash([])
    if (isSnapped) {
      if (reconnectEnd === 'source') {
        drawArrow(ctx, path[1], path[0], scale, true, theme, 'orthogonal')
      } else {
        const lastSegStart = path[path.length - 2]
        const lastSegEnd = path[path.length - 1]
        drawArrow(ctx, lastSegStart, lastSegEnd, scale, true, theme, 'orthogonal')
      }
    }
  }

  if (!isSnapped) {
    ctx.fillStyle = theme.tempEdge
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

/** 绘制箭头 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  pFrom: Point, pTo: Point,
  scale: number, selected: boolean, theme: ThemeColors,
  mode: 'bezier' | 'orthogonal',
): void {
  let angle: number
  if (mode === 'bezier') {
    const tangent = bezierTangent(pFrom, pTo, pFrom, pTo)
    angle = Math.atan2(tangent.y, tangent.x)
  } else {
    angle = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x)
  }
  const arrowSize = 10 / scale

  ctx.save()
  ctx.fillStyle = selected ? theme.edgeSelected : theme.edge
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
export function hitTestEdge(
  point: Point, edges: Map<string, FlowEdge>, nodes: Map<string, FlowNode>,
): FlowEdge | null {
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
      if (distToBezier(point, p0, p1, p2, p3) < EDGE_HIT_THRESHOLD) return edge
    } else {
      const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
      for (let i = 0; i < path.length - 1; i++) {
        if (distToSegment(point, path[i], path[i + 1]) < EDGE_HIT_THRESHOLD) return edge
      }
    }
  }
  return null
}

/**
 * 命中检测：检测点击是否命中选中连线的端点手柄
 */
export function hitTestEdgeEndpoint(
  point: Point, edge: FlowEdge, nodes: Map<string, FlowNode>, viewport: Viewport,
): 'source' | 'target' | null {
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return null

  const hitRadius = ANCHOR_HIT_RADIUS / viewport.scale
  const sourcePos = getAnchorPosition(source, edge.sourceAnchor)
  const targetPos = getAnchorPosition(target, edge.targetAnchor)

  if (Math.hypot(point.x - sourcePos.x, point.y - sourcePos.y) <= hitRadius) return 'source'
  if (Math.hypot(point.x - targetPos.x, point.y - targetPos.y) <= hitRadius) return 'target'
  return null
}

/**
 * 绘制选中连线的端点手柄（idle 状态下显示）
 */
export function drawEdgeEndpoints(
  rc: RenderCtx, edge: FlowEdge, nodes: Map<string, FlowNode>,
  hoveredEdgeEnd: { edgeId: string; end: 'source' | 'target' } | null,
): void {
  const { ctx, viewport, theme } = rc
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return

  const scale = viewport.scale
  const radius = ANCHOR_RADIUS / scale
  const sourcePos = getAnchorPosition(source, edge.sourceAnchor)
  const targetPos = getAnchorPosition(target, edge.targetAnchor)

  ctx.save()
  for (const [end, pos] of [['source', sourcePos], ['target', targetPos]] as const) {
    const isHovered = hoveredEdgeEnd?.edgeId === edge.id && hoveredEdgeEnd?.end === end
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
