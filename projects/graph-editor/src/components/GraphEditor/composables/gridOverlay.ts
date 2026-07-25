/**
 * gridOverlay —— 画布网格背景（CSS repeating-linear-gradient）
 * 网格 div 始终 100% 铺满容器，平移用 background-position、缩放用周期(gridSize*zoom) 体现，
 * 避免有限尺寸 div 在平移 / 缩放后露出边缘白边。
 * @module composables/gridOverlay
 */

import { GRID_CLASS } from './graphConfig'

/**
 * 创建网格 overlay，插入到容器首个子节点之前（位于画布底层）
 * @param container 画布容器元素
 * @param gridSize 网格间距（像素，zoom=1 时的周期）
 */
export function createGridOverlay(container: HTMLElement, gridSize: number): void {
  const gridEl = document.createElement('div')
  gridEl.className = GRID_CLASS
  gridEl.style.cssText = [
    'position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;',
    'pointer-events:none;z-index:0;',
  ].join('\n')
  // 初始背景（zoom=1 时周期 = gridSize），viewportchange 会按缩放动态更新
  const p = gridSize
  gridEl.style.backgroundImage = [
    `repeating-linear-gradient(0deg, transparent, transparent ${p - 1}px, rgba(136,136,136,0.18) ${p - 1}px, rgba(136,136,136,0.18) ${p}px)`,
    `repeating-linear-gradient(90deg, transparent, transparent ${p - 1}px, rgba(136,136,136,0.18) ${p - 1}px, rgba(136,136,136,0.18) ${p}px)`,
  ].join(',')
  gridEl.style.backgroundPosition = '0 0'
  container.style.overflow = 'hidden'
  container.insertBefore(gridEl, container.firstChild)
}

/**
 * 移除网格 overlay
 * @param container 画布容器元素
 */
export function removeGridOverlay(container: HTMLElement): void {
  const gridEl = container.querySelector(`.${GRID_CLASS}`)
  if (gridEl) gridEl.remove()
}
