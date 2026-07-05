// engine/canvas.ts — Canvas 辅助：DPI 适配 + 坐标系转换（实例化，不导出全局变量）

import type { Viewport, Point } from '../core/types'

/**
 * Canvas 辅助类
 * 封装 DPR 适配、尺寸管理、坐标转换、变换矩阵设置
 */
export class CanvasHelper {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private resizeHandler: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.dpr = window.devicePixelRatio || 1
    this.resizeCanvas()
    this.resizeHandler = () => this.resizeCanvas()
    window.addEventListener('resize', this.resizeHandler)
  }

  /** 调整 Canvas 尺寸（DPR 适配） */
  resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
  }

  /** 获取 Canvas 的 CSS 尺寸（不含 DPR） */
  getCanvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  /** 获取当前 DPR */
  getDPR(): number {
    return this.dpr
  }

  /**
   * 屏幕坐标 → 画布坐标
   * 考虑 DPR、缩放和平移
   */
  screenToCanvas(screenX: number, screenY: number, viewport: Viewport): Point {
    const rect = this.canvas.getBoundingClientRect()
    const cssX = screenX - rect.left
    const cssY = screenY - rect.top
    return {
      x: (cssX - viewport.offsetX) / viewport.scale,
      y: (cssY - viewport.offsetY) / viewport.scale,
    }
  }

  /**
   * 画布坐标 → 屏幕坐标（CSS 像素，不含 DPR）
   */
  canvasToScreen(canvasX: number, canvasY: number, viewport: Viewport): Point {
    return {
      x: canvasX * viewport.scale + viewport.offsetX,
      y: canvasY * viewport.scale + viewport.offsetY,
    }
  }

  /**
   * 设置 Canvas 变换矩阵（仅 DPR）
   * 用于绘制屏幕坐标系的内容（背景、框选矩形）
   */
  applyTransform(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /**
   * 设置带视口的 Canvas 变换
   * 用于绘制画布坐标系的内容（节点、连线、网格）
   */
  applyViewportTransform(viewport: Viewport): void {
    this.ctx.setTransform(
      this.dpr * viewport.scale, 0,
      0, this.dpr * viewport.scale,
      this.dpr * viewport.offsetX,
      this.dpr * viewport.offsetY,
    )
  }

  /** 销毁，移除事件监听 */
  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler)
  }
}
