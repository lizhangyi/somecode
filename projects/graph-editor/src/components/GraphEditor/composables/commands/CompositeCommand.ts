/**
 * 组合命令
 * 将多个子命令聚合为单一命令，对外表现为一次操作。
 * 一次撤销 / 重做作用于全部子命令，用于批量修改（如一次性切换所有边类型）
 * 需要「一次撤销还原全部」的场景。
 * @module commands/CompositeCommand
 */

import type { ICommand, Operation } from '../../types/operations'

export class CompositeCommand implements ICommand {
  description: string
  private commands: ICommand[]

  constructor(commands: ICommand[], description = '批量操作') {
    this.commands = commands
    this.description = description
  }

  execute(): void {
    // 顺序执行子命令（每个子命令自行在 execute 时采集旧值，保证可撤销）
    this.commands.forEach((c) => c.execute())
  }

  undo(): void {
    // 逆序撤销，保证与执行相反的依赖顺序
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }

  toOperation(): Operation | Operation[] {
    const ops: Operation[] = []
    this.commands.forEach((c) => {
      const op = c.toOperation()
      if (Array.isArray(op)) ops.push(...op)
      else ops.push(op)
    })
    return ops
  }
}
