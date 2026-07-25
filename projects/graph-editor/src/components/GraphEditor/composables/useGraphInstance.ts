/**
 * useGraphInstance —— G6 实例管理（编排层）
 * 仅负责 G6 实例的创建 / 销毁 / 渲染 / 数据读取 / 视图工具，
 * 具体关注点已分离：
 *  - graphConfig.ts      共享常量与默认配置
 *  - gridOverlay.ts      网格背景创建 / 移除
 *  - registerGraphNodes.ts 节点注册（矩形 / 圆形，基于内置 rect / circle 增强）
 * @module composables/useGraphInstance
 */

import { ref, type Ref } from 'vue'
import G6, { type Graph } from '@antv/g6'
import type { GraphData, NodeData, EdgeData } from '../types/graph'
import {
  RECT_NODE_TYPE,
  CIRCLE_NODE_TYPE,
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_LAYOUT,
  DEFAULT_NODE,
  DEFAULT_EDGE,
  EDGE_STATE_STYLES,
  EDIT_MODES,
  DISPLAY_MODES,
  type NodeShape,
} from './graphConfig'
import { createGridOverlay, removeGridOverlay } from './gridOverlay'
import { registerRectNode, registerCircleNode } from './registerGraphNodes'

export type { NodeShape } from './graphConfig'

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
  renderData: (data: GraphData, nodeShape?: NodeShape) => void
  /** 获取当前 G6 保存的图数据 */
  getCurrentData: () => GraphData
  /** 适配视图 */
  fitView: (padding?: number | number[]) => void
  /** 导出图片 */
  exportImage: (config?: { backgroundColor?: string; padding?: number | number[] }) => Promise<string>
  /** 一键力导向：清除固定位置，重新执行力导向布局 */
  forceLayout: () => void
}

/**
 * G6 实例管理 composable
 */
export function useGraphInstance(): UseGraphInstanceReturn {
  const graphInstance = ref<Graph | null>(null) as Ref<Graph | null>

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

    // 注册节点（矩形 / 圆形，均基于内置形状增强）
    registerRectNode()
    registerCircleNode()

    const isEditMode = mode === 'edit'
    const layoutConfig = customLayout || DEFAULT_LAYOUT

    const graph = new G6.Graph({
      container,
      width,
      height,
      defaultNode: DEFAULT_NODE,
      defaultEdge: DEFAULT_EDGE,
      edgeStateStyles: EDGE_STATE_STYLES,
      modes: {
        default: isEditMode ? EDIT_MODES : DISPLAY_MODES,
        display: DISPLAY_MODES,
      },
      layout: layoutConfig,
      animate: true,
      fitView: false,
      fitViewPadding: 30,
      minZoom: 0.2,
      maxZoom: 5,
    })

    graphInstance.value = graph

    // 添加网格背景（CSS repeating-linear-gradient，详见 gridOverlay.ts）
    if (gridSize > 0) {
      createGridOverlay(container, gridSize)
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
      if (container) removeGridOverlay(container)
      graphInstance.value.destroy()
      graphInstance.value = null
    }
  }

  /**
   * 渲染图数据到画布
   */
  function renderData(data: GraphData, nodeShape?: NodeShape): void {
    if (!graphInstance.value) return

    const graph = graphInstance.value

    graph.clear()

    const nodeType = nodeShape === 'circle' ? CIRCLE_NODE_TYPE : RECT_NODE_TYPE

    // 转换节点数据
    const nodes = data.nodes.map((node) => {
      return {
        id: node.id,
        label: node.label,
        x: node.fx ?? node.x,
        y: node.fy ?? node.y,
        fx: node.fx,
        fy: node.fy,
        type: nodeType,
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
        label: edge.label || undefined,
        type: edge.type || 'line',
        style: edge.style || DEFAULT_EDGE_STYLE,
      }
    })

    graph.data({ nodes, edges })

    // G6 4.x 必须调用 render() 才会实际绘制到画布
    graph.render()
    graph.layout()
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
        type: (n.type as string) || RECT_NODE_TYPE,
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
