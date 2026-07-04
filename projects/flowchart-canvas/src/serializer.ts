// serializer.ts — JSON 序列化/反序列化

import type { FlowchartData } from './types'
import { nodes, edges, viewport, resetViewport, selectNone } from './state'
import { clearHistory } from './history'

const VERSION = '1.0.0'

/**
 * 导出当前流程图为JSON字符串
 */
export function exportJSON(): string {
  const data: FlowchartData = {
    version: VERSION,
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  }
  return JSON.stringify(data, null, 2)
}

/**
 * 从JSON字符串导入流程图
 * 会清空当前数据和历史
 */
export function importJSON(json: string): boolean {
  try {
    const data: FlowchartData = JSON.parse(json)
    if (!data.nodes || !data.edges) return false

    // 清空当前数据
    nodes.clear()
    edges.clear()
    selectNone()
    clearHistory()

    // 导入节点
    for (const node of data.nodes) {
      nodes.set(node.id, node)
    }

    // 导入连线
    for (const edge of data.edges) {
      edges.set(edge.id, edge)
    }

    // 重置视口
    resetViewport()

    return true
  } catch (e) {
    console.error('导入JSON失败:', e)
    return false
  }
}

/**
 * 导出为文件并下载
 */
export function downloadJSON(filename: string = 'flowchart.json') {
  const json = exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
