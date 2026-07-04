// main.ts — 入口：初始化Canvas、绑定事件、启动渲染循环

import './style.css'
import { initCanvas, resizeCanvas, getCanvasSize } from './canvas'
import { initTextEditor } from './texteditor'
import { initInteraction, updateZoomDisplay, fitView, addNodeAtCenter, deleteSelected } from './interaction'
import { render } from './renderer'
import {
  scheduleRender, forceRender, markDirty, viewport, nodes, edges, selectedIds, updateNode,
  addNode, addEdge, setScale, snapToGrid, toggleSnapToGrid,
  loadState, saveState, clearState, resetViewport,
  defaultLineType, toggleDefaultLineType, setDefaultLineType,
  colorMode, setColorMode, getResolvedTheme,
  getCanvasList, getActiveCanvasId, getActiveCanvasName,
  createCanvas, switchCanvas, renameCanvas, deleteCanvas,
} from './state'
import { execute, undo, redo, canUndo, canRedo } from './history'
import { exportJSON, importJSON, downloadJSON } from './serializer'
import type { NodeShape } from './types'
import { NODE_COLORS, ZOOM_STEP } from './config'
import { clamp } from './utils/geometry'

// --- 初始化 ---
const canvasEl = document.getElementById('canvas') as HTMLCanvasElement
initCanvas(canvasEl)
initTextEditor()
initInteraction()

// --- 初始示例节点 ---
function createDemoNodes() {
  const { width, height } = getCanvasSize()
  const cx = width / 2
  const cy = height / 2

  const start = addNode('round-rect', cx, cy - 140, '开始')
  const process = addNode('rect', cx, cy, '处理数据')
  const decide = addNode('diamond', cx, cy + 140, '是否完成?')
  const end = addNode('round-rect', cx, cy + 280, '结束')

  addEdge(start.id, 'bottom', process.id, 'top')
  addEdge(process.id, 'bottom', decide.id, 'top')
  addEdge(decide.id, 'bottom', end.id, 'top')
}

// 尝试从 localStorage 恢复，失败才创建示例节点
const restored = loadState()
if (!restored) {
  createDemoNodes()
  saveState() // 首次使用，保存为第一个画布
}

// --- 自动保存 ---
// 定时保存（每 5 秒），localStorage 写入很小，性能开销可忽略
setInterval(() => {
  saveState()
}, 5000)

// beforeunload 兜底，确保刷新/关闭前保存
window.addEventListener('beforeunload', () => {
  saveState()
})

// --- 启动渲染循环 ---
markDirty()
scheduleRender(render)

// --- 缩放组件交互 ---
const zoomWidget = document.getElementById('zoom-widget') as HTMLElement
const zoomDisplay = document.getElementById('zoom-display') as HTMLElement
const zoomDropdown = document.getElementById('zoom-dropdown') as HTMLElement
const zoomInput = document.getElementById('zoom-input') as HTMLInputElement
const fitBtn = document.getElementById('fit-btn') as HTMLButtonElement

let zoomDropdownOpen = false
let zoomInputOpen = false

/** 更新适配按钮图标：100%时显示适配图标，非100%时显示还原图标 */
function updateFitButton() {
  const is100 = Math.abs(viewport.scale - 1.0) < 0.01
  if (is100) {
    fitBtn.textContent = '⤢'
    fitBtn.title = '适配视图'
  } else {
    fitBtn.textContent = '⤡'
    fitBtn.title = '还原 100%'
  }
}

/** 关闭下拉和输入框 */
function closeZoomPanels() {
  zoomDropdownOpen = false
  zoomInputOpen = false
  zoomDropdown.classList.remove('open')
  zoomInput.style.display = 'none'
  zoomDisplay.style.display = 'inline'
}

// 单击缩放数字 → 切换下拉面板
zoomDisplay.addEventListener('click', (e) => {
  e.stopPropagation()
  if (zoomInputOpen) return
  zoomDropdownOpen = !zoomDropdownOpen
  if (zoomDropdownOpen) {
    zoomDropdown.classList.add('open')
  } else {
    zoomDropdown.classList.remove('open')
  }
})

