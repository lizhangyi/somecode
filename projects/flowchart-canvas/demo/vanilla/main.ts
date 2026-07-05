// demo/vanilla/main.ts — Vanilla JS Demo 应用入口
// 展示如何使用 Flowchart Headless 库构建完整 UI

import 'flowchart-canvas/style.css'
import './style.css'
import { Flowchart, NODE_COLORS, ZOOM_STEP, clamp } from 'flowchart-canvas'
import type { FlowNode, NodeShape, LineType } from 'flowchart-canvas'

// --- 创建 Flowchart 实例 ---
const canvasEl = document.getElementById('canvas') as HTMLCanvasElement
const fc = new Flowchart(canvasEl, {
  theme: 'dark',
  snapToGrid: true,
  defaultLineType: 'bezier',
  contextMenu: true,
  textEditor: true,
})

// --- 创建示例节点 ---
function createDemoNodes() {
  const { width, height } = fc.canvasHelper.getCanvasSize()
  const cx = width / 2
  const cy = height / 2

  const start = fc.addNode('round-rect', cx, cy - 140, '开始')
  const process = fc.addNode('rect', cx, cy, '处理数据')
  const decide = fc.addNode('diamond', cx, cy + 140, '是否完成?')
  const end = fc.addNode('round-rect', cx, cy + 280, '结束')

  fc.addEdge(start.id, 'bottom', process.id, 'top')
  fc.addEdge(process.id, 'bottom', decide.id, 'top')
  fc.addEdge(decide.id, 'bottom', end.id, 'top')
}

createDemoNodes()

// --- 缩放显示（事件驱动） ---
const zoomDisplay = document.getElementById('zoom-display')!

function updateZoomDisplay() {
  zoomDisplay.textContent = `${Math.round(fc.getViewport().scale * 100)}%`
}

fc.on('viewport:change', () => {
  updateZoomDisplay()
})

// --- 工具栏事件 ---
const toolbar = document.getElementById('toolbar')!

toolbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tool-btn') as HTMLElement | null
  if (!btn) return
  if (btn.id === 'shape-btn') return

  const action = btn.dataset.action
  if (!action) return

  switch (action) {
    case 'undo':
      fc.undo()
      updateToolbarState()
      break
    case 'redo':
      fc.redo()
      updateToolbarState()
      break
    case 'zoom-in': {
      const { width, height } = fc.canvasHelper.getCanvasSize()
      fc.setScale(fc.getViewport().scale + ZOOM_STEP, { x: width / 2, y: height / 2 })
      break
    }
    case 'zoom-out': {
      const { width, height } = fc.canvasHelper.getCanvasSize()
      fc.setScale(fc.getViewport().scale - ZOOM_STEP, { x: width / 2, y: height / 2 })
      break
    }
    case 'fit':
      fc.fitView()
      break
    case 'toggle-snap':
      fc.toggleSnapToGrid()
      updateToolbarState()
      break
    case 'toggle-line-type':
      fc.toggleDefaultLineType()
      updateLineTypeButton()
      break
  }
})

// --- 形状下拉 ---
const shapeBtn = document.getElementById('shape-btn')!
const shapeDropdown = document.getElementById('shape-dropdown')!
let shapeDropdownOpen = false

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
  fc.addNodeAtCenter(shape)
  shapeDropdownOpen = false
  shapeDropdown.classList.remove('open')
})

document.addEventListener('click', (e) => {
  if (shapeDropdownOpen && !shapeBtn.contains(e.target as HTMLElement)) {
    shapeDropdownOpen = false
    shapeDropdown.classList.remove('open')
  }
})

// --- 主题切换 ---
const themeBtn = document.getElementById('theme-btn')!
let currentTheme: 'dark' | 'light' = 'dark'

themeBtn.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
  fc.setTheme(currentTheme)
  themeBtn.textContent = currentTheme === 'dark' ? '🌙' : '☀️'
  themeBtn.title = `主题：${currentTheme === 'dark' ? '深色' : '浅色'}`
})

