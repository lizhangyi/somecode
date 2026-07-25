/**
 * 更新节点命令
 */
import type { Graph } from '@antv/g6'
import { cloneDeep } from 'lodash-es'
import type { ICommand, Operation } from '../../types/operations'
import type { NodeData } from '../../types/graph'

export class UpdateNodeCommand implements ICommand {
  description: string
  private nodeId: string
  private newData: Partial<NodeData>
  private oldData: Partial<NodeData> = {}
  private graph: Graph

  constructor(graph: Graph, nodeId: string, data: Partial<NodeData>) {
    this.graph = graph
    this.nodeId = nodeId
    this.newData = cloneDeep(data)
    this.description = `更新节点: ${nodeId}`
  }

  execute(): void {
    const nodeItem = this.graph.findById(this.nodeId)
    if (!nodeItem) return

    const model = nodeItem.getModel() as Record<string, unknown>
    this.oldData = {
      label: (model.label as string) || '',
      x: model.x as number | undefined,
      y: model.y as number | undefined,
      fx: (model.fx ?? model.x) as number | undefined,
      fy: (model.fy ?? model.y) as number | undefined,
      properties: cloneDeep((model.properties as Record<string, unknown>) || {}),
      style: cloneDeep((model.style as Record<string, unknown>) || {}),
    }

    const update: Record<string, unknown> = {}
    if (this.newData.label !== undefined) update.label = this.newData.label
    if (this.newData.x !== undefined) update.x = this.newData.x
    if (this.newData.y !== undefined) update.y = this.newData.y
    if (this.newData.fx !== undefined) update.fx = this.newData.fx
    if (this.newData.fy !== undefined) update.fy = this.newData.fy
    if (this.newData.properties !== undefined) update.properties = this.newData.properties
    if (this.newData.style) {
      update.style = { ...(model.style as Record<string, unknown>), ...this.newData.style }
    }

    this.graph.updateItem(nodeItem, update)
  }

  undo(): void {
    const nodeItem = this.graph.findById(this.nodeId)
    if (!nodeItem) return

    const update: Record<string, unknown> = {}
    if (this.oldData.label !== undefined) update.label = this.oldData.label
    if (this.oldData.x !== undefined) update.x = this.oldData.x
    if (this.oldData.y !== undefined) update.y = this.oldData.y
    if (this.oldData.fx !== undefined) update.fx = this.oldData.fx
    if (this.oldData.fy !== undefined) update.fy = this.oldData.fy
    if (this.oldData.properties !== undefined) update.properties = this.oldData.properties
    if (this.oldData.style) update.style = this.oldData.style

    this.graph.updateItem(nodeItem, update)
  }

  toOperation(): Operation {
    return { op: 'update', type: 'node', id: this.nodeId, data: this.newData }
  }
}
