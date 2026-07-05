// index.ts — 公共 API 导出入口

// 主类
export { Flowchart } from './core/flowchart'

// 类型
export type {
  NodeShape,
  AnchorDir,
  LineType,
  FlowNode,
  FlowEdge,
  Viewport,
  Point,
  FlowchartData,
  ThemeColors,
  ThemeOption,
  FlowchartOptions,
  EventMap,
} from './core/types'

// 主题预设
export { THEME_DARK, THEME_LIGHT, resolveTheme } from './core/theme'

// 事件系统
export { EventEmitter } from './core/event-emitter'

// 状态类（高级用户可直接操作）
export { FlowchartState } from './core/state'

// 常量 & 工具函数
export { NODE_COLORS, ZOOM_STEP, DEFAULT_NODE_SIZE, GRID_SIZE } from './geometry/config'
export { clamp } from './geometry/geometry'
