/**
 * ID 生成器
 * @module utils/idGenerator
 */

let counter = 0

/**
 * 生成唯一 ID
 * @param prefix - 前缀（默认 'node'）
 * @returns 唯一标识符
 */
export function generateId(prefix: string = 'node'): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 重置计数器（仅用于测试）
 */
export function resetIdCounter(): void {
  counter = 0
}
