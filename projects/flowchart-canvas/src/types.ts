// types.ts — 所有TypeScript类型定义

/** 节点形状类型 */
export type NodeShape = 'rect' | 'round-rect' | 'diamond' | 'circle'

/** 锚点方向 */
export type AnchorDir = 'top' | 'right' | 'bottom' | 'left'

/** 连线类型 */
export type LineType = 'bezier' | 'orthogonal'

/** 流程图节点 */
export interface FlowNode {
  id: string
  shape: NodeShape
  x: number       // 画布坐标（中心点）
  y: number
  width: number
  height: number
  text: string
  color?: string  // 自定义颜色，不设则用主题默认色
}

/** 流程图连线 */
export interface FlowEdge {
  id: string
  sourceId: string
  sourceAnchor: AnchorDir
  targetId: string
  targetAnchor: AnchorDir
  label?: string
  lineType?: LineType  // 不存则默认 bezier（兼容旧数据）
}

/** 视口状态（缩放 + 平移） */
export interface Viewport {
  scale: number    // 1.0 = 100%
  offsetX: number  // 画布平移X（屏幕像素）
  offsetY: number
}

/** 交互状态 */
export type InteractionState =
  | 'idle'
  | 'dragging-node'
  | 'connecting'
  | 'panning'
  | 'editing-text'
  | 'box-selecting'

/** 二维点 */
export interface Point {
  x: number
  y: number
}

/** 命令接口（撤销/重做） */
export interface Command {
  type: string
  do: () => void
  undo: () => void
}

/** 临时连线状态（connecting时） */
export interface TempConnection {
  sourceId: string
  sourceAnchor: AnchorDir
  sourcePos: Point   // 画布坐标
  currentPos: Point  // 画布坐标（鼠标当前位置）
  previewTargetId?: string       // 悬浮目标节点ID
  previewTargetAnchor?: AnchorDir // 预览的最佳目标锚点方向
  lineType?: LineType            // 当前预览的连线类型
}

/** 序列化数据格式 */
export interface FlowchartData {
  version: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  defaultLineType?: LineType
}
