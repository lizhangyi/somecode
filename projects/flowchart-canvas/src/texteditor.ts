// texteditor.ts — 双击节点编辑文字（浮层input）

import type { FlowNode } from './types'
import { viewport } from './state'
import { execute } from './history'
import { updateNode } from './state'
import { canvasToScreen } from './canvas'

let editorEl: HTMLInputElement | null = null
let editingNode: FlowNode | null = null
let originalText: string = ''

/**
 * 初始化文字编辑器
 */
export function initTextEditor() {
  editorEl = document.getElementById('text-editor') as HTMLInputElement
  if (!editorEl) return

  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
    e.stopPropagation()
  })

  editorEl.addEventListener('blur', () => {
    finishEdit()
  })
}

/**
 * 开始编辑节点文字
 */
export function startEdit(node: FlowNode) {
  if (!editorEl) return
  editingNode = node
  originalText = node.text

  // 计算节点在屏幕上的位置和尺寸
  const screenPos = canvasToScreen(node.x, node.y)
  const screenW = node.width * viewport.scale
  const screenH = node.height * viewport.scale

  editorEl.style.display = 'block'
  editorEl.style.left = `${screenPos.x - screenW / 2 + 4}px`
  editorEl.style.top = `${screenPos.y - screenH / 2 + 4}px`
  editorEl.style.width = `${screenW - 8}px`
  editorEl.style.height = `${screenH - 8}px`
  editorEl.value = node.text
  editorEl.focus()
  editorEl.select()
}

/**
 * 完成编辑
 */
export function finishEdit() {
  if (!editorEl || !editingNode) return
  const newText = editorEl.value
  const nodeId = editingNode.id
  const oldText = originalText

  editorEl.style.display = 'none'
  editorEl.value = ''
  editingNode = null

  // 只有文字变化才记录命令
  if (newText !== oldText) {
    execute({
      type: 'edit-text',
      do: () => updateNode(nodeId, { text: newText }),
      undo: () => updateNode(nodeId, { text: oldText }),
    })
  }
}

/**
 * 取消编辑
 */
export function cancelEdit() {
  if (!editorEl) return
  editorEl.style.display = 'none'
  editorEl.value = ''
  editingNode = null
}

/** 是否正在编辑 */
export function isEditing(): boolean {
  return editingNode !== null
}
