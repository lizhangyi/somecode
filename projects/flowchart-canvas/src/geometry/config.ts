// geometry/config.ts — 常量配置

import type { NodeShape } from '../core/types'

/** 节点默认尺寸 */
export const DEFAULT_NODE_SIZE: Record<NodeShape, { width: number; height: number }> = {
  rect: { width: 120, height: 60 },
  'round-rect': { width: 120, height: 50 },
  diamond: { width: 140, height: 80 },
  circle: { width: 80, height: 80 },
}

/** 节点默认颜色 */
export const NODE_COLORS: Record<NodeShape, string> = {
  rect: '#4e7eff',
  'round-rect': '#00b894',
  diamond: '#fdcb6e',
  circle: '#a29bfe',
}

/** 锚点半径（屏幕像素） */
export const ANCHOR_RADIUS = 6

/** 锚点命中半径（屏幕像素，比视觉大一些方便点击） */
export const ANCHOR_HIT_RADIUS = 12

/** 连线命中阈值（画布坐标） */
export const EDGE_HIT_THRESHOLD = 8

/** 节点最小尺寸 */
export const MIN_NODE_WIDTH = 40
export const MIN_NODE_HEIGHT = 30

/** Resize 手柄大小（屏幕像素） */
export const RESIZE_HANDLE_SIZE = 8
/** Resize 手柄命中大小（屏幕像素） */
export const RESIZE_HANDLE_HIT_SIZE = 14

/** 缩放范围默认值 */
export const DEFAULT_MIN_SCALE = 0.2
export const DEFAULT_MAX_SCALE = 3.0

/** 缩放步进（按钮缩放） */
export const ZOOM_STEP = 0.1

/** 网格基础大小（画布坐标） */
export const GRID_SIZE = 20

/** 网格主线间隔（每隔多少条画一条粗线） */
export const GRID_MAJOR_INTERVAL = 5

/** 贝塞尔曲线控制点偏移系数 */
export const BEZIER_OFFSET = 0.5

/** 贝塞尔曲线最小控制点偏移 */
export const BEZIER_MIN_OFFSET = 40

/** 贝塞尔曲线命中检测采样数 */
export const BEZIER_SAMPLES = 30

/** 历史栈最大长度 */
export const HISTORY_MAX = 50

/** 文字字体 */
export const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
export const FONT_SIZE = 14

/** 节点ID前缀 */
export const NODE_ID_PREFIX = 'node-'

/** 连线ID前缀 */
export const EDGE_ID_PREFIX = 'edge-'

/** 序列化版本号 */
export const DATA_VERSION = '1.1.0'
