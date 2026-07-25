/**
 * 图数据核心类型定义
 * @module types/graph
 */

/** 节点样式 */
export interface NodeStyle {
  fill?: string
  stroke?: string
  lineWidth?: number
  radius?: number
  /** 节点尺寸：矩形表示高度，圆形表示直径 */
  size?: number
  [key: string]: unknown
}

/** 边样式 */
export interface EdgeStyle {
  stroke?: string
  lineWidth?: number
  lineDash?: number[]
  endArrow?: boolean | { path: string }
  [key: string]: unknown
}

/** 节点数据 */
export interface NodeData {
  id: string
  label: string
  x?: number
  y?: number
  /** 固定 x 坐标（力导向拖拽后写入） */
  fx?: number
  /** 固定 y 坐标（力导向拖拽后写入） */
  fy?: number
  /** 自定义属性（业务数据） */
  properties?: Record<string, unknown>
  /** G6 节点样式 */
  style?: NodeStyle
  /** G6 节点类型 */
  type?: string
}

/** 边类型 */
export type EdgeType = 'line' | 'quadratic' | 'cubic'

/** 边数据 */
export interface EdgeData {
  id: string
  source: string
  target: string
  /** 边线型 */
  type?: EdgeType
  label?: string
  /** G6 边样式 */
  style?: EdgeStyle
}

/** 图数据 */
export interface GraphData {
  nodes: NodeData[]
  edges: EdgeData[]
  /** 数据版本号，用于乐观锁冲突检测 */
  version?: number
}
