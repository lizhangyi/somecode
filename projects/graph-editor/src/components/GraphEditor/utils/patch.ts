/**
 * 将 Operation 应用到全量数据
 * 供 localStorage 适配器使用，将增量操作合并到全量图数据中
 * @module utils/patch
 */

import type { Operation } from '../types/operations'
import type { GraphData, NodeData, EdgeData } from '../types/graph'
import { cloneDeep } from 'lodash-es'

/**
 * 将操作列表应用到图数据，返回新的图数据（不可变）
 * @param data - 当前图数据
 * @param operations - 要应用的操作列表
 * @returns 应用操作后的新图数据
 */
export function applyOperations(data: GraphData, operations: Operation[]): GraphData {
  const result = cloneDeep(data)

  for (const op of operations) {
    if (op.type === 'node') {
      applyNodeOperation(result, op)
    } else if (op.type === 'edge') {
      applyEdgeOperation(result, op)
    }
  }

  return result
}

/**
 * 应用节点操作
 */
function applyNodeOperation(data: GraphData, op: Operation): void {
  const nodes = data.nodes

  switch (op.op) {
    case 'add': {
      if (op.data && op.id) {
        const newNode: NodeData = { id: op.id, label: '', ...op.data }
        nodes.push(newNode)
      }
      break
    }
    case 'update': {
      if (op.id) {
        const idx = nodes.findIndex((n) => n.id === op.id)
        if (idx !== -1 && op.data) {
          Object.assign(nodes[idx], op.data)
        }
      }
      break
    }
    case 'delete': {
      if (op.id) {
        const idx = nodes.findIndex((n) => n.id === op.id)
        if (idx !== -1) {
          nodes.splice(idx, 1)
          // 同时删除关联的边
          data.edges = data.edges.filter(
            (e) => e.source !== op.id && e.target !== op.id
          )
        }
      }
      break
    }
  }
}

/**
 * 应用边操作
 */
function applyEdgeOperation(data: GraphData, op: Operation): void {
  const edges = data.edges

  switch (op.op) {
    case 'add': {
      if (op.data && op.id) {
        const newEdge: EdgeData = {
          id: op.id,
          source: '',
          target: '',
          ...(op.data as Record<string, unknown>),
          type: ((op.data as Record<string, unknown>).type as EdgeData['type']) || 'line',
        }
        edges.push(newEdge)
      }
      break
    }
    case 'update': {
      if (op.id) {
        const idx = edges.findIndex((e) => e.id === op.id)
        if (idx !== -1 && op.data) {
          Object.assign(edges[idx], op.data)
        }
      }
      break
    }
    case 'delete': {
      if (op.id) {
        const idx = edges.findIndex((e) => e.id === op.id)
        if (idx !== -1) {
          edges.splice(idx, 1)
        }
      }
      break
    }
  }
}
