/**
 * useGraphInstance —— G6 实例管理
 * 封装 G6 实例创建、销毁、基础渲染（纯 UI 层，不处理业务逻辑）
 * @module composables/useGraphInstance
 */

import { ref, type Ref } from 'vue'
import G6, { type Graph } from '@antv/g6'
import type { GraphData, NodeData, EdgeData } from '../types/graph'

/** 网格 overlay 的 CSS 类名 */
const GRID_CLASS = 'g6-grid-overlay'

/** 节点默认样式 */
const DEFAULT_NODE_STYLE = {
  fill: '#4B7BEC',
  stroke: '#3B6BDB',
  lineWidth: 1,
}

/** 边默认样式 */
const DEFAULT_EDGE_STYLE = {
  stroke: '#A3B1C6',
  lineWidth: 1.5,
  endArrow: {
    path: G6.Arrow.triangle(6, 8, 0),
    fill: '#A3B1C6',
  },
}

/** 自定义节点名称 */
const CUSTOM_NODE_TYPE = 'graph-editor-node'

/**
 * useGraphInstance 返回类型
 */
export interface UseGraphInstanceReturn {
  /** G6 图实例 */
  graphInstance: Ref<Graph | null>
  /** 创建 G6 实例 */
  createGraph: (container: HTMLDivElement, width: number, height: number, options?: {
    mode?: 'edit' | 'display'
    layout?: Record<string, unknown>
    gridSize?: number
  }) => Graph
  /** 销毁 G6 实例 */
  destroyGraph: () => void
  /** 渲染图数据 */
  renderData: (data: GraphData) => void
  /** 获取当前 G6 保存的图数据 */
  getCurrentData: () => GraphData
  /** 适配视图 */
  fitView: (padding?: number | number[]) => void
  /** 导出图片 */
  exportImage: (config?: { backgroundColor?: string; padding?: number | number[] }) => Promise<string>
  /** 一键力导向：清除固定位置，重新执行力导向布局 */
  forceLayout: () => void
}

/** 注册标志 */
let isNodeRegistered = false

/**
 * G6 实例管理 composable
 */
