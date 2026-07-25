/**
 * graphConfig —— G6 图实例的共享常量与默认配置
 * 从 useGraphInstance 抽出，避免单个文件职责混杂、体积过大。
 * @module composables/graphConfig
 */

import G6 from '@antv/g6'

/** 网格 overlay 的 CSS 类名 */
export const GRID_CLASS = 'g6-grid-overlay'

/** 节点默认样式 */
export const DEFAULT_NODE_STYLE = {
  fill: '#4B7BEC',
  stroke: '#3B6BDB',
  lineWidth: 1,
}

/** 边默认样式 */
export const DEFAULT_EDGE_STYLE = {
  stroke: '#A3B1C6',
  lineWidth: 1.5,
  endArrow: {
    path: G6.Arrow.triangle(6, 8, 0),
    fill: '#A3B1C6',
  },
}

/**
 * 节点类型名（均基于 G6 内置形状增强，并非从零自定义的形状）：
 *  - RECT_NODE_TYPE：以内置 rect 为主形状，额外绘制连接锚点与标签、处理高亮态
 *  - CIRCLE_NODE_TYPE：以内置 circle 为主形状，同上
 */
export const RECT_NODE_TYPE = 'graph-editor-rect'
export const CIRCLE_NODE_TYPE = 'graph-editor-circle-node'

/** 节点形状类型 */
export type NodeShape = 'rect' | 'circle'

/** 默认力导向布局 */
export const DEFAULT_LAYOUT = {
  type: 'force',
  preventOverlap: true,
  nodeStrength: -200,
  edgeStrength: 0.1,
  nodeSize: 40,
  linkDistance: 200,
}

/** 默认节点配置（默认形状为矩形，基于内置 rect 增强） */
export const DEFAULT_NODE = {
  type: RECT_NODE_TYPE,
  size: [80, 40] as [number, number],
}

/** 默认边配置 */
export const DEFAULT_EDGE = {
  type: 'line',
  style: DEFAULT_EDGE_STYLE,
  labelCfg: {
    autoRotate: true,
    style: {
      fill: '#666',
      fontSize: 11,
      background: {
        fill: '#ffffff',
        padding: [2, 4, 2, 4],
        radius: 2,
      },
    },
  },
}

/** 边的高亮状态样式（搜索 / 路径定位时高亮与目标相连的连线） */
export const EDGE_STATE_STYLES = {
  'search-highlight': {
    stroke: '#FFB400',
    lineWidth: 3,
    shadowColor: '#FFB400',
    shadowBlur: 8,
  },
  'path-highlight': {
    stroke: '#22C55E',
    lineWidth: 3,
    shadowColor: '#22C55E',
    shadowBlur: 8,
  },
}

/**
 * 编辑模式交互（字符串与对象混用；brush-select 用 shift 触发框选）
 * 注意：create-edge 与 drag-node 冲突，连线功能在 GraphEditor.vue 中手动实现
 */
export const EDIT_MODES = [
  'drag-canvas',
  'zoom-canvas',
  'drag-node',
  {
    type: 'brush-select',
    trigger: 'shift',
    brushStyle: {
      fill: '#4B7BEC',
      fillOpacity: 0.1,
      stroke: '#4B7BEC',
    },
  } as unknown as string,
]

/** 展示（只读）模式交互 */
export const DISPLAY_MODES = [
  'drag-canvas',
  'zoom-canvas',
]
