/**
 * useGraphSync —— 数据同步管理
 * 监听操作队列，防抖调用 StorageAdapter.save，处理失败重试和冲突
 * @module composables/useGraphSync
 */

import { ref, watch, type Ref } from 'vue'
import { debounce } from 'lodash-es'
import type { Operation } from '../types/operations'
import type { StorageAdapter } from '../types/adapter'

/** 默认防抖时间 */
const DEFAULT_DEBOUNCE_MS = 500

/** 最大重试次数 */
const MAX_RETRIES = 3

/** 指数退避基数 */
const BASE_DELAY_MS = 1000

/**
 * useGraphSync 返回类型
 */
export interface UseGraphSyncReturn {
  /** 同步状态 */
  isSaving: Ref<boolean>
  /** 上次错误 */
  lastError: Ref<string | null>
  /** 手动触发保存（用于强制立即保存，如 beforeunload） */
  flush: () => Promise<void>
  /** 取消未执行的保存 */
  cancel: () => void
  /** 冲突回调 —— 409 时触发，外部应重新 load 数据 */
  onConflict: Ref<(() => void) | null>
}

/**
 * 数据同步 composable
 * @param operationQueue - 操作队列 ref
 * @param storage - StorageAdapter 实例
 * @param getVersion - 获取当前版本号的函数
 * @param debounceMs - 防抖时间（毫秒）
 */
export function useGraphSync(
  operationQueue: Ref<Operation[]>,
  storage: StorageAdapter,
  getVersion: () => number | undefined,
  onSaved: () => void = () => {},
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): UseGraphSyncReturn {
  const isSaving = ref(false)
  const lastError = ref<string | null>(null)
  const onConflict = ref<(() => void) | null>(null)

  let pendingOps: Operation[] = []
  let retryCount = 0

  /**
   * 指数退避延迟
   */
  function getRetryDelay(attempt: number): number {
    return BASE_DELAY_MS * Math.pow(2, attempt - 1)
  }

  /**
   * 等待指定毫秒数
   */
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 执行保存（带重试逻辑）
   */
  async function doSave(ops: Operation[]): Promise<void> {
    if (ops.length === 0) return

    isSaving.value = true
    lastError.value = null

    try {
      const version = getVersion()
      await storage.save(ops, version)
      retryCount = 0
      operationQueue.value = []
      onSaved()
    } catch (err: unknown) {
      const error = err as Error & { status?: number; response?: { status?: number } }
      const status = error.status ?? error.response?.status

      // 409 冲突 —— 提示并触发刷新
      if (status === 409) {
        lastError.value = '数据冲突：远程数据已被修改，请刷新后重试。'
        if (onConflict.value) {
          onConflict.value()
        }
        retryCount = 0
        return
      }

      // 重试逻辑
      retryCount += 1
      if (retryCount <= MAX_RETRIES) {
        const retryDelay = getRetryDelay(retryCount)
        lastError.value = `保存失败，第 ${retryCount} 次重试中...（${retryDelay}ms 后重试）`
        console.warn(`[GraphSync] 保存失败，${retryDelay}ms 后第 ${retryCount} 次重试`, err)
        await delay(retryDelay)
        return doSave(ops)
      }

      // 最终失败
      lastError.value = `保存失败：已重试 ${MAX_RETRIES} 次仍然失败。请检查网络后手动刷新。`
      console.error('[GraphSync] 保存最终失败', err)
      retryCount = 0
    } finally {
      isSaving.value = false
    }
  }

  /**
   * 防抖保存
   */
  const debouncedSave = debounce(
    () => {
      const ops = [...operationQueue.value]
      if (ops.length > 0) {
        pendingOps = ops
        doSave(ops)
      }
    },
    debounceMs,
    { leading: false, trailing: true },
  )

  /**
   * 监听操作队列变化，触发防抖保存
   */
  watch(
    operationQueue,
    (newOps) => {
      if (newOps.length > 0) {
        debouncedSave()
      }
    },
    { deep: true },
  )

  /**
   * 立即执行保存（跳过防抖）
   */
  async function flush(): Promise<void> {
    debouncedSave.cancel()
    const ops = [...operationQueue.value]
    if (ops.length > 0) {
      pendingOps = ops
      await doSave(ops)
    }
  }

  /**
   * 取消待执行的防抖保存
   */
  function cancel(): void {
    debouncedSave.cancel()
  }

  return {
    isSaving,
    lastError,
    flush,
    cancel,
    onConflict,
  }
}
