/**
 * 反转边方向命令
 * 交换 source / target，用于修正有向关系方向。
 * 通过 updateItem 修改端点触发 G6 重新连接与重绘，一次撤销还原方向。
 */
import type { Graph } from '@antv/g6'
import type { ICommand, Operation } from '../../types/operations'

export class ReverseEdgeCommand implements ICommand {
  description: string
  private graph: Graph
  private edgeId: string
  private source = ''
  private target = ''

  constructor(graph: Graph, edgeId: string) {
    this.graph = graph
    this.edgeId = edgeId
    this.description = `反转边方向: ${edgeId}`
  }

  execute(): void {
    const edge = this.graph.findById(this.edgeId)
    if (!edge) return
    const m = edge.getModel() as { source: string; target: string }
    this.source = m.source
    this.target = m.target
    this.graph.updateItem(edge, { source: this.target, target: this.source })
  }

  undo(): void {
    const edge = this.graph.findById(this.edgeId)
    if (!edge) return
    this.graph.updateItem(edge, { source: this.source, target: this.target })
  }

  toOperation(): Operation {
    return {
      op: 'update',
      type: 'edge',
      id: this.edgeId,
      data: { source: this.target, target: this.source },
    }
  }
}
