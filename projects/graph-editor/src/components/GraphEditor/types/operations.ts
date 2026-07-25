/**
 * 操作与命令类型定义
 * @module types/operations
 */

import type { NodeData, EdgeData } from './graph'

/** 操作类型 */
export type OpType = 'add' | 'update' | 'delete'

/** 数据类型 */
export type DataType = 'node' | 'edge'

/** 增量操作 */
export interface Operation {
  op: OpType
  type: DataType
  id?: string
  data?: Partial<NodeData | EdgeData>
}

/**
 * 命令接口 —— 所有数据修改必须通过命令执行
 * 确保撤销/重做与数据同步的一致性
 */
export interface ICommand {
  /** 执行命令 */
  execute(): void
  /** 撤销命令 */
  undo(): void
  /** 将命令转换为持久化 Operation（批量命令可返回多条） */
  toOperation(): Operation | Operation[]
  /** 命令描述（用于调试） */
  description: string
}

/** 历史栈条目 */
export interface HistoryEntry {
  command: ICommand
  timestamp: number
}

/** 命令管理器状态 */
export interface CommandManagerState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
}
