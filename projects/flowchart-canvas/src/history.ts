// history.ts — 撤销/重做（命令模式）

import type { Command } from './types'
import { HISTORY_MAX } from './config'
import { markDirty } from './state'

const undoStack: Command[] = []
const redoStack: Command[] = []

/**
 * 执行命令并压入撤销栈
 * 同时清空重做栈
 */
export function execute(cmd: Command) {
  cmd.do()
  undoStack.push(cmd)
  // 限制栈大小
  if (undoStack.length > HISTORY_MAX) {
    undoStack.shift()
  }
  // 清空重做栈
  redoStack.length = 0
  markDirty()
}

/** 撤销 */
export function undo() {
  if (undoStack.length === 0) return
  const cmd = undoStack.pop()!
  cmd.undo()
  redoStack.push(cmd)
  markDirty()
}

/** 重做 */
export function redo() {
  if (redoStack.length === 0) return
  const cmd = redoStack.pop()!
  cmd.do()
  undoStack.push(cmd)
  markDirty()
}

/** 是否可以撤销 */
export function canUndo(): boolean {
  return undoStack.length > 0
}

/** 是否可以重做 */
export function canRedo(): boolean {
  return redoStack.length > 0
}

/** 清空历史（导入新数据后调用） */
export function clearHistory() {
  undoStack.length = 0
  redoStack.length = 0
}
