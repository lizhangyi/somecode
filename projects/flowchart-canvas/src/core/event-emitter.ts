// core/event-emitter.ts — 事件系统

import type { EventMap } from './types'

type EventName = keyof EventMap
type Listener<K extends EventName> = (payload: EventMap[K]) => void

/**
 * 轻量事件发射器
 * 用法：
 *   const emitter = new EventEmitter()
 *   emitter.on('node:add', (e) => console.log(e.node))
 *   emitter.emit('node:add', { node: someNode })
 */
export class EventEmitter {
  private listeners = new Map<EventName, Set<Function>>()

  /** 注册事件监听 */
  on<K extends EventName>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    // 返回取消监听函数
    return () => this.off(event, listener)
  }

  /** 取消事件监听 */
  off<K extends EventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener)
  }

  /** 触发事件 */
  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) {
      try {
        (listener as Listener<K>)(payload)
      } catch (e) {
        console.error(`[Flowchart] 事件监听器错误 (${event}):`, e)
      }
    }
  }

  /** 移除所有监听器 */
  clear(): void {
    this.listeners.clear()
  }
}
