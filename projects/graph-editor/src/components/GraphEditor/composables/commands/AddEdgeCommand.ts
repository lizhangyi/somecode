/**
 * 添加边命令
 */
import type { Graph } from '@antv/g6'
import { cloneDeep } from 'lodash-es'
import type { ICommand, Operation } from '../../types/operations'
import type { EdgeData } from '../../types/graph'

export class AddEdgeCommand implements ICommand {
  description: string
  private edge: EdgeData
  private graph: Graph

  constructor(graph: Graph, edge: EdgeData) {
    this.graph = graph
    this.edge = cloneDeep(edge)
    this.description = `添加边: ${edge.source} -> ${edge.target}`
  }

  execute(): void {
    this.graph.addItem('edge', {
      id: this.edge.id,
      source: this.edge.source,
      target: this.edge.target,
      type: this.edge.type || 'line',
      label: this.edge.label || '',
    })
  }

  undo(): void {
    this.graph.removeItem(this.edge.id)
  }

  toOperation(): Operation {
    return { op: 'add', type: 'edge', id: this.edge.id, data: this.edge }
  }
}
