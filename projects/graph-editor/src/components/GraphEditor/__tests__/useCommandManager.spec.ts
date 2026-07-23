/**
 * useCommandManager 单元测试
 * 纯逻辑测试，不依赖 G6 或 Vue 组件
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandManager } from '../composables/useCommandManager'
import type { ICommand, Operation } from '../types/operations'

/** Mock 命令 —— 用于测试 */
class MockCommand implements ICommand {
  description: string
  executeCalls: number = 0
  undoCallOrder: string[] = []
  private name: string
  private callOrderRef: { order: string[] }

  constructor(name: string, callOrderRef: { order: string[] }) {
    this.name = name
    this.callOrderRef = callOrderRef
    this.description = `Mock: ${name}`
  }

  execute(): void {
    this.executeCalls++
    this.callOrderRef.order.push(`execute-${this.name}`)
  }

  undo(): void {
    this.callOrderRef.order.push(`undo-${this.name}`)
  }

  toOperation(): Operation {
    return { op: 'add', type: 'node', id: this.name }
  }
}

describe('useCommandManager', () => {
  let manager: ReturnType<typeof useCommandManager>
  let callOrder: { order: string[] }

  beforeEach(() => {
    callOrder = { order: [] }
    manager = useCommandManager()
  })

  it('初始状态：undoStack 和 redoStack 都为空', () => {
    expect(manager.state.undoStack).toHaveLength(0)
    expect(manager.state.redoStack).toHaveLength(0)
    expect(manager.state.canUndo).toBe(false)
    expect(manager.state.canRedo).toBe(false)
  })

  it('执行命令后，command 进入 undoStack，redoStack 清空', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)

    expect(manager.state.undoStack).toHaveLength(1)
    expect(manager.state.redoStack).toHaveLength(0)
    expect(manager.state.canUndo).toBe(true)
    expect(manager.state.canRedo).toBe(false)
    expect(cmd.executeCalls).toBe(1)
  })

  it('撤销后，command 从 undoStack 移到 redoStack', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)
    manager.undo()

    expect(manager.state.undoStack).toHaveLength(0)
    expect(manager.state.redoStack).toHaveLength(1)
    expect(manager.state.canUndo).toBe(false)
    expect(manager.state.canRedo).toBe(true)
    expect(callOrder.order).toEqual(['execute-A', 'undo-A'])
  })

  it('重做后，command 从 redoStack 移回 undoStack', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)
    manager.undo()
    manager.redo()

    expect(manager.state.undoStack).toHaveLength(1)
    expect(manager.state.redoStack).toHaveLength(0)
    expect(manager.state.canUndo).toBe(true)
    expect(manager.state.canRedo).toBe(false)
    expect(callOrder.order).toEqual(['execute-A', 'undo-A', 'execute-A'])
  })

  it('新操作后重做栈清空', () => {
    const cmdA = new MockCommand('A', callOrder)
    const cmdB = new MockCommand('B', callOrder)

    manager.execute(cmdA)
    manager.undo()
    manager.execute(cmdB) // 新操作

    expect(manager.state.undoStack).toHaveLength(1)
    expect(manager.state.redoStack).toHaveLength(0) // 应该被清空
    expect(manager.state.canRedo).toBe(false)
  })

  it('连续多次撤销/重做', () => {
    const cmdA = new MockCommand('A', callOrder)
    const cmdB = new MockCommand('B', callOrder)
    const cmdC = new MockCommand('C', callOrder)

    manager.execute(cmdA)
    manager.execute(cmdB)
    manager.execute(cmdC)

    expect(manager.state.undoStack).toHaveLength(3)

    manager.undo()
    expect(manager.state.undoStack).toHaveLength(2)
    expect(callOrder.order).toContain('undo-C')

    manager.undo()
    expect(manager.state.undoStack).toHaveLength(1)
    expect(callOrder.order).toContain('undo-B')

    manager.redo()
    expect(manager.state.undoStack).toHaveLength(2)
    expect(callOrder.order).toContain('execute-B')
  })

  it('操作队列记录操作', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)

    expect(manager.operationQueue.value).toHaveLength(1)
    expect(manager.operationQueue.value[0].id).toBe('A')
  })

  it('清空队列后 pending 为 false', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)

    expect(manager.hasPendingChanges.value).toBe(true)

    manager.clearQueue()
    expect(manager.operationQueue.value).toHaveLength(0)
    expect(manager.hasPendingChanges.value).toBe(false)
  })

  it('clearHistory 清空所有历史和队列', () => {
    const cmd = new MockCommand('A', callOrder)
    manager.execute(cmd)

    manager.clearHistory()

    expect(manager.state.undoStack).toHaveLength(0)
    expect(manager.state.redoStack).toHaveLength(0)
    expect(manager.operationQueue.value).toHaveLength(0)
    expect(manager.hasPendingChanges.value).toBe(false)
  })

  it('历史栈超过 MAX_HISTORY 后移除最早记录', () => {
    // MAX_HISTORY = 50, 创建 55 个命令
    for (let i = 0; i < 55; i++) {
      const cmd = new MockCommand(`cmd-${i}`, callOrder)
      manager.execute(cmd)
    }

    expect(manager.state.undoStack.length).toBeLessThanOrEqual(50)
    // 最早的应该是 cmd-5
    expect(manager.state.undoStack[0].command.description).toBe('Mock: cmd-5')
  })
})