export function useGraphInstance(): UseGraphInstanceReturn {
  const graphInstance = ref<Graph | null>(null) as Ref<Graph | null>

  /**
   * 注册自定义节点（圆角矩形 + 文字标签）
   */
  function registerCustomNode(): void {
    if (isNodeRegistered) return
    isNodeRegistered = true

    G6.registerNode(
      CUSTOM_NODE_TYPE,
      {
        draw(cfg, group) {
          const model = cfg as Record<string, unknown>
          const label = (model.label as string) || ''
          const nodeStyle = (model.style as Record<string, unknown>) || {}
          const fill = (nodeStyle.fill as string) || DEFAULT_NODE_STYLE.fill
          const stroke = (nodeStyle.stroke as string) || DEFAULT_NODE_STYLE.stroke

          // 计算文字宽度
          const textWidth = Math.max(label.length * 14 + 24, 80)
          const rectWidth = textWidth
          const rectHeight = 40
          const radius = 8

          // 圆角矩形
          const rect = group.addShape('rect', {
            attrs: {
              x: -rectWidth / 2,
              y: -rectHeight / 2,
              width: rectWidth,
              height: rectHeight,
              radius,
              fill,
              stroke,
              lineWidth: 2,
              cursor: 'pointer',
            },
            name: 'node-rect',
          })

          // 文字（capture: false 让鼠标事件穿透到下层矩形，确保拖拽可用）
          group.addShape('text', {
            attrs: {
              x: 0,
              y: 0,
              text: label,
              fontSize: 13,
              fontFamily: 'sans-serif',
              fill: '#ffffff',
              textAlign: 'center',
              textBaseline: 'middle',
            },
            name: 'node-label',
            capture: false,
          })

          // 四个锚点圆圈（初始隐藏，悬浮时显示）
          const anchorPositions = [
            { name: 'anchor-top', x: 0, y: -rectHeight / 2 },
            { name: 'anchor-bottom', x: 0, y: rectHeight / 2 },
            { name: 'anchor-left', x: -rectWidth / 2, y: 0 },
            { name: 'anchor-right', x: rectWidth / 2, y: 0 },
          ]

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

          return rect
        },

        /**
         * 更新节点 —— 在原位更新现有图形，避免重影且不丢失状态
         */
        update(cfg, item) {
          const group = item?.getContainer()
          if (!group) return

          const model = cfg as Record<string, unknown>
          const label = (model.label as string) || ''
          const textWidth = Math.max(label.length * 14 + 24, 80)
          const rectHeight = 40

          // 更新矩形尺寸
          const rects = group.findAllByName('node-rect')
          rects.forEach((rect) => {
            rect.attr({
              width: textWidth,
              height: rectHeight,
              x: -textWidth / 2,
              y: -rectHeight / 2,
            })
          })

          // 更新文字内容（只改 text，不新建 shape）
          const texts = group.findAllByName('node-label')
          texts.forEach((text) => {
            text.attr('text', label)
          })

          // 更新锚点位置
          const anchorPositions = [
            { name: 'anchor-top', x: 0, y: -rectHeight / 2 },
            { name: 'anchor-bottom', x: 0, y: rectHeight / 2 },
            { name: 'anchor-left', x: -textWidth / 2, y: 0 },
            { name: 'anchor-right', x: textWidth / 2, y: 0 },
          ]

          anchorPositions.forEach((ap) => {
            const shapes = group.findAllByName(ap.name)
            shapes.forEach((shape) => {
              shape.attr({ x: ap.x, y: ap.y })
            })
          })

          return rects[0]
        },

        /**
         * 处理节点状态变化（hover / selected）
         */
        setState(name, value, item) {
          const group = item?.getContainer()
          if (!group) return

          if (name === 'hover') {
            const top = group.findAllByName('anchor-top')
            const bottom = group.findAllByName('anchor-bottom')
            const left = group.findAllByName('anchor-left')
            const right = group.findAllByName('anchor-right')
            const allAnchors = [...top, ...bottom, ...left, ...right]
            allAnchors.forEach((shape) => {
              shape.attr('opacity', value ? 1 : 0)
            })
          }

          if (name === 'selected') {
            const rects = group.findAllByName('node-rect')
            if (rects.length > 0) {
              rects[0].attr('stroke', value ? '#FF6B35' : '#3B6BDB')
              rects[0].attr('lineWidth', value ? 3 : 2)
            }
          }
        },

        getAnchorPoints() {
          return [
            [0.5, 0],
            [1, 0.5],
            [0.5, 1],
            [0, 0.5],
          ]
        },
      },
      'single-node',
    )
  }

  /**
   * 创建 G6 图实例
   */
  function createGraph(
    container: HTMLDivElement,
    width: number,
    height: number,
    options: { mode?: 'edit' | 'display'; layout?: Record<string, unknown>; gridSize?: number } = {},
  ): Graph {
    const { mode = 'edit', layout: customLayout, gridSize = 20 } = options

    if (graphInstance.value) {
      graphInstance.value.destroy()
      graphInstance.value = null
    }

    // 注册自定义节点
    registerCustomNode()

    const isEditMode = mode === 'edit'

    const defaultLayout = {
      type: 'force',
      preventOverlap: true,
      nodeStrength: -200,
      edgeStrength: 0.1,
      nodeSize: 40,
      linkDistance: 200,
    }

    const layoutConfig = customLayout || defaultLayout

    const defaultNode = {
      type: CUSTOM_NODE_TYPE,
      size: [80, 40],
    }

    const defaultEdge = {
      type: 'line',
      style: DEFAULT_EDGE_STYLE,
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#666',
          fontSize: 11,
        },
      },
    }

    // G6 4.x 的 modes 支持字符串和对象混用
    // 注意：create-edge 与 drag-node 冲突，连线功能在 GraphEditor.vue 中手动实现
    const editModes: string[] = [
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

    const displayModes: string[] = [
      'drag-canvas',
      'zoom-canvas',
    ]

    const graph = new G6.Graph({
      container,
      width,
      height,
      defaultNode,
      defaultEdge,
      modes: {
        default: isEditMode ? editModes : displayModes,
        display: displayModes,
      },
      layout: layoutConfig,
      animate: true,
      fitView: true,
      fitViewPadding: 30,
      minZoom: 0.2,
      maxZoom: 5,
    })

    graphInstance.value = graph

    // 添加网格背景（用 CSS repeating-linear-gradient，插入 canvas 下方）
    if (gridSize > 0) {
      const gridEl = document.createElement('div')
      gridEl.className = GRID_CLASS
      gridEl.style.cssText = [
        'position:absolute;top:0;left:0;width:100%;height:100%;',
        'pointer-events:none;z-index:0;',
        `background-image:`,
        `  repeating-linear-gradient(0deg, transparent, transparent ${gridSize - 1}px, rgba(136,136,136,0.18) ${gridSize - 1}px, rgba(136,136,136,0.18) ${gridSize}px),`,
        `  repeating-linear-gradient(90deg, transparent, transparent ${gridSize - 1}px, rgba(136,136,136,0.18) ${gridSize - 1}px, rgba(136,136,136,0.18) ${gridSize}px);`,
      ].join('\n')
      container.insertBefore(gridEl, container.firstChild)
    }

    return graph
  }

  /**
   * 销毁 G6 实例
   */
  function destroyGraph(): void {
    if (graphInstance.value) {
      // 清理网格 overlay
      const container = graphInstance.value.get('container') as HTMLElement
      if (container) {
        const gridEl = container.querySelector(`.${GRID_CLASS}`)
        if (gridEl) gridEl.remove()
      }
      graphInstance.value.destroy()
      graphInstance.value = null
    }
  }

  /**
   * 渲染图数据到画布
   */
  function renderData(data: GraphData): void {
    if (!graphInstance.value) return

    const graph = graphInstance.value

    graph.clear()

    // 转换节点数据
    const nodes = data.nodes.map((node) => {
      return {
        id: node.id,
        label: node.label,
        x: node.fx ?? node.x,
        y: node.fy ?? node.y,
        fx: node.fx,
        fy: node.fy,
        type: CUSTOM_NODE_TYPE,
        style: node.style || DEFAULT_NODE_STYLE,
        properties: node.properties,
        nodeType: node.type,
      }
    })

    // 转换边数据
    const edges = data.edges.map((edge) => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type || 'line',
        style: edge.style || DEFAULT_EDGE_STYLE,
      }
    })

    graph.data({ nodes, edges })

    // G6 4.x 必须调用 render() 才会实际绘制到画布
    graph.render()
    graph.layout()
    graph.fitView(30)
  }

  /**
   * 获取当前 G6 中保存的图数据
   */
  function getCurrentData(): GraphData {
    if (!graphInstance.value) return { nodes: [], edges: [] }

    const graph = graphInstance.value
    const g6Data = graph.save() as { nodes?: Record<string, unknown>[]; edges?: Record<string, unknown>[] }

    const nodes: NodeData[] = (g6Data.nodes || []).map((n) => {
      return {
        id: n.id as string,
        label: (n.label as string) || '',
        x: n.x as number | undefined,
        y: n.y as number | undefined,
        fx: (n.fx ?? n.x) as number | undefined,
        fy: (n.fy ?? n.y) as number | undefined,
        properties: (n.properties as Record<string, unknown>) || {},
        type: (n.type as string) || CUSTOM_NODE_TYPE,
        style: (n.style as Record<string, unknown>) || {},
      }
    })

    const edges: EdgeData[] = (g6Data.edges || []).map((e) => {
      return {
        id: e.id as string,
        source: e.source as string,
        target: e.target as string,
        type: ((e.type as string) || 'line') as EdgeData['type'],
        label: (e.label as string) || '',
        style: (e.style as Record<string, unknown>) || {},
      }
    })

    return { nodes, edges }
  }

  /**
   * 适配视图 —— 居中显示所有节点
   */
  function fitView(padding?: number | number[]): void {
    if (!graphInstance.value) return
    graphInstance.value.fitView(padding ?? 30)
  }

  /**
   * 导出画布为 PNG 图片
   * G6 4.x 中 downloadFullImage 使用回调模式，这里包装为 Promise
   * @returns Base64 格式的图片数据
   */
  async function exportImage(config?: {
    backgroundColor?: string
    padding?: number | number[]
  }): Promise<string> {
    if (!graphInstance.value) {
      throw new Error('图实例不存在')
    }

    return new Promise<string>((resolve, reject) => {
      try {
        graphInstance.value!.toFullDataURL(
          (dataUrl: string) => {
            resolve(dataUrl)
          },
          'image/png',
          {
            backgroundColor: config?.backgroundColor || '#ffffff',
            padding: config?.padding ?? 30,
          },
        )
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * 一键力导向 —— 打散节点后重新执行力导向布局
   * 注意：此方法不负责持久化位置，调用方应在布局后创建 UpdateNodeCommand
   */
  function forceLayout(): void {
    if (!graphInstance.value) return

    const graph = graphInstance.value
    const nodes = graph.getNodes()
    if (nodes.length === 0) return

    const width = graph.getWidth()
    const height = graph.getHeight()

    // 第一步：清除固定位置，随机打散节点 model 坐标
    nodes.forEach((node) => {
      const model = node.getModel()
      delete model.fx
      delete model.fy
      model.x = Math.random() * (width - 200) + 100
      model.y = Math.random() * (height - 200) + 100
    })

    // 第二步：运行力导向布局（从随机位置开始计算，结果写入 model）
    graph.destroyLayout()
    graph.layout()

    // 第三步：手动把 model 位置同步到画布（layout 只更新了 model，没有触发画布重绘）
    nodes.forEach((node) => {
      const model = node.getModel()
      graph.updateItem(node, { x: model.x as number, y: model.y as number })
    })

    // 第四步：适配视图
    graph.fitView(30)
  }

  return {
    graphInstance,
    createGraph,
    destroyGraph,
    renderData,
    getCurrentData,
    fitView,
    exportImage,
    forceLayout,
  }
}
