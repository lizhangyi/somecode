// contextmenu.ts — 右键上下文菜单
// 根据右键目标（空白/节点/连线）显示不同菜单项，支持子菜单

import type { FlowNode, FlowEdge, NodeShape } from './types'
import {
  nodes, edges, selectedIds, clipboardNodes, clipboardEdges,
  addNode, removeNode, updateNode, addEdge, removeEdge,
  select, selectNone, selectAdd,
  setClipboard, getSelectedNodes, getSelectedEdges,
  forceRender,
} from './state'
import { execute, undo, redo, canUndo, canRedo } from './history'
import { startEdit } from './texteditor'
import { fitView, deleteSelected, addNodeAtCenter } from './interaction'
import { render } from './renderer'
import { NODE_COLORS, DEFAULT_NODE_SIZE } from './config'
import { uid } from './utils/geometry'

// --- 类型定义 ---

export interface MenuItem {
  label?: string
  icon?: string
  action?: () => void
  disabled?: boolean
  divider?: boolean
  /** 子菜单项 */
  children?: MenuItem[]
}

// --- 菜单容器 ---

let menuEl: HTMLDivElement | null = null
let submenuEl: HTMLDivElement | null = null
let closeTimer: number | null = null

/** 关闭所有菜单 */
export function closeContextMenu() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  if (menuEl) { menuEl.remove(); menuEl = null }
  if (submenuEl) { submenuEl.remove(); submenuEl = null }
}

/** 是否有菜单打开 */
export function isContextMenuOpen(): boolean {
  return menuEl !== null
}

// --- 菜单构建 ---

export function buildMenuItems(target: 'canvas' | FlowNode | FlowEdge): MenuItem[] {
  if (target === 'canvas') return buildCanvasMenu()
  if ('shape' in target) return buildNodeMenu(target)
  return buildEdgeMenu(target)
}

function buildCanvasMenu(): MenuItem[] {
  const hasClip = clipboardNodes.length > 0
  return [
    {
      label: '添加节点',
      icon: '⊕',
      children: [
        { label: '矩形', icon: '▭', action: () => addNodeAtCenter('rect') },
        { label: '圆角矩形', icon: '▢', action: () => addNodeAtCenter('round-rect') },
        { label: '菱形', icon: '◇', action: () => addNodeAtCenter('diamond') },
        { label: '圆形', icon: '○', action: () => addNodeAtCenter('circle') },
      ],
    },
    { label: '粘贴', icon: '📋', disabled: !hasClip, action: hasClip ? paste : undefined },
    { divider: true },
    { label: '全选', icon: '⊡', action: selectAll },
    { label: '适配视图', icon: '⤢', action: fitView },
    { divider: true },
    { label: '撤销', icon: '↶', disabled: !canUndo(), action: () => { undo(); forceRender(render) } },
    { label: '重做', icon: '↷', disabled: !canRedo(), action: () => { redo(); forceRender(render) } },
  ]
}

function buildNodeMenu(node: FlowNode): MenuItem[] {
  return [
    { label: '剪切', icon: '✂', action: () => cutNode(node) },
    { label: '复制', icon: '⎘', action: () => copyNode(node) },
    { label: '复制节点', icon: '📋', action: () => duplicateNode(node) },
    { label: '删除', icon: '✕', action: () => { removeNode(node.id); forceRender(render) } },
    { divider: true },
    { label: '编辑文字', icon: '✎', action: () => startEdit(node) },
    {
      label: '更改形状',
      icon: '◇',
      children: (['rect', 'round-rect', 'diamond', 'circle'] as NodeShape[]).map(shape => ({
        label: shape === 'round-rect' ? '圆角矩形' : shape === 'rect' ? '矩形' : shape === 'diamond' ? '菱形' : '圆形',
        action: () => { changeShape(node, shape); closeContextMenu() },
      })),
    },
  ]
}

function buildEdgeMenu(edge: FlowEdge): MenuItem[] {
  return [
    { label: '删除连线', icon: '✕', action: () => { removeEdge(edge.id); forceRender(render) } },
  ]
}

// --- 菜单操作 ---

function cutNode(node: FlowNode) {
  const relatedEdges = getRelatedEdges(node.id)
  setClipboard([node], relatedEdges)
  removeNode(node.id)
  forceRender(render)
}

function copyNode(node: FlowNode) {
  const relatedEdges = getRelatedEdges(node.id)
  setClipboard([node], relatedEdges)
}

