/**
 * 存储适配器类型定义
 * @module types/adapter
 */

import type { GraphData } from './graph'
import type { Operation } from './operations'

/**
 * 存储适配器接口
 * 组件不关心数据如何存储，只需实现此接口
 */
export interface StorageAdapter {
  /** 加载全量数据 */
  load(): Promise<GraphData>
  /** 增量保存操作 */
  save(operations: Operation[], version?: number): Promise<void>
  /** 全量保存（可选，用于导出等场景） */
  saveFull?(data: GraphData): Promise<void>
}
