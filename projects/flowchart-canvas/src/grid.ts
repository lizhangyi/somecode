// grid.ts — 背景网格渲染

import { ctx } from './canvas'
import { viewport } from './state'
import { GRID_SIZE, GRID_MAJOR_INTERVAL, THEME } from './config'

/**
 * 绘制背景网格
 * 注意：调用此函数时，ctx的变换矩阵应已设置为视口变换（applyViewportTransform）
 * 网格在画布坐标系中绘制，随缩放和平移自然变化
 */
export function drawGrid(canvasWidth: number, canvasHeight: number) {
  // 计算可见区域的画布坐标范围
  const left = -viewport.offsetX / viewport.scale
  const top = -viewport.offsetY / viewport.scale
  const right = (canvasWidth - viewport.offsetX) / viewport.scale
  const bottom = (canvasHeight - viewport.offsetY) / viewport.scale

  // 找到起始网格线（对齐到网格）
  const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE
  const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE

  ctx.lineWidth = 1 / viewport.scale  // 保持视觉线宽一致

  // 细线
  ctx.strokeStyle = THEME.grid
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

  // 粗线（每GRID_MAJOR_INTERVAL条一条）
  ctx.strokeStyle = THEME.gridMajor
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