// --- 连线类型按钮 ---
function updateLineTypeButton() {
  const btn = document.getElementById('toggle-line-type') as HTMLButtonElement | null
  if (!btn) return
  const isOrth = fc.state.defaultLineType === 'orthogonal'
  btn.textContent = isOrth ? '⟶' : '⟰'
  btn.title = isOrth ? '正交折线（点击切换为曲线）' : '贝塞尔曲线（点击切换为正交）'
  btn.classList.toggle('active', isOrth)
}

// --- 工具栏状态更新（事件驱动） ---
function updateToolbarState() {
  const undoBtn = toolbar.querySelector('[data-action="undo"]') as HTMLButtonElement
  const redoBtn = toolbar.querySelector('[data-action="redo"]') as HTMLButtonElement
  if (undoBtn) undoBtn.disabled = !fc.canUndo()
  if (redoBtn) redoBtn.disabled = !fc.canRedo()

  const snapBtn = toolbar.querySelector('[data-action="toggle-snap"]') as HTMLButtonElement
  if (snapBtn) {
    snapBtn.classList.toggle('active', fc.state.snapToGrid)
    snapBtn.title = fc.state.snapToGrid ? '对齐网格：开' : '对齐网格：关'
  }

  updateLineTypeButton()
}

// 历史栈变化时更新工具栏
fc.on('history:change', () => updateToolbarState())

// --- 属性面板（事件驱动，不再轮询） ---
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
  const selectedNodes = fc.getSelectedNodes()

  if (selectedNodes.length === 1) {
    const node = selectedNodes[0]
    propEmpty.style.display = 'none'
    propContent.style.display = 'block'

    propUpdating = true
    const shapeLabels: Record<string, string> = {
      'rect': '矩形', 'round-rect': '圆角矩形',
      'diamond': '菱形', 'circle': '圆形',
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

// 选中变化时更新属性面板
fc.on('selection:change', () => {
  updatePropertyPanel()
  updateToolbarState()
})

// 节点更新时也刷新属性面板
fc.on('node:update', () => {
  updatePropertyPanel()
})

// 属性面板输入事件
propText.addEventListener('input', () => {
  if (propUpdating) return
  const nodes = fc.getSelectedNodes()
  if (nodes.length === 1) {
    fc.updateNode(nodes[0].id, { text: propText.value })
  }
})

propWidth.addEventListener('change', () => {
  if (propUpdating) return
  const nodes = fc.getSelectedNodes()
  if (nodes.length === 1) {
    const newW = clamp(parseInt(propWidth.value) || nodes[0].width, 40, 400)
    fc.updateNode(nodes[0].id, { width: newW })
  }
})

propHeight.addEventListener('change', () => {
  if (propUpdating) return
  const nodes = fc.getSelectedNodes()
  if (nodes.length === 1) {
    const newH = clamp(parseInt(propHeight.value) || nodes[0].height, 30, 300)
    fc.updateNode(nodes[0].id, { height: newH })
  }
})

propColor.addEventListener('input', () => {
  if (propUpdating) return
  const nodes = fc.getSelectedNodes()
  if (nodes.length === 1) {
    fc.updateNode(nodes[0].id, { color: propColor.value })
  }
})

propDelete.addEventListener('click', () => {
  fc.deleteSelected()
})

// --- 导入/导出 ---
document.getElementById('btn-export')!.addEventListener('click', () => {
  const json = fc.toJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'flowchart.json'
  a.click()
  URL.revokeObjectURL(url)
})

const fileInput = document.getElementById('file-input') as HTMLInputElement
document.getElementById('btn-import')!.addEventListener('click', () => {
  fileInput.click()
})

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const json = reader.result as string
    if (fc.fromJSON(json)) {
      updatePropertyPanel()
      updateZoomDisplay()
    } else {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  fileInput.value = ''
})

// --- 窗口大小变化 ---
window.addEventListener('resize', () => {
  fc.canvasHelper.resizeCanvas()
  fc.forceRender()
})

// --- 初始化 ---
updateZoomDisplay()
updateToolbarState()
updatePropertyPanel()
