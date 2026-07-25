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
    // 记录原始 style（深拷贝），撤销时整体还原，避免局部更新丢失其它样式键
    if (model.style) this.oldData.style = cloneDeep(model.style) as EdgeData['style']

    const update: Record<string, unknown> = {}
    if (this.newData.type !== undefined) update.type = this.newData.type
    if (this.newData.label !== undefined) update.label = this.newData.label
    // style 与模型原有 style 合并，支持颜色/线宽/虚线/箭头等局部覆盖
    if (this.newData.style) {
      update.style = { ...(model.style as Record<string, unknown>), ...this.newData.style }
    }

    this.graph.updateItem(edgeItem, update)
  }

  undo(): void {
    const edgeItem = this.graph.findById(this.edgeId)
    if (!edgeItem) return

    const update: Record<string, unknown> = {}
    if (this.oldData.type !== undefined) update.type = this.oldData.type
    if (this.oldData.label !== undefined) update.label = this.oldData.label
    if (this.oldData.style !== undefined) update.style = this.oldData.style

    this.graph.updateItem(edgeItem, update)
  }

  toOperation(): Operation {
    return { op: 'update', type: 'edge', id: this.edgeId, data: this.newData }
  }
}
