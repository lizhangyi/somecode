import { ref, onBeforeUnmount } from 'vue'
import { Flowchart } from 'flowchart-canvas'
import type {
  FlowNode, NodeShape, LineType, ThemeOption, ExportBackground,
} from 'flowchart-canvas'

// 同步 CSS 主题变量
function syncCssTheme(theme: ThemeOption) {
  document.documentElement.dataset.theme = theme as string
}

// 主题持久化
const THEME_KEY = 'flowchart-theme'

function saveTheme(theme: ThemeOption) {
  localStorage.setItem(THEME_KEY, theme as string)
}

function loadTheme(): ThemeOption {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

// 模块级单例
const fc = ref<Flowchart | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// 响应式状态
const selectedNodeIds = ref<string[]>([])
const selectedEdgeIds = ref<string[]>([])
const selectedNode = ref<FlowNode | null>(null)

const canUndo = ref(false)
const canRedo = ref(false)
const zoomScale = ref(1)
const currentTheme = ref<ThemeOption>(loadTheme())
const defaultLineType = ref<LineType>('bezier')
const snapToGrid = ref(true)

// 初始化时立即同步 CSS 主题（避免页面闪烁）
syncCssTheme(currentTheme.value)

// 创建实例
function initFlowchart(canvas: HTMLCanvasElement) {
  canvasRef.value = canvas
  const instance = new Flowchart(canvas, {
    theme: currentTheme.value,
    snapToGrid: snapToGrid.value,
    defaultLineType: defaultLineType.value,
    contextMenu: true,
    textEditor: true,
  })
  fc.value = instance

  // 初始同步 CSS 主题
  syncCssTheme(currentTheme.value)

  // 事件监听
  instance.on('selection:change', (e) => {
    selectedNodeIds.value = e.selectedIds
    selectedEdgeIds.value = e.selectedEdgeIds
    refreshSelectedNode()
  })
  instance.on('node:add', () => refreshSelectedNode())
  instance.on('node:update', () => refreshSelectedNode())
  instance.on('node:remove', () => refreshSelectedNode())
  instance.on('history:change', () => {
    canUndo.value = instance.canUndo()
    canRedo.value = instance.canRedo()
  })
  instance.on('viewport:change', (e) => {
    zoomScale.value = e.viewport.scale
  })
  instance.on('theme:change', (e) => {
    currentTheme.value = e.theme as ThemeOption
    syncCssTheme(e.theme as ThemeOption)
    saveTheme(e.theme as ThemeOption)
  })
  instance.on('line-type:change', (e) => {
    defaultLineType.value = e.lineType
  })
  instance.on('dirty', () => {
    saveToLocalStorage(instance.toJSON())
  })

  // 初始化状态
  canUndo.value = instance.canUndo()
  canRedo.value = instance.canRedo()
  zoomScale.value = instance.getViewport().scale

  // 恢复数据或创建示例
  const saved = localStorage.getItem('flowchart-canvas-data')
  if (saved) {
    instance.fromJSON(saved)
  } else {
    addDemoNodes(instance)
  }

  // 自动保存兜底
  window.addEventListener('beforeunload', onBeforeUnload)

  return instance
}

function onBeforeUnload() {
  if (fc.value) {
    localStorage.setItem('flowchart-canvas-data', fc.value.toJSON())
  }
}

function refreshSelectedNode() {
  if (!fc.value) return
  const ids = selectedNodeIds.value
  if (ids.length === 1) {
    selectedNode.value = fc.value.getNode(ids[0]) || null
  } else {
    selectedNode.value = null
  }
}

function saveToLocalStorage(json: string) {
  localStorage.setItem('flowchart-canvas-data', json)
}

function addDemoNodes(instance: Flowchart) {
  const n1 = instance.addNode('rect', 200, 200, '开始')
  instance.addNode('round-rect', 200, 350, '处理')
  instance.addNode('diamond', 200, 500, '判断')
  instance.addNode('circle', 200, 650, '结束')
  const n2 = instance.addNode('rect', 450, 200, '输出')
  instance.addEdge(n1.id, 'right', n2.id, 'left')
}

// 工具栏操作
function addNode(shape: NodeShape) {
  fc.value?.addNodeAtCenter(shape)
}

function undo() { fc.value?.undo() }
function redo() { fc.value?.redo() }
function deleteSelected() { fc.value?.deleteSelected() }

function zoomIn() { fc.value?.zoomIn() }
function zoomOut() { fc.value?.zoomOut() }
function fitView() { fc.value?.fitView() }
function resetZoom() {
  fc.value?.setZoom(1)
}

function toggleTheme() {
  const next: ThemeOption = currentTheme.value === 'dark' ? 'light' : 'dark'
  fc.value?.setTheme(next)
}

function toggleLineType() {
  fc.value?.toggleDefaultLineType()
}

function toggleSnap() {
  if (!fc.value) return
  const next = !snapToGrid.value
  fc.value.setSnapToGrid(next)
  snapToGrid.value = next
}

// 属性面板操作
function updateNodeText(text: string) {
  if (!selectedNode.value || !fc.value) return
  fc.value.updateNode(selectedNode.value.id, { text })
}

function updateNodeSize(width: number, height: number) {
  if (!selectedNode.value || !fc.value) return
  fc.value.updateNode(selectedNode.value.id, { width, height })
}

function updateNodeColor(color: string) {
  if (!selectedNode.value || !fc.value) return
  fc.value.updateNode(selectedNode.value.id, { color })
}

function removeSelectedNode() {
  deleteSelected()
  selectedNode.value = null
}

// 导出
function exportJSON() {
  if (!fc.value) return
  const json = fc.value.toJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'flowchart.json'
  a.click()
  URL.revokeObjectURL(url)
}

function exportImage(bg: ExportBackground) {
  if (!fc.value) return
  const dataUrl = fc.value.exportImage({ background: bg, scale: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `flowchart-${bg}.png`
  a.click()
}

function exportSVG(bg: ExportBackground) {
  if (!fc.value) return
  const svg = fc.value.exportSVG({ background: bg })
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flowchart-${bg}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

// 导入
function importJSON(file: File) {
  if (!fc.value) return
  const reader = new FileReader()
  reader.onload = () => {
    const json = reader.result as string
    if (fc.value!.fromJSON(json)) {
      refreshSelectedNode()
    } else {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
}

function destroy() {
  window.removeEventListener('beforeunload', onBeforeUnload)
  fc.value?.destroy()
  fc.value = null
}

export function useFlowchart() {
  return {
    fc, canvasRef,
    selectedNodeIds, selectedEdgeIds, selectedNode,
    canUndo, canRedo, zoomScale,
    currentTheme, defaultLineType, snapToGrid,
    initFlowchart, destroy,
    addNode, undo, redo, deleteSelected,
    zoomIn, zoomOut, fitView, resetZoom,
    toggleTheme, toggleLineType, toggleSnap,
    updateNodeText, updateNodeSize, updateNodeColor, removeSelectedNode,
    exportJSON, exportImage, exportSVG, importJSON,
  }
}