// 双击缩放数字 → 直接编辑
zoomDisplay.addEventListener('dblclick', (e) => {
  e.stopPropagation()
  zoomDropdown.classList.remove('open')
  zoomDropdownOpen = false
  zoomInputOpen = true
  zoomInput.style.display = 'block'
  zoomDisplay.style.display = 'none'
  zoomInput.value = String(Math.round(viewport.scale * 100))
  zoomInput.focus()
  zoomInput.select()
})

// 下拉选项点击
zoomDropdown.addEventListener('click', (e) => {
  e.stopPropagation()
  const option = (e.target as HTMLElement).closest('.zoom-option') as HTMLElement | null
  if (!option) return
  const zoom = parseFloat(option.dataset.zoom || '1')
  const { width, height } = getCanvasSize()
  setScale(zoom, { x: width / 2, y: height / 2 })
  closeZoomPanels()
  updateZoomDisplay()
  updateFitButton()
  forceRender(render)
})

// 输入框：Enter确认，Escape取消，blur取消
zoomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    let val = zoomInput.value.trim()
    // 支持 "100%" 或 "100" 或 "0.5" 格式
    val = val.replace('%', '')
    let zoom = parseFloat(val) / 100
    if (isNaN(zoom) || zoom <= 0) {
      closeZoomPanels()
      updateZoomDisplay()
      return
    }
    zoom = clamp(zoom, 0.1, 5.0)
    const { width, height } = getCanvasSize()
    setScale(zoom, { x: width / 2, y: height / 2 })
    closeZoomPanels()
    updateZoomDisplay()
    updateFitButton()
    forceRender(render)
  }
  if (e.key === 'Escape') {
    closeZoomPanels()
    updateZoomDisplay()
  }
})

zoomInput.addEventListener('blur', () => {
  // 延迟关闭，让 Enter 的 keydown 有机会先触发
  setTimeout(() => {
    if (zoomInputOpen) {
      closeZoomPanels()
      updateZoomDisplay()
    }
  }, 150)
})

// 点击外部关闭（缩放组件 + 更多菜单）
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement

  // 缩放组件：下拉或输入框打开时，点击外部关闭
  if ((zoomDropdownOpen || zoomInputOpen) && !zoomWidget.contains(target)) {
    closeZoomPanels()
    updateZoomDisplay()
  }

  // 更多菜单：打开时，点击外部关闭
  const moreMenuEl = document.getElementById('more-menu') as HTMLElement
  const moreBtnEl = document.getElementById('tool-more-btn') as HTMLButtonElement
  if (moreMenuEl && moreMenuEl.classList.contains('open')) {
    if (!moreBtnEl?.contains(target) && !moreMenuEl.contains(target)) {
      moreMenuEl.classList.remove('open')
    }
  }

  // 主题下拉：打开时，点击外部关闭
  if (themeDropdownOpen && !themeWidget.contains(target)) {
    closeThemeDropdown()
  }

  // 形状下拉：打开时，点击外部关闭
  if (shapeDropdownOpen && !shapeWidget.contains(target)) {
    closeShapeDropdown()
  }

  // 画布切换器：打开时，点击外部关闭
  if (canvasDropdownOpen && !canvasSwitcher.contains(target)) {
    closeCanvasDropdown()
  }
})

