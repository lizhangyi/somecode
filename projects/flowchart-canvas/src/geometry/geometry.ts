// geometry/geometry.ts — 几何工具函数（纯函数，无副作用）

import type { Point } from '../core/types'

/** 两点距离 */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 点到线段距离 */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** 点是否在矩形内（矩形由中心+宽高定义） */
export function pointInRect(p: Point, cx: number, cy: number, w: number, h: number): boolean {
  return p.x >= cx - w / 2 && p.x <= cx + w / 2 &&
         p.y >= cy - h / 2 && p.y <= cy + h / 2
}

/** 点是否在圆内 */
export function pointInCircle(p: Point, cx: number, cy: number, r: number): boolean {
  return dist(p, { x: cx, y: cy }) <= r
}

/** 点是否在菱形内（菱形由中心+宽高定义） */
export function pointInDiamond(p: Point, cx: number, cy: number, w: number, h: number): boolean {
  const dx = Math.abs(p.x - cx)
  const dy = Math.abs(p.y - cy)
  return dx / (w / 2) + dy / (h / 2) <= 1
}

/** 生成唯一ID */
export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** clamp */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 将坐标对齐到网格 */
export function snapToGridValue(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}
