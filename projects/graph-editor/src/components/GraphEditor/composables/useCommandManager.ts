/**
 * useCommandManager —— 命令管理器
 * 管理命令历史栈，提供 execute/undo/redo
 * @module composables/useCommandManager
 */

import { reactive, ref, type Ref } from 'vue'
import type { ICommand, Operation, HistoryEntry, CommandManagerState } from '../types/operations'

/** 最大历史记录数 */
const MAX_HISTORY = 50

/**
 * useCommandManager 返回类型
 */
export interface UseCommandManagerReturn {
  state: CommandManagerState
  operationQueue: Ref<Operation[]>
  execute: (command: ICommand) => void
  undo: () => void
  redo: () => void
  clearQueue: () => void
  clearHistory: () => void
  hasPendingChanges: Ref<boolean>
}

/**
 * 命令管理器 composable
 */
export function useCommandManager(): UseCommandManagerReturn {
  const state = reactive<CommandManagerState>({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  })

  const operationQueue = ref<Operation[]>([])
  const hasPendingChanges = ref(false)

  function updateState(): void {
    state.canUndo = state.undoStack.length > 0
    state.canRedo = state.redoStack.length > 0
  }

  /**
   * 将命令产生的操作（可能是单条或批量）推入同步队列
   */
  function pushOperations(op: Operation | Operation[]): void {
    if (Array.isArray(op)) operationQueue.value.push(...op)
    else operationQueue.value.push(op)
  }

  /**
   * 生成反向操作（用于撤销时同步持久化）
   */
  function reverseOperations(op: Operation | Operation[]): Operation[] {
    const list = Array.isArray(op) ? op : [op]
    return list.map((reverseOp) => ({
      ...reverseOp,
      op: reverseOp.op === 'add' ? 'delete'
        : reverseOp.op === 'delete' ? 'add'
        : 'update',
    }))
  }

  /**
   * 执行命令
   */
  function execute(command: ICommand): void {
    command.execute()

    const entry: HistoryEntry = { command, timestamp: Date.now() }
    state.undoStack.push(entry)

    if (state.undoStack.length > MAX_HISTORY) {
      state.undoStack.shift()
    }

    state.redoStack = []
    pushOperations(command.toOperation())
    hasPendingChanges.value = true
    updateState()
  }

  /**
   * 撤销
   */
  function undo(): void {
    if (state.undoStack.length === 0) return

    const entry = state.undoStack.pop()!
    entry.command.undo()
    state.redoStack.push(entry)

    // 把反向操作入队以便持久化（批量命令展开为多条）
    operationQueue.value.push(...reverseOperations(entry.command.toOperation()))
    updateState()
  }

  /**
   * 重做
   */
  function redo(): void {
    if (state.redoStack.length === 0) return

    const entry = state.redoStack.pop()!
    entry.command.execute()
    state.undoStack.push(entry)
    pushOperations(entry.command.toOperation())
    updateState()
  }

  /**
   * 清空操作队列（同步完成后调用）
   */
  function clearQueue(): void {
    operationQueue.value = []
    hasPendingChanges.value = false
  }

  /**
   * 清空历史记录
   */
  function clearHistory(): void {
    state.undoStack = []
    state.redoStack = []
    operationQueue.value = []
    hasPendingChanges.value = false
    updateState()
  }

  return { state, operationQueue, execute, undo, redo, clearQueue, clearHistory, hasPendingChanges }
}