// --- 工具栏事件 ---
const toolbar = document.getElementById('toolbar')!
toolbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tool-btn') as HTMLElement | null
  if (!btn) return
  if (btn.id === 'tool-more-btn') return
  // 形状下拉按钮单独处理
  if (btn.id === 'shape-btn') return
  const action = btn.dataset.action
  if (!action) return

  switch (action) {
    case 'add-node': {
      const shape = btn.dataset.shape as NodeShape
      if (shape) {
        addNodeAtCenter(shape)
      }
      break
    }
    case 'undo':
      undo()
      forceRender(render)
      updateToolbarState()
      break
    case 'redo':
      redo()
      forceRender(render)
      updateToolbarState()
      break
    case 'zoom-in': {
      const { width, height } = getCanvasSize()
      setScale(viewport.scale + ZOOM_STEP, { x: width / 2, y: height / 2 })
      updateZoomDisplay()
      updateFitButton()
      forceRender(render)
      break
    }
    case 'zoom-out': {
      const { width, height } = getCanvasSize()
      setScale(viewport.scale - ZOOM_STEP, { x: width / 2, y: height / 2 })
      updateZoomDisplay()
      updateFitButton()
      forceRender(render)
      break
    }
    case 'fit': {
      const is100 = Math.abs(viewport.scale - 1.0) < 0.01
      if (is100) {
        fitView()
      } else {
        const { width, height } = getCanvasSize()
        setScale(1.0, { x: width / 2, y: height / 2 })
      }
      updateZoomDisplay()
      updateFitButton()
      forceRender(render)
      break
    }
    case 'toggle-snap':
      toggleSnapToGrid()
      updateToolbarState()
      forceRender(render)
      break
    case 'toggle-line-type': {
      toggleDefaultLineType()
      updateLineTypeButton()
      forceRender(render)
      break
    }
  }
})

// --- 文件导入 ---
const fileInput = document.getElementById('file-input') as HTMLInputElement
fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const json = reader.result as string
    if (importJSON(json)) {
      forceRender(render)
    } else {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  fileInput.value = ''
})

// --- 属性面板 ---
const propEmpty = document.querySelector('.property-empty') as HTMLElement
const propContent = document.querySelector('.property-content') as HTMLElement
const propShape = document.getElementById('prop-shape') as HTMLElement
const propText = document.getElementById('prop-text') as HTMLTextAreaElement
const propWidth = document.getElementById('prop-width') as HTMLInputElement
const propHeight = document.getElementById('prop-height') as HTMLInputElement
const propColor = document.getElementById('prop-color') as HTMLInputElement
const propDelete = document.getElementById('prop-delete') as HTMLButtonElement

let propUpdating = false

function updatePropertyPanel() {
  if (propUpdating) return

  const selectedNodes = Array.from(selectedIds)
    .map(id => nodes.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n)

  if (selectedNodes.length === 1) {
    const node = selectedNodes[0]
    propEmpty.style.display = 'none'
    propContent.style.display = 'block'

    propUpdating = true
    const shapeLabels: Record<string, string> = {
      'rect': '矩形',
      'round-rect': '圆角矩形',
      'diamond': '菱形',
      'circle': '圆形',
    }
    propShape.textContent = shapeLabels[node.shape] || node.shape
    propText.value = node.text
    propWidth.value = String(Math.round(node.width))
    propHeight.value = String(Math.round(node.height))
    propColor.value = node.color || NODE_COLORS[node.shape]
    propUpdating = false
  } else {
    propEmpty.style.display = 'block'
    propContent.style.display = 'none'
  }
}

// 属性面板输入事件
propText.addEventListener('input', () => {
  if (propUpdating) return
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean)
  if (selectedNodes.length === 1 && selectedNodes[0]) {
    const node = selectedNodes[0]
    const oldText = node.text
    const newText = propText.value
    const nodeId = node.id
    execute({
      type: 'edit-text',
      do: () => updateNode(nodeId, { text: newText }),
      undo: () => updateNode(nodeId, { text: oldText }),
    })
    forceRender(render)
  }
})

propWidth.addEventListener('change', () => {
  if (propUpdating) return
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean)
  if (selectedNodes.length === 1 && selectedNodes[0]) {
    const node = selectedNodes[0]
    const oldW = node.width
    const newW = clamp(parseInt(propWidth.value) || oldW, 40, 400)
    const nodeId = node.id
    execute({
      type: 'resize-node',
      do: () => updateNode(nodeId, { width: newW }),
      undo: () => updateNode(nodeId, { width: oldW }),
    })
    forceRender(render)
  }
})

propHeight.addEventListener('change', () => {
  if (propUpdating) return
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean)
  if (selectedNodes.length === 1 && selectedNodes[0]) {
    const node = selectedNodes[0]
    const oldH = node.height
    const newH = clamp(parseInt(propHeight.value) || oldH, 30, 300)
    const nodeId = node.id
    execute({
      type: 'resize-node',
      do: () => updateNode(nodeId, { height: newH }),
      undo: () => updateNode(nodeId, { height: oldH }),
    })
    forceRender(render)
  }
})

