/**
 * 删除边命令
 */
import type { Graph } from '@antv/g6'
import type { ICommand, Operation } from '../../types/operations'
import type { EdgeData } from '../../types/graph'

export class DeleteEdgeCommand implements ICommand {
  description: string
  private edgeId: string
  private snapshot: EdgeData | null = null
  private graph: Graph

  constructor(graph: Graph, edgeId: string) {
    this.graph = graph
    this.edgeId = edgeId
    this.description = `删除边: ${edgeId}`
  }

  execute(): void {
    const edgeItem = this.graph.findById(this.edgeId)
    if (edgeItem) {
      const model = edgeItem.getModel() as Record<string, unknown>
      this.snapshot = {
        id: model.id as string,
        source: model.source as string,
        target: model.target as string,
        type: (model.type as EdgeData['type']) || 'line',
        label: (model.label as string) || '',
      }
    }
    this.graph.removeItem(this.edgeId)
  }

  undo(): void {
    if (this.snapshot) {
      this.graph.addItem('edge', {
        id: this.snapshot.id,
        source: this.snapshot.source,
        target: this.snapshot.target,
        type: this.snapshot.type || 'line',
        label: this.snapshot.label,
      })
    }
  }

  toOperation(): Operation {
    return { op: 'delete', type: 'edge', id: this.edgeId }
  }
}
