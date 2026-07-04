// canvas.ts — Canvas初始化 + DPI适配 + 坐标系转换

import { viewport } from './state'

export let canvas: HTMLCanvasElement
export let ctx: CanvasRenderingContext2D
let dpr = 1

/** 初始化Canvas，设置DPR适配 */
export function initCanvas(canvasEl: HTMLCanvasElement) {
  canvas = canvasEl
  ctx = canvas.getContext('2d')!
  dpr = window.devicePixelRatio || 1
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
}

/** 调整Canvas尺寸（DPR适配） */
export function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
}

/** 获取Canvas的CSS尺寸（不含DPR） */
export function getCanvasSize(): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

/**
 * 屏幕坐标 → 画布坐标
 * 考虑DPR、缩放和平移
 */
export function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  // 先减去canvas在页面中的偏移
  const cssX = screenX - rect.left
  const cssY = screenY - rect.top
  // 再减去视口偏移并除以缩放
  return {
    x: (cssX - viewport.offsetX) / viewport.scale,
    y: (cssY - viewport.offsetY) / viewport.scale,
  }
}

/**
 * 画布坐标 → 屏幕坐标（CSS像素，不含DPR）
 */
export function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
  return {
    x: canvasX * viewport.scale + viewport.offsetX,
    y: canvasY * viewport.scale + viewport.offsetY,
  }
}

/**
 * 设置Canvas变换矩阵
 * 在每帧渲染前调用，自动处理DPR + 视口缩放 + 平移
 */
export function applyTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * 设置带视口的Canvas变换
 * 用于绘制画布坐标系的内容（节点、连线、网格）
 */
export function applyViewportTransform() {
  // 先应用DPR，再应用视口变换
  ctx.setTransform(
    dpr * viewport.scale, 0,
    0, dpr * viewport.scale,
    dpr * viewport.offsetX,
    dpr * viewport.offsetY
  )
}

/** 获取当前DPR */
export function getDPR(): number {
  return dpr
}
