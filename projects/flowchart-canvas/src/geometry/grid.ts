// geometry/grid.ts — 背景网格渲染（纯函数）

import type { Viewport, ThemeColors } from '../core/types'
import { GRID_SIZE, GRID_MAJOR_INTERVAL } from './config'

/**
 * 绘制背景网格
 * 调用时 ctx 的变换矩阵应已设置为视口变换
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  theme: ThemeColors,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const left = -viewport.offsetX / viewport.scale
  const top = -viewport.offsetY / viewport.scale
  const right = (canvasWidth - viewport.offsetX) / viewport.scale
  const bottom = (canvasHeight - viewport.offsetY) / viewport.scale

  const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE
  const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE

  ctx.lineWidth = 1 / viewport.scale

  // 细线
  ctx.strokeStyle = theme.grid
  ctx.beginPath()
  for (let x = startX; x <= right; x += GRID_SIZE) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = startY; y <= bottom; y += GRID_SIZE) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()

  // 粗线
  ctx.strokeStyle = theme.gridMajor
  ctx.beginPath()
  const majorStep = GRID_SIZE * GRID_MAJOR_INTERVAL
  const startMajorX = Math.floor(left / majorStep) * majorStep
  const startMajorY = Math.floor(top / majorStep) * majorStep
  for (let x = startMajorX; x <= right; x += majorStep) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = startMajorY; y <= bottom; y += majorStep) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()
}