propColor.addEventListener('input', () => {
  if (propUpdating) return
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean)
  if (selectedNodes.length === 1 && selectedNodes[0]) {
    const node = selectedNodes[0]
    updateNode(node.id, { color: propColor.value })
    forceRender(render)
  }
})

propColor.addEventListener('change', () => {
  if (propUpdating) return
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean)
  if (selectedNodes.length === 1 && selectedNodes[0]) {
    const node = selectedNodes[0]
    const oldColor = node.color || NODE_COLORS[node.shape]
    const newColor = propColor.value
    const nodeId = node.id
    execute({
      type: 'change-color',
      do: () => updateNode(nodeId, { color: newColor }),
      undo: () => updateNode(nodeId, { color: oldColor }),
    })
  }
})

propDelete.addEventListener('click', () => {
  deleteSelected()
  updatePropertyPanel()
})

// --- 连线类型按钮更新 ---
function updateLineTypeButton() {
  const btn = document.getElementById('toggle-line-type') as HTMLButtonElement | null
  if (!btn) return
  const isOrth = defaultLineType === 'orthogonal'
  btn.textContent = isOrth ? '⟶' : '⟰'
  btn.title = isOrth ? '连线类型：正交折线（点击切换为曲线）' : '连线类型：贝塞尔曲线（点击切换为正交）'
  btn.classList.toggle('active', isOrth)
}

// --- 主题切换按钮更新（已由 updateThemeDisplay 替代）---

// --- 工具栏状态更新 ---
function updateToolbarState() {
  const undoBtn = toolbar.querySelector('[data-action="undo"]') as HTMLButtonElement
  const redoBtn = toolbar.querySelector('[data-action="redo"]') as HTMLButtonElement
  if (undoBtn) undoBtn.disabled = !canUndo()
  if (redoBtn) redoBtn.disabled = !canRedo()

  // 更新吸附按钮样式
  const snapBtn = toolbar.querySelector('[data-action="toggle-snap"]') as HTMLButtonElement
  if (snapBtn) {
    snapBtn.classList.toggle('active', snapToGrid)
    snapBtn.title = snapToGrid ? '对齐网格：开' : '对齐网格：关'
  }

  // 更新连线类型按钮
  updateLineTypeButton()
}

// --- 属性面板开闭 ---
const mainArea = document.querySelector('.main-area') as HTMLElement
const propertyPanel = document.getElementById('property-panel') as HTMLElement
const panelToggleBtn = document.getElementById('panel-toggle') as HTMLButtonElement
let panelCollapsed = false

function togglePropertyPanel() {
  panelCollapsed = !panelCollapsed
  propertyPanel.classList.toggle('collapsed', panelCollapsed)
  mainArea.classList.toggle('panel-collapsed', panelCollapsed)
  panelToggleBtn.textContent = panelCollapsed ? '▸' : '◂'
  panelToggleBtn.title = panelCollapsed ? '展开面板' : '收起面板'
  if (panelCollapsed) {
    propEmpty.style.display = 'none'
    propContent.style.display = 'none'
  } else {
    updatePropertyPanel()
  }
}

panelToggleBtn.addEventListener('click', togglePropertyPanel)

// --- 更多菜单（收纳） ---
const moreBtn = document.getElementById('tool-more-btn') as HTMLButtonElement
const moreMenu = document.getElementById('more-menu') as HTMLElement

function toggleMoreMenu() {
  moreMenu.classList.toggle('open')
}

moreBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleMoreMenu()
})

// 点击菜单项
moreMenu.addEventListener('click', (e) => {
  const item = (e.target as HTMLElement).closest('.more-item') as HTMLElement | null
  if (!item) return
  const action = item.dataset.action
  if (action === 'export') {
    downloadJSON()
  } else if (action === 'import') {
    document.getElementById('file-input')?.click()
  }
  moreMenu.classList.remove('open')
})

