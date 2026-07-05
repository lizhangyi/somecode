// core/types.ts — 公共类型定义 + 内部类型

// ============================================================
//  公共类型（通过 index.ts 导出给使用者）
// ============================================================

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
  lineType?: LineType  // 不存则默认 bezier
}

/** 视口状态（缩放 + 平移） */
export interface Viewport {
  scale: number    // 1.0 = 100%
  offsetX: number  // 画布平移X（屏幕像素）
  offsetY: number
}

/** 二维点 */
export interface Point {
  x: number
  y: number
}

/** 序列化数据格式 */
export interface FlowchartData {
  version: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  defaultLineType?: LineType
}

/** 主题颜色对象 */
export interface ThemeColors {
  background: string
  grid: string
  gridMajor: string
  nodeFill: string
  nodeStroke: string
  nodeText: string
  edge: string
  edgeSelected: string
  anchor: string
  anchorHover: string
  tempEdge: string
  selectedOutline: string
  selectionBox: string
  selectionBoxBorder: string
}

/** 主题选项：预设字符串或自定义颜色对象 */
export type ThemeOption = 'dark' | 'light' | ThemeColors

/** Flowchart 构造选项 */
export interface FlowchartOptions {
  /** 主题，默认 'dark' */
  theme?: ThemeOption
  /** 是否启用网格对齐，默认 true */
  snapToGrid?: boolean
  /** 默认连线类型，默认 'bezier' */
  defaultLineType?: LineType
  /** 是否启用右键菜单，默认 true */
  contextMenu?: boolean
  /** 是否启用双击文字编辑，默认 true */
  textEditor?: boolean
  /** 最小缩放，默认 0.2 */
  minScale?: number
  /** 最大缩放，默认 3.0 */
  maxScale?: number
}

/** 导出图片背景模式 */
export type ExportBackground = 'grid' | 'transparent'

/** 导出图片选项 */
export interface ExportImageOptions {
  /** 背景模式：'grid' 带网格背景，'transparent' 透明背景，默认 'grid' */
  background?: ExportBackground
  /** 导出倍率，1 = 原始 CSS 尺寸，2 = 2x 高清，默认 1 */
  scale?: number
}

/** SVG 导出选项 */
export interface ExportSVGOptions {
  /** 背景模式：'grid' 带网格背景，'transparent' 透明背景，默认 'transparent' */
  background?: ExportBackground
  /** 内容边距（画布坐标），默认 40 */
  padding?: number
}

// ============================================================
//  事件映射
// ============================================================

export interface EventMap {
  /** 添加节点 */
  'node:add': { node: FlowNode }
  /** 删除节点 */
  'node:remove': { id: string }
  /** 更新节点 */
  'node:update': { node: FlowNode; changes: Partial<FlowNode> }
  /** 添加连线 */
  'edge:add': { edge: FlowEdge }
  /** 删除连线 */
  'edge:remove': { id: string }
  /** 选中变化 */
  'selection:change': { selectedIds: string[] }
  /** 视口变化 */
  'viewport:change': { viewport: Viewport }
  /** 数据脏标记（需要持久化） */
  'dirty': void
  /** 主题变化 */
  'theme:change': { theme: ThemeColors }
  /** 历史栈变化 */
  'history:change': { canUndo: boolean; canRedo: boolean }
  /** 实例销毁 */
  'destroy': void
}

// ============================================================
//  内部类型（不导出给使用者）
// ============================================================

/** 渲染上下文（内部使用，打包 ctx + viewport + theme） */
export interface RenderCtx {
  ctx: CanvasRenderingContext2D
  viewport: Viewport
  theme: ThemeColors
}

/** 交互状态 */
export type InteractionState =
  | 'idle'
  | 'dragging-node'
  | 'connecting'
  | 'reconnecting'
  | 'panning'
  | 'editing-text'
  | 'box-selecting'
  | 'resizing'

/** Resize 手柄位置 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** 命令接口（撤销/重做） */
export interface Command {
  type: string
  do: () => void
  undo: () => void
}

/** 临时连线状态（connecting / reconnecting 时） */
export interface TempConnection {
  sourceId: string
  sourceAnchor: AnchorDir
  sourcePos: Point   // 画布坐标
  currentPos: Point  // 画布坐标（鼠标当前位置）
  previewTargetId?: string       // 悬浮目标节点ID
  previewTargetAnchor?: AnchorDir // 预览的最佳目标锚点方向
  lineType?: LineType            // 当前预览的连线类型
  reconnectEnd?: 'source' | 'target' // 重连时标记拖拽的是哪一端
}
