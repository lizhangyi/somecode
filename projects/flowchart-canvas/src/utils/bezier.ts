// utils/bezier.ts — 贝塞尔曲线工具

import type { Point, AnchorDir } from '../types'
import { BEZIER_OFFSET, BEZIER_MIN_OFFSET, BEZIER_SAMPLES } from '../config'

/** 锚点方向向量 */
const DIR_VECTORS: Record<AnchorDir, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

/**
 * 计算贝塞尔曲线的控制点
 * 根据锚点方向，控制点沿锚点方向偏移
 */
export function getControlPoints(
  p0: Point,
  p3: Point,
  sourceDir: AnchorDir,
  targetDir: AnchorDir
): { p1: Point; p2: Point } {
  const d = Math.hypot(p3.x - p0.x, p3.y - p0.y)
  const offset = Math.max(d * BEZIER_OFFSET, BEZIER_MIN_OFFSET)

  const sv = DIR_VECTORS[sourceDir]
  const tv = DIR_VECTORS[targetDir]

  return {
    p1: { x: p0.x + sv.x * offset, y: p0.y + sv.y * offset },
    p2: { x: p3.x + tv.x * offset, y: p3.y + tv.y * offset },
  }
}

/**
 * 三次贝塞尔曲线上的点
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
export function cubicBezier(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point
): Point {
  const u = 1 - t
  const uu = u * u
  const uuu = uu * u
  const tt = t * t
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/**
 * 计算贝塞尔曲线在 t=1 时的切线方向（用于箭头朝向）
 */
export function bezierTangent(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point
): Point {
  // 在 t≈1 处的导数方向 ≈ P3 - P2
  return { x: p3.x - p2.x, y: p3.y - p2.y }
}

/**
 * 点到贝塞尔曲线的最小距离（采样法）
 */
export function distToBezier(
  p: Point,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  samples: number = BEZIER_SAMPLES
): number {
  let minDist = Infinity
  let prev = p0
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const curr = cubicBezier(t, p0, p1, p2, p3)
    const d = distToSegmentBasic(p, prev, curr)
    if (d < minDist) minDist = d
    prev = curr
  }
  return minDist
}

/** 基础点到线段距离（不export，内部使用） */
function distToSegmentBasic(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