// --- 画布切换器组件 ---
const canvasSwitcher = document.getElementById('canvas-switcher') as HTMLElement
const canvasNameBtn = document.getElementById('canvas-name-btn') as HTMLButtonElement
const canvasNameDisplay = document.getElementById('canvas-name-display') as HTMLElement
const canvasListDropdown = document.getElementById('canvas-list-dropdown') as HTMLElement

let canvasDropdownOpen = false

/** 更新画布名称显示 */
function updateCanvasNameDisplay() {
  canvasNameDisplay.textContent = getActiveCanvasName()
}

/** 格式化时间 */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/** 渲染画布列表下拉 */
function renderCanvasList() {
  const list = getCanvasList()
  const activeId = getActiveCanvasId()
  let html = ''

  for (const c of list) {
    const isActive = c.id === activeId
    html += `<div class="canvas-list-item ${isActive ? 'active' : ''}" data-canvas-id="${c.id}">
      <span class="canvas-list-name">${escapeHtml(c.name)}</span>
      <span class="canvas-list-time">${formatTime(c.updatedAt)}</span>
      <span class="canvas-list-delete" data-delete-id="${c.id}" title="删除画布">✕</span>
    </div>`
  }

  html += `<div class="canvas-list-divider"></div>`
  html += `<div class="canvas-list-action" data-action="new-canvas">＋ 新建画布</div>`
  html += `<div class="canvas-list-action" data-action="rename-canvas">✏️ 重命名画布</div>`

  canvasListDropdown.innerHTML = html
}

/** HTML 转义 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function closeCanvasDropdown() {
  canvasDropdownOpen = false
  canvasListDropdown.classList.remove('open')
}

/** 刷新画布切换器状态（名称 + 列表） */
function refreshCanvasSwitcher() {
  updateCanvasNameDisplay()
  if (canvasDropdownOpen) renderCanvasList()
}

canvasNameBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  canvasDropdownOpen = !canvasDropdownOpen
  if (canvasDropdownOpen) {
    renderCanvasList()
    canvasListDropdown.classList.add('open')
  } else {
    canvasListDropdown.classList.remove('open')
  }
})

canvasListDropdown.addEventListener('click', (e) => {
  e.stopPropagation()
  const target = e.target as HTMLElement

  // 删除画布
  const deleteEl = target.closest('.canvas-list-delete') as HTMLElement | null
  if (deleteEl) {
    const id = deleteEl.dataset.deleteId!
    const list = getCanvasList()
    if (list.length <= 1) {
      alert('至少保留一个画布')
      return
    }
    const canvas = list.find(c => c.id === id)
    if (!confirm(`确定要删除画布「${canvas?.name}」吗？`)) return
    deleteCanvas(id)
    refreshCanvasSwitcher()
    updateZoomDisplay()
    updateFitButton()
    updatePropertyPanel()
    forceRender(render)
    return
  }

  // 新建画布
  const actionEl = target.closest('.canvas-list-action') as HTMLElement | null
  if (actionEl) {
    const action = actionEl.dataset.action
    if (action === 'new-canvas') {
      const name = prompt('请输入画布名称：', '未命名画布')
      if (name === null) return
      createCanvas(name.trim())
      closeCanvasDropdown()
      refreshCanvasSwitcher()
      updateZoomDisplay()
      updateFitButton()
      updatePropertyPanel()
      forceRender(render)
    } else if (action === 'rename-canvas') {
      const currentName = getActiveCanvasName()
      const name = prompt('请输入新的画布名称：', currentName)
      if (name === null) return
      renameCanvas(name.trim())
      refreshCanvasSwitcher()
      forceRender(render)
    }
    return
  }

  // 切换画布
  const itemEl = target.closest('.canvas-list-item') as HTMLElement | null
  if (itemEl) {
    const id = itemEl.dataset.canvasId!
    if (id === getActiveCanvasId()) {
      closeCanvasDropdown()
      return
    }
    switchCanvas(id)
    closeCanvasDropdown()
    updateCanvasNameDisplay()
    updateZoomDisplay()
    updateFitButton()
    updatePropertyPanel()
    forceRender(render)
  }
})

