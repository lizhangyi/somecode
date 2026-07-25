/**
 * registerGraphNodes —— 节点注册（矩形 / 圆形，基于 G6 内置形状增强）
 *
 * 矩形与圆形本就是 G6 的内置形状，这里并非从零发明新形状，而是对内置
 * rect / circle 做「增强」：在内置主形状之上额外绘制 4 个连接锚点圆圈、
 * 标签，并处理 hover / selected / search-highlight / path-highlight 高亮态。
 *
 * 之所以必须保留这段注册而非直接用内置 type:'rect'/'circle'：拖拽建边功能
 * （setupCustomEdgeCreation）监听 node:mousedown 且只在命中 anchor-* 形状时
 * 才拉线，而锚点圆圈由本文件的 draw 绘制——内置 rect/circle 不含这些锚点，
 * 因此无法简单替换为纯内置类型。
 *
 * 两种节点的差异仅在于几何（主形状类型、尺寸、标签位置、锚点位置），其余
 * draw / update / setState 逻辑完全一致，故用 createEditorNode 工厂抽取共用。
 * @module composables/registerGraphNodes
 */

import G6, { type ModelConfig, type IGroup, type IShape, type Item } from '@antv/g6'
import {
  RECT_NODE_TYPE,
  CIRCLE_NODE_TYPE,
  DEFAULT_NODE_STYLE,
} from './graphConfig'

/** 主形状几何：尺寸属性 + 标签属性 + 四个锚点位置（均不含 style 颜色） */
interface EditorNodeGeometry {
  /** 主形状属性（x/y/width/height 或 r），不含 fill/stroke/lineWidth */
  mainAttrs: Record<string, unknown>
  /** 标签属性（x/y/fill/textBaseline 等），不含 text 文本本身 */
  labelAttrs: Record<string, unknown>
  /** 四个锚点位置 */
  anchorPositions: { name: string; x: number; y: number }[]
}

/** 一种自定义节点的差异化参数 */
interface EditorNodeOptions {
  /** 注册到 G6 的节点类型名 */
  typeName: string
  /** 主形状的 name（用于 findAllByName 定位） */
  mainShapeName: string
  /** 主形状类型 */
  mainShapeType: 'rect' | 'circle'
  /** 矩形默认高度 / 圆形默认直径 */
  defaultSize: number
  /** 给定 size 与 label 计算几何属性 */
  geometry: (size: number, label: string) => EditorNodeGeometry
}

const ANCHOR_NAMES = ['anchor-top', 'anchor-bottom', 'anchor-left', 'anchor-right'] as const

/**
 * 生成自定义节点的 ShapeOptions（矩形与圆形共用同一套 draw/update/setState 逻辑）
 */