function duplicateNode(node: FlowNode) {
  const newNode: FlowNode = {
    ...node,
    id: uid('node-'),
    x: node.x + 30,
    y: node.y + 30,
  }
  nodes.set(newNode.id, newNode)
  select(newNode.id)
  forceRender(render)
}

function paste() {
  if (clipboardNodes.length === 0) return
  const newIds: string[] = []
  const idMap = new Map<string, string>()
  for (const n of clipboardNodes) {
    const newId = uid('node-')
    idMap.set(n.id, newId)
    const newN: FlowNode = { ...n, id: newId, x: n.x + 30, y: n.y + 30 }
    nodes.set(newId, newN)
    newIds.push(newId)
  }
  for (const e of clipboardEdges) {
    const newSource = idMap.get(e.sourceId)
    const newTarget = idMap.get(e.targetId)
    if (newSource && newTarget) {
      addEdge(newSource, e.sourceAnchor, newTarget, e.targetAnchor)
    }
  }
  selectNone()
  for (const id of newIds) selectAdd(id)
  forceRender(render)
}

function selectAll() {
  selectNone()
  for (const id of nodes.keys()) selectAdd(id)
  forceRender(render)
}

function getRelatedEdges(nodeId: string): FlowEdge[] {
  const result: FlowEdge[] = []
  for (const e of edges.values()) {
    if (e.sourceId === nodeId || e.targetId === nodeId) result.push(e)
  }
  return result
}

function changeShape(node: FlowNode, shape: NodeShape) {
  const newSize = DEFAULT_NODE_SIZE[shape]
  updateNode(node.id, { shape, width: newSize.width, height: newSize.height })
  forceRender(render)
}

// --- 菜单渲染 ---

function createMenu(items: MenuItem[]): HTMLDivElement {
  const menu = document.createElement('div')
  menu.className = 'context-menu'

  for (const item of items) {
    if (item.divider) {
      const d = document.createElement('div')
      d.className = 'ctx-divider'
      menu.appendChild(d)
      continue
    }

    const btn = document.createElement('div')
    btn.className = 'ctx-item'
    if (item.disabled) btn.classList.add('ctx-disabled')

    btn.innerHTML = `<span class="ctx-icon">${item.icon || ''}</span><span class="ctx-label">${item.label}</span>`
    if (item.children) {
      const arrow = document.createElement('span')
      arrow.className = 'ctx-arrow'
      arrow.textContent = '▸'
      btn.appendChild(arrow)
    }

    if (!item.disabled) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        closeContextMenu()
        item.action?.()
      })

      if (item.children) {
        btn.addEventListener('mouseenter', () => { openSubmenu(item.children!, btn) })
      }
    }

    menu.appendChild(btn)
  }
  return menu
}

function openSubmenu(items: MenuItem[], parentBtn: HTMLElement) {
  // 如果已存在且父项相同，不重建
  if (submenuEl && submenuEl.dataset.parentId === getBtnId(parentBtn)) return

  closeSubmenu()
  const parentRect = parentBtn.getBoundingClientRect()
  submenuEl = createMenu(items)
  submenuEl.dataset.parentId = getBtnId(parentBtn)
  submenuEl.style.position = 'fixed'
  submenuEl.style.left = `${parentRect.right + 2}px`
  submenuEl.style.top = `${parentRect.top}px`
  submenuEl.style.zIndex = '10001'
  document.body.appendChild(submenuEl)
  adjustPosition(submenuEl)
}

function closeSubmenu() {
  if (submenuEl) { submenuEl.remove(); submenuEl = null }
}

function getBtnId(btn: HTMLElement): string {
  return btn.textContent || ''
}

function adjustPosition(el: HTMLElement) {
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

// --- 公开 API ---

export function showContextMenu(
  screenX: number,
  screenY: number,
  target: 'canvas' | FlowNode | FlowEdge
) {
  closeContextMenu()
  const items = buildMenuItems(target)
  if (items.length === 0) return

  menuEl = createMenu(items)
  menuEl.style.position = 'fixed'
  menuEl.style.left = `${screenX}px`
  menuEl.style.top = `${screenY}px`
  menuEl.style.zIndex = '10000'
  document.body.appendChild(menuEl)
  adjustPosition(menuEl)

  // 点击外部关闭
  requestAnimationFrame(() => {
    const handler = (ev: MouseEvent) => {
      if (menuEl && !menuEl.contains(ev.target as Node) && (!submenuEl || !submenuEl.contains(ev.target as Node))) {
        closeContextMenu()
        document.removeEventListener('mousedown', handler)
      }
    }
    document.addEventListener('mousedown', handler)
  })
}