// --- 形状下拉组件 ---
const shapeWidget = document.getElementById('shape-widget') as HTMLElement
const shapeBtn = document.getElementById('shape-btn') as HTMLButtonElement
const shapeDropdown = document.getElementById('shape-dropdown') as HTMLElement

let shapeDropdownOpen = false

function closeShapeDropdown() {
  shapeDropdownOpen = false
  shapeDropdown.classList.remove('open')
}

shapeBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  shapeDropdownOpen = !shapeDropdownOpen
  shapeDropdown.classList.toggle('open', shapeDropdownOpen)
})

shapeDropdown.addEventListener('click', (e) => {
  e.stopPropagation()
  const option = (e.target as HTMLElement).closest('.shape-option') as HTMLElement | null
  if (!option) return
  const shape = option.dataset.shape as NodeShape
  if (!shape) return
  addNodeAtCenter(shape)
  closeShapeDropdown()
  forceRender(render)
})

// --- 主题下拉组件 ---
const themeWidget = document.getElementById('theme-widget') as HTMLElement
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement
const themeDropdown = document.getElementById('theme-dropdown') as HTMLElement

let themeDropdownOpen = false

/** 更新主题按钮显示（图标 + 标题 + 下拉选中态） */
function updateThemeDisplay() {
  const resolved = getResolvedTheme(colorMode)
  const isDark = resolved === 'dark'
  // 按钮图标显示实际生效的主题
  themeBtn.textContent = isDark ? '🌙' : '☀️'
  const modeLabels: Record<string, string> = {
    auto: '跟随系统',
    dark: '深色模式',
    light: '浅色模式',
  }
  themeBtn.title = `主题：${modeLabels[colorMode]}（当前生效：${isDark ? '深色' : '浅色'}）`

  // 高亮当前选中项
  themeDropdown.querySelectorAll('.theme-option').forEach(opt => {
    const el = opt as HTMLElement
    el.classList.toggle('selected', el.dataset.themeMode === colorMode)
  })
}

/** 关闭主题下拉 */
function closeThemeDropdown() {
  themeDropdownOpen = false
  themeDropdown.classList.remove('open')
}

// 点击按钮 → 切换下拉
themeBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  themeDropdownOpen = !themeDropdownOpen
  themeDropdown.classList.toggle('open', themeDropdownOpen)
})

// 点击选项 → 切换模式
themeDropdown.addEventListener('click', (e) => {
  e.stopPropagation()
  const option = (e.target as HTMLElement).closest('.theme-option') as HTMLElement | null
  if (!option) return
  const mode = option.dataset.themeMode as 'auto' | 'dark' | 'light'
  if (!mode) return
  setColorMode(mode)
  closeThemeDropdown()
  updateThemeDisplay()
  forceRender(render)
})

// --- 系统主题变化监听（auto 模式下自动跟随） ---
const systemThemeMql = window.matchMedia('(prefers-color-scheme: dark)')
systemThemeMql.addEventListener('change', () => {
  if (colorMode === 'auto') {
    setColorMode('auto') // 重新解析并应用
    updateThemeDisplay()
    forceRender(render)
  }
})

// --- 监听选中变化更新属性面板 ---
let lastSelectedKey = ''
function checkSelectionChange() {
  const currentKey = Array.from(selectedIds).sort().join(',')
  if (currentKey !== lastSelectedKey) {
    lastSelectedKey = currentKey
    updatePropertyPanel()
    updateToolbarState()
  }
  requestAnimationFrame(checkSelectionChange)
}
requestAnimationFrame(checkSelectionChange)

// --- 初始化 ---
// 确保 HTML data-theme 属性与 colorMode 同步（loadState 可能已设置）
document.documentElement.setAttribute('data-theme', getResolvedTheme(colorMode))
updateToolbarState()
updateThemeDisplay()
updateCanvasNameDisplay()
updateFitButton()
updateZoomDisplay()
forceRender(render)

// --- 窗口大小变化时重新调整 ---
window.addEventListener('resize', () => {
  resizeCanvas()
  forceRender(render)
})