function createEditorNodeConfig(opts: EditorNodeOptions) {
  const { mainShapeName, mainShapeType, defaultSize, geometry } = opts

  const draw = (cfg: ModelConfig, group: IGroup): IShape => {
    const model = cfg as Record<string, unknown>
    const label = (model.label as string) || ''
    const nodeStyle = (model.style as Record<string, unknown>) || {}
    const fill = (nodeStyle.fill as string) || DEFAULT_NODE_STYLE.fill
    const stroke = (nodeStyle.stroke as string) || DEFAULT_NODE_STYLE.stroke
    const size = (nodeStyle.size as number) || defaultSize
    const { mainAttrs, labelAttrs, anchorPositions } = geometry(size, label)

    const main = group.addShape(mainShapeType, {
      attrs: { ...mainAttrs, fill, stroke, lineWidth: 2, cursor: 'pointer' },
      name: mainShapeName,
    })

    // 文字（capture: false 让鼠标事件穿透到下层主形状，确保拖拽可用）
    group.addShape('text', {
      attrs: {
        ...labelAttrs,
        text: label,
        fontSize: 13,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
      name: 'node-label',
      capture: false,
    })

    // 四个锚点圆圈（初始隐藏，悬浮时显示）
    anchorPositions.forEach((ap) => {
      group.addShape('circle', {
        attrs: {
          x: ap.x,
          y: ap.y,
          r: 5,
          fill: '#ffffff',
          stroke: '#4B7BEC',
          lineWidth: 2,
          opacity: 0,
          cursor: 'crosshair',
        },
        name: ap.name,
      })
    })

    return main
  }

  const update = (cfg: ModelConfig, item: Item): void => {
    const group = item?.getContainer()
    if (!group) return

    const model = cfg as Record<string, unknown>
    const nodeStyle = (model.style as Record<string, unknown>) || {}
    const label = (model.label as string) || ''
    const size = (nodeStyle.size as number) || defaultSize
    const fill = (nodeStyle.fill as string) || DEFAULT_NODE_STYLE.fill
    const stroke = (nodeStyle.stroke as string) || DEFAULT_NODE_STYLE.stroke
    const selected = item?.hasState?.('selected') || false
    const { mainAttrs, labelAttrs, anchorPositions } = geometry(size, label)

    // 更新主形状尺寸与颜色
    const mains = group.findAllByName(mainShapeName)
    mains.forEach((shape) => {
      shape.attr({ ...mainAttrs, fill })
      // 选中态下保留橙色边框，不覆盖用户自定义描边
      if (!selected) shape.attr({ stroke, lineWidth: 1 })
    })

    // 更新文字内容（只改 text 与 y，不新建 shape）
    const texts = group.findAllByName('node-label')
    texts.forEach((text) => {
      text.attr({ text: label, y: labelAttrs.y as number })
    })

    // 更新锚点位置
    anchorPositions.forEach((ap) => {
      const shapes = group.findAllByName(ap.name)
      shapes.forEach((shape) => shape.attr({ x: ap.x, y: ap.y }))
    })
  }

  const setState = (name?: string, value?: string | boolean, item?: Item): void => {
    const group = item?.getContainer()
    if (!group || !name) return

    if (name === 'hover') {
      const anchors = ANCHOR_NAMES.flatMap((n) => group.findAllByName(n))
      anchors.forEach((shape) => shape.attr('opacity', value ? 1 : 0))
    }

    if (name === 'selected') {
      const mains = group.findAllByName(mainShapeName)
      if (mains.length > 0) {
        const model = item?.getModel() as Record<string, unknown>
        const style = (model.style as Record<string, unknown>) || {}
        const baseStroke = (style.stroke as string) || DEFAULT_NODE_STYLE.stroke
        mains[0].attr('stroke', value ? '#FF6B35' : baseStroke)
        mains[0].attr('lineWidth', value ? 3 : 2)
      }
    }

    if (name === 'search-highlight') {
      const mains = group.findAllByName(mainShapeName)
      if (mains.length > 0) {
        mains[0].attr('shadowColor', value ? '#FFB400' : 'transparent')
        mains[0].attr('shadowBlur', value ? 14 : 0)
      }
    }

    if (name === 'path-highlight') {
      const mains = group.findAllByName(mainShapeName)
      if (mains.length > 0) {
        mains[0].attr('shadowColor', value ? '#22C55E' : 'transparent')
        mains[0].attr('shadowBlur', value ? 16 : 0)
        mains[0].attr('lineWidth', value ? 3 : 1)
      }
    }
  }

  const getAnchorPoints = (): number[][] => [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ]

  return { draw, update, setState, getAnchorPoints }
}

/** 矩形节点几何：基于内置 rect 增强，size 控制矩形高度，宽度取文字宽与高度较大者（避免过窄） */
const editorRectNode = createEditorNodeConfig({
  typeName: RECT_NODE_TYPE,
  mainShapeName: 'node-rect',
  mainShapeType: 'rect',
  defaultSize: 40,
  geometry: (size, label) => {
    const rectHeight = size
    const rectWidth = Math.max(label.length * 14 + 24, rectHeight)
    const radius = 8
    return {
      mainAttrs: {
        x: -rectWidth / 2,
        y: -rectHeight / 2,
        width: rectWidth,
        height: rectHeight,
        radius,
      },
      labelAttrs: {
        x: 0,
        y: 0,
        fill: '#ffffff',
        textBaseline: 'middle',
      },
      anchorPositions: [
        { name: 'anchor-top', x: 0, y: -rectHeight / 2 },
        { name: 'anchor-bottom', x: 0, y: rectHeight / 2 },
        { name: 'anchor-left', x: -rectWidth / 2, y: 0 },
        { name: 'anchor-right', x: rectWidth / 2, y: 0 },
      ],
    }
  },
})

/** 圆形节点几何：基于内置 circle 增强，size 控制圆形直径，文字置于下方 */
const editorCircleNode = createEditorNodeConfig({
  typeName: CIRCLE_NODE_TYPE,
  mainShapeName: 'node-circle',
  mainShapeType: 'circle',
  defaultSize: 50,
  geometry: (size, label) => {
    const radius = size / 2
    const textOffset = radius + 8
    return {
      mainAttrs: {
        x: 0,
        y: 0,
        r: radius,
      },
      labelAttrs: {
        x: 0,
        y: textOffset,
        fill: '#1a1a1a',
        textBaseline: 'top',
      },
      anchorPositions: [
        { name: 'anchor-top', x: 0, y: -radius },
        { name: 'anchor-bottom', x: 0, y: radius },
        { name: 'anchor-left', x: -radius, y: 0 },
        { name: 'anchor-right', x: radius, y: 0 },
      ],
    }
  },
})

let isRectRegistered = false
let isCircleNodeRegistered = false

/**
 * 注册矩形节点（基于内置 rect 增强：圆角矩形 + 文字标签 + 连接锚点 + 高亮态）
 * 注意：矩形是 G6 内置形状，这里只是增强而非从零自定义。
 */
export function registerRectNode(): void {
  if (isRectRegistered) return
  isRectRegistered = true
  G6.registerNode(RECT_NODE_TYPE, editorRectNode, 'single-node')
}

/**
 * 注册圆形节点（基于内置 circle 增强：固定大小圆形 + 文字在下方 + 连接锚点 + 高亮态）
 */
export function registerCircleNode(): void {
  if (isCircleNodeRegistered) return
  isCircleNodeRegistered = true
  G6.registerNode(CIRCLE_NODE_TYPE, editorCircleNode, 'single-node')
}
