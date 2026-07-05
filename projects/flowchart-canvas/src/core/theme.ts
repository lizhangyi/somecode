// core/theme.ts — 主题系统（方案 C：预设字符串或自定义颜色对象）

import type { ThemeColors, ThemeOption } from './types'

/** 深色主题预设 */
export const THEME_DARK: ThemeColors = {
  background: '#1a1a2e',
  grid: 'rgba(255, 255, 255, 0.04)',
  gridMajor: 'rgba(255, 255, 255, 0.08)',
  nodeFill: 'rgba(30, 30, 60, 0.9)',
  nodeStroke: '#4e7eff',
  nodeText: '#e0e0e0',
  edge: 'rgba(120, 120, 180, 0.6)',
  edgeSelected: '#4e7eff',
  anchor: '#4e7eff',
  anchorHover: '#00d4ff',
  tempEdge: 'rgba(78, 126, 255, 0.5)',
  selectedOutline: '#00d4ff',
  selectionBox: 'rgba(0, 212, 255, 0.1)',
  selectionBoxBorder: 'rgba(0, 212, 255, 0.4)',
}

/** 浅色主题预设 */
export const THEME_LIGHT: ThemeColors = {
  background: '#f5f6fa',
  grid: 'rgba(0, 0, 0, 0.05)',
  gridMajor: 'rgba(0, 0, 0, 0.1)',
  nodeFill: 'rgba(255, 255, 255, 0.92)',
  nodeStroke: '#4e7eff',
  nodeText: '#333333',
  edge: 'rgba(80, 80, 100, 0.5)',
  edgeSelected: '#4e7eff',
  anchor: '#4e7eff',
  anchorHover: '#0099cc',
  tempEdge: 'rgba(78, 126, 255, 0.5)',
  selectedOutline: '#0099cc',
  selectionBox: 'rgba(0, 153, 204, 0.1)',
  selectionBoxBorder: 'rgba(0, 153, 204, 0.4)',
}

/**
 * 解析主题选项 → 实际颜色对象
 * - 'dark'  → 深色预设
 * - 'light' → 浅色预设
 * - ThemeColors 对象 → 直接使用（自定义）
 */
export function resolveTheme(option: ThemeOption): ThemeColors {
  if (option === 'dark') return { ...THEME_DARK }
  if (option === 'light') return { ...THEME_LIGHT }
  return { ...option } // 自定义颜色对象
}
