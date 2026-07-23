/**
 * 更新边命令
 */
import type { Graph } from '@antv/g6'
import { cloneDeep } from 'lodash-es'
import type { ICommand, Operation } from '../../types/operations'
import type { EdgeData } from '../../types/graph'

export class UpdateEdgeCommand implements ICommand {
  description: string
  private edgeId: string
  private newData: Partial<EdgeData>
  private oldData: Partial<EdgeData> = {}
  private graph: Graph

  constructor(graph: Graph, edgeId: string, data: Partial<EdgeData>) {
    this.graph = graph
    this.edgeId = edgeId
    this.newData = cloneDeep(data)
    this.description = `更新边: ${edgeId}`
  }

  execute(): void {
    const edgeItem = this.graph.findById(this.edgeId)
    if (!edgeItem) return

    const model = edgeItem.getModel() as Record<string, unknown>
    this.oldData = {
      type: (model.type as EdgeData['type']) || 'line',
      label: (model.label as string) || '',
    }

    const update: Record<string, unknown> = {}
    if (this.newData.type !== undefined) update.type = this.newData.type
    if (this.newData.label !== undefined) update.label = this.newData.label

    this.graph.updateItem(edgeItem, update)
  }

  undo(): void {
    const edgeItem = this.graph.findById(this.edgeId)
    if (!edgeItem) return

    const update: Record<string, unknown> = {}
    if (this.oldData.type !== undefined) update.type = this.oldData.type
    if (this.oldData.label !== undefined) update.label = this.oldData.label

    this.graph.updateItem(edgeItem, update)
  }

  toOperation(): Operation {
    return { op: 'update', type: 'edge', id: this.edgeId, data: this.newData }
  }
}
