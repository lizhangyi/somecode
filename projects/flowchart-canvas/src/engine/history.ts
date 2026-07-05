// engine/history.ts — 撤销/重做管理器（绑定到实例）

import type { Command } from '../core/types'
import { HISTORY_MAX } from '../geometry/config'

/**
 * 历史栈管理器
 * 每个 Flowchart 实例拥有独立的 HistoryManager
 */
export class HistoryManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private onChangeCallback: () => void

  constructor(onChange: () => void) {
    this.onChangeCallback = onChange
  }

  /**
   * 执行命令并压入撤销栈
   * 同时清空重做栈
   */
  execute(cmd: Command): void {
    cmd.do()
    this.undoStack.push(cmd)
    if (this.undoStack.length > HISTORY_MAX) {
      this.undoStack.shift()
    }
    this.redoStack.length = 0
    this.onChangeCallback()
  }

  /** 撤销 */
  undo(): void {
    if (this.undoStack.length === 0) return
    const cmd = this.undoStack.pop()!
    cmd.undo()
    this.redoStack.push(cmd)
    this.onChangeCallback()
  }

  /** 重做 */
  redo(): void {
    if (this.redoStack.length === 0) return
    const cmd = this.redoStack.pop()!
    cmd.do()
    this.undoStack.push(cmd)
    this.onChangeCallback()
  }

  /** 是否可以撤销 */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** 是否可以重做 */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** 清空历史 */
  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
    this.onChangeCallback()
  }
}
