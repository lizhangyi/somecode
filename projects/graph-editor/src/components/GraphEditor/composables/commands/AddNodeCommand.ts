/**
 * 添加节点命令
 */
import type { Graph } from '@antv/g6'
import { cloneDeep } from 'lodash-es'
import type { ICommand, Operation } from '../../types/operations'
import type { NodeData } from '../../types/graph'
import { RECT_NODE_TYPE } from '../graphConfig'

export class AddNodeCommand implements ICommand {
  description: string
  private node: NodeData
  private graph: Graph

  constructor(graph: Graph, node: NodeData) {
    this.graph = graph
    this.node = cloneDeep(node)
    this.description = `添加节点: ${node.label || node.id}`
  }

  execute(): void {
    this.graph.addItem('node', {
      id: this.node.id,
      label: this.node.label,
      x: this.node.x ?? 200 + Math.random() * 200,
      y: this.node.y ?? 200 + Math.random() * 200,
      fx: this.node.fx,
      fy: this.node.fy,
      type: this.node.type || RECT_NODE_TYPE,
      style: this.node.style,
      properties: this.node.properties,
    })
  }

  undo(): void {
    this.graph.removeItem(this.node.id)
  }

  toOperation(): Operation {
    return {
      op: 'add',
      type: 'node',
      id: this.node.id,
      data: {
        id: this.node.id,
        label: this.node.label,
        x: this.node.x,
        y: this.node.y,
        properties: this.node.properties,
      },
    }
  }
}
