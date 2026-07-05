// engine/context-menu.ts — 右键上下文菜单（内置可选功能）

import type { Flowchart } from '../core/flowchart'
import type { FlowNode, FlowEdge, NodeShape } from '../core/types'
import { DEFAULT_NODE_SIZE, NODE_COLORS } from '../geometry/config'
import { uid } from '../geometry/geometry'

export interface MenuItem {
  label?: string
  icon?: string
  action?: () => void
  disabled?: boolean
  divider?: boolean
  children?: MenuItem[]
}

/**
 * 右键菜单管理器
 * 动态创建菜单 DOM，根据右键目标显示不同菜单项
 * 通过 options.contextMenu 控制是否启用
 */
export class ContextMenu {
  private fc: Flowchart
  private menuEl: HTMLDivElement | null = null
  private submenuEl: HTMLDivElement | null = null
  private closeTimer: number | null = null

  constructor(fc: Flowchart) {
    this.fc = fc
  }

  /** 关闭所有菜单 */
  close(): void {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null }
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null }
    if (this.submenuEl) { this.submenuEl.remove(); this.submenuEl = null }
  }

  /** 是否有菜单打开 */
  isOpen(): boolean {
    return this.menuEl !== null
  }

  /** 显示右键菜单 */
  show(screenX: number, screenY: number, target: 'canvas' | FlowNode | FlowEdge): void {
    this.close()
    const items = this.buildMenuItems(target)
    if (items.length === 0) return

    this.menuEl = this.createMenu(items)
    this.menuEl.style.position = 'fixed'
    this.menuEl.style.left = `${screenX}px`
    this.menuEl.style.top = `${screenY}px`
    this.menuEl.style.zIndex = '10000'
    document.body.appendChild(this.menuEl)
    this.adjustPosition(this.menuEl)

    requestAnimationFrame(() => {
      const handler = (ev: MouseEvent) => {
        if (this.menuEl && !this.menuEl.contains(ev.target as Node) &&
            (!this.submenuEl || !this.submenuEl.contains(ev.target as Node))) {
          this.close()
          document.removeEventListener('mousedown', handler)
        }
      }
      document.addEventListener('mousedown', handler)
    })
  }

  // --- 菜单构建 ---

  private buildMenuItems(target: 'canvas' | FlowNode | FlowEdge): MenuItem[] {
    if (target === 'canvas') return this.buildCanvasMenu()
    if ('shape' in target) return this.buildNodeMenu(target)
    return this.buildEdgeMenu(target)
  }

  private buildCanvasMenu(): MenuItem[] {
    const hasClip = this.fc.state.clipboardNodes.length > 0
    return [
      {
        label: '添加节点', icon: '⊕',
        children: [
          { label: '矩形', icon: '▭', action: () => this.fc.addNodeAtCenter('rect') },
          { label: '圆角矩形', icon: '▢', action: () => this.fc.addNodeAtCenter('round-rect') },
          { label: '菱形', icon: '◇', action: () => this.fc.addNodeAtCenter('diamond') },
          { label: '圆形', icon: '○', action: () => this.fc.addNodeAtCenter('circle') },
        ],
      },
      { label: '粘贴', icon: '📋', disabled: !hasClip, action: hasClip ? () => this.paste() : undefined },
      { divider: true },
      { label: '全选', icon: '⊡', action: () => this.selectAll() },
      { label: '适配视图', icon: '⤢', action: () => this.fc.fitView() },
      { divider: true },
      { label: '撤销', icon: '↶', disabled: !this.fc.canUndo(), action: () => this.fc.undo() },
      { label: '重做', icon: '↷', disabled: !this.fc.canRedo(), action: () => this.fc.redo() },
    ]
  }

  private buildNodeMenu(node: FlowNode): MenuItem[] {
    return [
      { label: '剪切', icon: '✂', action: () => this.cutNode(node) },
      { label: '复制', icon: '⎘', action: () => this.copyNode(node) },
      { label: '复制节点', icon: '📋', action: () => this.duplicateNode(node) },
      { label: '删除', icon: '✕', action: () => { this.fc.removeNode(node.id) } },
      { divider: true },
      { label: '编辑文字', icon: '✎', action: () => this.fc.startEdit(node) },
      {
        label: '更改形状', icon: '◇',
        children: (['rect', 'round-rect', 'diamond', 'circle'] as NodeShape[]).map(shape => ({
          label: shape === 'round-rect' ? '圆角矩形' : shape === 'rect' ? '矩形' : shape === 'diamond' ? '菱形' : '圆形',
          action: () => { this.changeShape(node, shape); this.close() },
        })),
      },
    ]
  }

  private buildEdgeMenu(edge: FlowEdge): MenuItem[] {
    return [
      { label: '删除连线', icon: '✕', action: () => { this.fc.removeEdge(edge.id) } },
    ]
  }

  // --- 菜单操作 ---

  private cutNode(node: FlowNode): void {
    const relatedEdges = this.getRelatedEdges(node.id)
    this.fc.state.setClipboard([node], relatedEdges)
    this.fc.removeNode(node.id)
  }

  private copyNode(node: FlowNode): void {
    const relatedEdges = this.getRelatedEdges(node.id)
    this.fc.state.setClipboard([node], relatedEdges)
  }

  private duplicateNode(node: FlowNode): void {
    const newNode: FlowNode = {
      ...node,
      id: uid('node-'),
      x: node.x + 30,
      y: node.y + 30,
    }
    this.fc.state.nodes.set(newNode.id, newNode)
    this.fc.state.select(newNode.id)
    this.fc.emitSelectionChange()
    this.fc.history.execute({
      type: 'duplicate-node',
      do: () => { this.fc.state.nodes.set(newNode.id, newNode); this.fc.state.markDirty() },
      undo: () => { this.fc.state.nodes.delete(newNode.id); this.fc.state.markDirty() },
    })
    this.fc.emit('node:add', { node: newNode })
    this.fc.forceRender()
  }

  private paste(): void {
    const { clipboardNodes, clipboardEdges } = this.fc.state
    if (clipboardNodes.length === 0) return

    const newIds: string[] = []
    const idMap = new Map<string, string>()
    const newNodes: FlowNode[] = []

    for (const n of clipboardNodes) {
      const newId = uid('node-')
      idMap.set(n.id, newId)
      const newN: FlowNode = { ...n, id: newId, x: n.x + 30, y: n.y + 30 }
      this.fc.state.nodes.set(newId, newN)
      newIds.push(newId)
      newNodes.push(newN)
    }

    const newEdges: FlowEdge[] = []
    for (const e of clipboardEdges) {
      const newSource = idMap.get(e.sourceId)
      const newTarget = idMap.get(e.targetId)
      if (newSource && newTarget) {
        const edge = this.fc.state.addEdge(newSource, e.sourceAnchor, newTarget, e.targetAnchor)
        if (edge) newEdges.push(edge)
      }
    }

    this.fc.state.selectNone()
    for (const id of newIds) this.fc.state.selectAdd(id)
    this.fc.emitSelectionChange()

    this.fc.history.execute({
      type: 'paste',
      do: () => {
        for (const n of newNodes) this.fc.state.nodes.set(n.id, n)
        for (const e of newEdges) this.fc.state.edges.set(e.id, e)
        this.fc.state.markDirty()
      },
      undo: () => {
        for (const n of newNodes) this.fc.state.nodes.delete(n.id)
        for (const e of newEdges) this.fc.state.edges.delete(e.id)
        this.fc.state.markDirty()
      },
    })

    for (const n of newNodes) this.fc.emit('node:add', { node: n })
    this.fc.forceRender()
  }

  private selectAll(): void {
    this.fc.state.selectNone()
    for (const id of this.fc.state.nodes.keys()) this.fc.state.selectAdd(id)
    this.fc.emitSelectionChange()
    this.fc.forceRender()
  }

  private getRelatedEdges(nodeId: string): FlowEdge[] {
    const result: FlowEdge[] = []
    for (const e of this.fc.state.edges.values()) {
      if (e.sourceId === nodeId || e.targetId === nodeId) result.push(e)
    }
    return result
  }

  private changeShape(node: FlowNode, shape: NodeShape): void {
    const newSize = DEFAULT_NODE_SIZE[shape]
    this.fc.history.execute({
      type: 'change-shape',
      do: () => this.fc.state.updateNode(node.id, { shape, width: newSize.width, height: newSize.height }),
      undo: () => this.fc.state.updateNode(node.id, { shape: node.shape, width: node.width, height: node.height }),
    })
    this.fc.emit('node:update', { node: this.fc.state.getNode(node.id)!, changes: { shape, width: newSize.width, height: newSize.height } })
    this.fc.forceRender()
  }

  // --- 菜单 DOM 渲染 ---

  private createMenu(items: MenuItem[]): HTMLDivElement {
    const menu = document.createElement('div')
    menu.className = 'fc-context-menu'

    for (const item of items) {
      if (item.divider) {
        const d = document.createElement('div')
        d.className = 'fc-ctx-divider'
        menu.appendChild(d)
        continue
      }

      const btn = document.createElement('div')
      btn.className = 'fc-ctx-item'
      if (item.disabled) btn.classList.add('fc-ctx-disabled')

      btn.innerHTML = `<span class="fc-ctx-icon">${item.icon || ''}</span><span class="fc-ctx-label">${item.label}</span>`
      if (item.children) {
        const arrow = document.createElement('span')
        arrow.className = 'fc-ctx-arrow'
        arrow.textContent = '▸'
        btn.appendChild(arrow)
      }

      if (!item.disabled) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          this.close()
          item.action?.()
        })
        if (item.children) {
          btn.addEventListener('mouseenter', () => { this.openSubmenu(item.children!, btn) })
        }
      }

      menu.appendChild(btn)
    }
    return menu
  }

  private openSubmenu(items: MenuItem[], parentBtn: HTMLElement): void {
    if (this.submenuEl && this.submenuEl.dataset.parentId === parentBtn.textContent) return

    this.closeSubmenu()
    const parentRect = parentBtn.getBoundingClientRect()
    this.submenuEl = this.createMenu(items)
    this.submenuEl.dataset.parentId = parentBtn.textContent || ''
    this.submenuEl.style.position = 'fixed'
    this.submenuEl.style.left = `${parentRect.right + 2}px`
    this.submenuEl.style.top = `${parentRect.top}px`
    this.submenuEl.style.zIndex = '10001'
    document.body.appendChild(this.submenuEl)
    this.adjustPosition(this.submenuEl)
  }

  private closeSubmenu(): void {
    if (this.submenuEl) { this.submenuEl.remove(); this.submenuEl = null }
  }

  private adjustPosition(el: HTMLElement): void {
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        el.style.left = `${parseInt(el.style.left) - rect.width - 4}px`
      }
      if (rect.bottom > window.innerHeight) {
        el.style.top = `${window.innerHeight - rect.height - 4}px`
      }
    })
  }

  /** 销毁 */
  destroy(): void {
    this.close()
  }
}
