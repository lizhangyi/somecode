// engine/text-editor.ts — 双击节点编辑文字（内置可选功能）

import type { Flowchart } from '../core/flowchart'
import type { FlowNode } from '../core/types'

/**
 * 文字编辑器
 * 动态创建 textarea 浮层，双击节点时显示
 * 通过 options.textEditor 控制是否启用
 */
export class TextEditor {
  private fc: Flowchart
  private editorEl: HTMLTextAreaElement
  private editingNode: FlowNode | null = null
  private originalText = ''

  constructor(fc: Flowchart) {
    this.fc = fc

    this.editorEl = document.createElement('textarea')
    this.editorEl.className = 'fc-text-editor'
    this.editorEl.style.display = 'none'
    this.fc.canvas.parentElement?.appendChild(this.editorEl)

    this.editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this.finishEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.cancelEdit()
      }
      e.stopPropagation()
    })

    this.editorEl.addEventListener('blur', () => {
      this.finishEdit()
    })
  }

  /** 开始编辑节点文字 */
  startEdit(node: FlowNode): void {
    this.editingNode = node
    this.originalText = node.text

    const screenPos = this.fc.canvasHelper.canvasToScreen(node.x, node.y, this.fc.state.viewport)
    const screenW = node.width * this.fc.state.viewport.scale
    const screenH = node.height * this.fc.state.viewport.scale

    this.editorEl.style.display = 'block'
    this.editorEl.style.left = `${screenPos.x - screenW / 2 + 4}px`
    this.editorEl.style.top = `${screenPos.y - screenH / 2 + 4}px`
    this.editorEl.style.width = `${screenW - 8}px`
    this.editorEl.style.height = `${screenH - 8}px`
    this.editorEl.value = node.text
    this.editorEl.focus()
    this.editorEl.select()

    this.fc.state.setInteractionState('editing-text')
  }

  /** 完成编辑 */
  finishEdit(): void {
    if (!this.editingNode) return
    const newText = this.editorEl.value
    const nodeId = this.editingNode.id
    const oldText = this.originalText

    this.editorEl.style.display = 'none'
    this.editorEl.value = ''
    this.editingNode = null

    if (newText !== oldText) {
      this.fc.history.execute({
        type: 'edit-text',
        do: () => this.fc.state.updateNode(nodeId, { text: newText }),
        undo: () => this.fc.state.updateNode(nodeId, { text: oldText }),
      })
      this.fc.emit('node:update', { node: this.fc.state.getNode(nodeId)!, changes: { text: newText } })
    }

    this.fc.state.setInteractionState('idle')
  }

  /** 取消编辑 */
  cancelEdit(): void {
    this.editorEl.style.display = 'none'
    this.editorEl.value = ''
    this.editingNode = null
    this.fc.state.setInteractionState('idle')
  }

  /** 是否正在编辑 */
  isEditing(): boolean {
    return this.editingNode !== null
  }

  /** 销毁 */
  destroy(): void {
    this.editorEl.remove()
  }
}
