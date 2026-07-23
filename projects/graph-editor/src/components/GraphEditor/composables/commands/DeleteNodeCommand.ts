/**
 * 删除节点命令
 */
import type { Graph } from '@antv/g6'
import type { ICommand, Operation } from '../../types/operations'
import type { NodeData, EdgeData } from '../../types/graph'

export class DeleteNodeCommand implements ICommand {
  description: string
  private nodeId: string
  private snapshot: NodeData | null = null
  private connectedEdges: EdgeData[] = []
  private graph: Graph

  constructor(graph: Graph, nodeId: string) {
    this.graph = graph
    this.nodeId = nodeId
    this.description = `删除节点: ${nodeId}`
  }

  execute(): void {
    const nodeItem = this.graph.findById(this.nodeId)
    if (nodeItem) {
      const model = nodeItem.getModel() as Record<string, unknown>
      this.snapshot = {
        id: model.id as string,
        label: (model.label as string) || '',
        x: model.x as number | undefined,
        y: model.y as number | undefined,
        fx: (model.fx ?? model.x) as number | undefined,
        fy: (model.fy ?? model.y) as number | undefined,
        properties: (model.properties as Record<string, unknown>) || {},
      }
    }

    const allEdges = this.graph.getEdges()
    this.connectedEdges = allEdges
      .filter((edge: { getModel: () => Record<string, unknown> }) => {
        const m = edge.getModel()
        return m.source === this.nodeId || m.target === this.nodeId
      })
      .map((edge: { getModel: () => Record<string, unknown> }) => {
        const m = edge.getModel()
        return {
          id: m.id as string,
          source: m.source as string,
          target: m.target as string,
          type: (m.type as EdgeData['type']) || 'line',
          label: (m.label as string) || '',
        }
      })

    this.connectedEdges.forEach((e) => {
      try { this.graph.removeItem(e.id) } catch { /* ignore */ }
    })

    this.graph.removeItem(this.nodeId)
  }

  undo(): void {
    if (this.snapshot) {
      this.graph.addItem('node', {
        id: this.snapshot.id,
        label: this.snapshot.label,
        x: this.snapshot.x,
        y: this.snapshot.y,
        fx: this.snapshot.fx,
        fy: this.snapshot.fy,
        type: 'graph-editor-node',
        properties: this.snapshot.properties,
      })
    }

    this.connectedEdges.forEach((e) => {
      this.graph.addItem('edge', {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || 'line',
        label: e.label,
      })
    })
  }

  toOperation(): Operation {
    return { op: 'delete', type: 'node', id: this.nodeId }
  }
}
