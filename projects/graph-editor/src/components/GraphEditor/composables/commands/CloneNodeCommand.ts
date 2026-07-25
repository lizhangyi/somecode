/**
 * 克隆节点命令
 * 复制源节点的标签 / 样式 / 属性 / 类型，并施加固定偏移，生成新节点。
 * 新节点写入 fx/fy 锁定位置，避免力导向布局回弹（与 AddNodeCommand 行为一致）。
 */
import type { Graph } from '@antv/g6'
import { cloneDeep } from 'lodash-es'
import type { ICommand, Operation } from '../../types/operations'
import type { NodeData } from '../../types/graph'
import { RECT_NODE_TYPE } from '../graphConfig'

export class CloneNodeCommand implements ICommand {
  description: string
  private graph: Graph
  private sourceId: string
  private newNodeId: string
  private offset: number
  private snapshot: NodeData | null = null

  constructor(graph: Graph, sourceId: string, newNodeId: string, offset = 40) {
    this.graph = graph
    this.sourceId = sourceId
    this.newNodeId = newNodeId
    this.offset = offset
    this.description = `克隆节点: ${sourceId} -> ${newNodeId}`
  }

  execute(): void {
    const src = this.graph.findById(this.sourceId)
    if (!src) return
    const m = src.getModel() as Record<string, unknown>

    const x = ((m.x as number) || 0) + this.offset
    const y = ((m.y as number) || 0) + this.offset

    this.snapshot = {
      id: this.newNodeId,
      label: `${m.label || '节点'} 副本`,
      x,
      y,
      fx: x,
      fy: y,
      type: (m.type as string) || RECT_NODE_TYPE,
      properties: cloneDeep((m.properties as Record<string, unknown>) || {}),
      style: cloneDeep((m.style as Record<string, unknown>) || {}),
    }

    this.graph.addItem('node', {
      id: this.snapshot.id,
      label: this.snapshot.label,
      x: this.snapshot.x,
      y: this.snapshot.y,
      fx: this.snapshot.fx,
      fy: this.snapshot.fy,
      type: this.snapshot.type,
      properties: this.snapshot.properties,
      style: this.snapshot.style,
    })
  }

  undo(): void {
    this.graph.removeItem(this.newNodeId)
  }

  toOperation(): Operation {
    return {
      op: 'add',
      type: 'node',
      id: this.newNodeId,
      data: {
        id: this.newNodeId,
        label: this.snapshot?.label ?? '',
        x: this.snapshot?.x,
        y: this.snapshot?.y,
        properties: this.snapshot?.properties,
      },
    }
  }
}
