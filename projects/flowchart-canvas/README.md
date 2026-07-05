# FlowChart Canvas

一个 Headless 的 Canvas 流程图库。只负责流程图的**渲染 + 交互 + 数据管理**，不提供任何预设 UI，所有操作通过实例 API 和事件系统完成。

## 特性

- **Headless** — 无预设 UI，完全由使用者控制界面
- **多实例** — `new Flowchart(canvas, options)` 创建独立实例，同一页面可多实例
- **事件驱动** — 内置 EventEmitter，无需轮询检测状态变化
- **主题系统** — 内置深色/浅色预设，支持完全自定义颜色对象
- **内置交互** — 拖拽、缩放、框选、连线、调整大小、撤销/重做
- **可选功能** — 右键菜单和文字编辑器内置，可通过选项关闭
- **序列化** — `toJSON()` / `fromJSON()` + `dirty` 事件，存储策略由使用者决定
- **导出图片** — `exportImage()` PNG 位图 + `exportSVG()` SVG 矢量图，支持网格/透明背景
- **纯 Canvas 渲染** — 不依赖任何框架

---

## 安装

### npm

```bash
npm install flowchart-canvas
```

### pnpm

```bash
pnpm add flowchart-canvas
```

### 源码引用（monorepo / 本地开发）

在 `vite.config.ts` 中配置路径别名：

```ts
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      'flowchart-canvas/style.css': fileURLToPath(new URL('./src/style.css', import.meta.url)),
      'flowchart-canvas': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
})
```

同时在 `tsconfig.json` 中配置 paths：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "flowchart-canvas/style.css": ["./src/style.css"],
      "flowchart-canvas": ["./src/index.ts"]
    }
  }
}
```

---

## 快速开始

```ts
import 'flowchart-canvas/style.css'
import { Flowchart } from 'flowchart-canvas'

// 1. 获取 canvas 元素
const canvas = document.getElementById('canvas') as HTMLCanvasElement

// 2. 创建实例
const fc = new Flowchart(canvas, {
  theme: 'dark',
})

// 3. 添加节点和连线
const start = fc.addNode('round-rect', 200, 100, '开始')
const process = fc.addNode('rect', 200, 220, '处理数据')
fc.addEdge(start.id, 'bottom', process.id, 'top')

// 4. 监听事件
fc.on('selection:change', (e) => {
  console.log('选中:', e.selectedIds)
})

fc.on('dirty', () => {
  localStorage.setItem('flowchart', fc.toJSON())
})
```

需要一个 `<canvas>` 元素：

```html
<canvas id="canvas"></canvas>
```

---

## 构造选项

```ts
const fc = new Flowchart(canvas, options)
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | 主题 |
| `snapToGrid` | `boolean` | `true` | 是否启用网格对齐 |
| `defaultLineType` | `'bezier' \| 'orthogonal'` | `'bezier'` | 默认连线类型 |
| `contextMenu` | `boolean` | `true` | 是否启用右键菜单 |
| `textEditor` | `boolean` | `true` | 是否启用双击文字编辑 |
| `minScale` | `number` | `0.2` | 最小缩放比例 |
| `maxScale` | `number` | `3.0` | 最大缩放比例 |

---

## 主题

### 使用预设

```ts
// 字符串预设
fc.setTheme('dark')   // 深色
fc.setTheme('light')  // 浅色
```

### 自定义颜色

传入完整的 `ThemeColors` 对象，覆盖任意颜色：

```ts
import type { ThemeColors } from 'flowchart-canvas'

const myTheme: ThemeColors = {
  background:   '#0d1117',
  grid:         'rgba(255,255,255,0.04)',
  gridMajor:    'rgba(255,255,255,0.08)',
  nodeFill:     'rgba(30,30,60,0.9)',
  nodeStroke:   '#58a6ff',
  nodeText:     '#e6edf3',
  edge:         'rgba(120,120,180,0.6)',
  edgeSelected: '#58a6ff',
  anchor:       '#58a6ff',
  anchorHover:  '#79c0ff',
  tempEdge:     'rgba(88,166,255,0.5)',
  selectedOutline:    '#79c0ff',
  selectionBox:       'rgba(121,192,255,0.1)',
  selectionBoxBorder: 'rgba(121,192,255,0.4)',
}

const fc = new Flowchart(canvas, { theme: myTheme })
```

### ThemeColors 完整字段

| 字段 | 说明 |
|------|------|
| `background` | 画布背景色 |
| `grid` | 网格细线颜色 |
| `gridMajor` | 网格主线颜色 |
| `nodeFill` | 节点填充色 |
| `nodeStroke` | 节点边框色 |
| `nodeText` | 节点文字色 |
| `edge` | 连线颜色 |
| `edgeSelected` | 选中连线颜色 |
| `anchor` | 锚点颜色 |
| `anchorHover` | 锚点悬停颜色 |
| `tempEdge` | 临时连线颜色 |
| `selectedOutline` | 选中节点轮廓色 |
| `selectionBox` | 框选区域填充色 |
| `selectionBoxBorder` | 框选区域边框色 |

---

## API

### 节点操作

#### `addNode(shape, x, y, text?)`

添加节点，返回创建的节点对象。

```ts
const node = fc.addNode('rect', 100, 100, '处理数据')
// node.id, node.shape, node.x, node.y, node.width, node.height, node.text
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `shape` | `'rect' \| 'round-rect' \| 'diamond' \| 'circle'` | 节点形状 |
| `x` | `number` | 画布坐标 X（中心点） |
| `y` | `number` | 画布坐标 Y（中心点） |
| `text` | `string` | 节点文字（可选） |

#### `addNodeAtCenter(shape)`

在当前视口中心添加节点并自动选中。

```ts
fc.addNodeAtCenter('diamond')
```

#### `removeNode(id)`

删除节点（同时删除关联的连线）。

```ts
fc.removeNode(node.id)
```

#### `updateNode(id, updates)`

更新节点属性。

```ts
fc.updateNode(node.id, { text: '新文字', width: 160, color: '#ff6b6b' })
```

可更新字段：`shape`、`x`、`y`、`width`、`height`、`text`、`color`。

#### `getNode(id)`

获取单个节点。

```ts
const node = fc.getNode('node-abc123')
```

#### `getAllNodes()`

获取所有节点数组。

```ts
const nodes = fc.getAllNodes()
```

---

### 连线操作

#### `addEdge(sourceId, sourceAnchor, targetId, targetAnchor, label?)`

添加连线，返回创建的连线对象。如果源/目标节点不存在则返回 `null`。

```ts
const edge = fc.addEdge(
  start.id, 'bottom',  // 源节点 + 源锚点方向
  end.id,   'top',     // 目标节点 + 目标锚点方向
  '是'                 // 标签（可选）
)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `sourceId` | `string` | 源节点 ID |
| `sourceAnchor` | `'top' \| 'right' \| 'bottom' \| 'left'` | 源锚点方向 |
| `targetId` | `string` | 目标节点 ID |
| `targetAnchor` | `'top' \| 'right' \| 'bottom' \| 'left'` | 目标锚点方向 |
| `label` | `string` | 连线标签（可选） |

#### `removeEdge(id)`

删除连线。

```ts
fc.removeEdge(edge.id)
```

#### `getEdge(id)` / `getAllEdges()`

获取单个 / 全部连线。

---

### 选中操作

```ts
fc.select(id)        // 单选（清除其他选中）
fc.selectAdd(id)     // 追加选中
fc.selectNone()      // 清空选中
fc.isSelected(id)    // 是否选中
fc.getSelectedNodes()  // 获取选中的节点数组
fc.getSelectedEdges()  // 获取选中的连线数组
```

#### `deleteSelected()`

删除所有选中的节点和连线（含级联删除）。

```ts
fc.deleteSelected()
```

---

### 视口操作

```ts
fc.setScale(1.5)                       // 设置缩放（可选以屏幕点为中心）
fc.setScale(1.5, { x: 400, y: 300 })  // 以屏幕坐标 (400,300) 为中心缩放
fc.setOffset(100, 50)                  // 设置平移偏移
fc.resetViewport()                     // 重置视口到 1.0 / 0,0
fc.fitView()                           // 适配视图，使所有节点可见
fc.getViewport()                       // 获取当前视口 { scale, offsetX, offsetY }
```

---

### 设置

```ts
fc.setSnapToGrid(true)           // 开关网格对齐
fc.toggleSnapToGrid()            // 切换网格对齐
fc.setDefaultLineType('orthogonal')  // 设置默认连线类型
fc.toggleDefaultLineType()       // 切换连线类型
```

---

### 历史（撤销/重做）

```ts
fc.undo()          // 撤销
fc.redo()          // 重做
fc.canUndo()       // 是否可撤销
fc.canRedo()       // 是否可重做
fc.clearHistory()  // 清空历史栈
```

所有通过 API 执行的操作（addNode、removeNode、addEdge、deleteSelected 等）都会自动记录到历史栈，支持撤销/重做。

---

### 序列化

#### `toJSON()`

导出为 JSON 字符串。

```ts
const json = fc.toJSON()
// {
//   "version": "1.1.0",
//   "nodes": [...],
//   "edges": [...],
//   "defaultLineType": "bezier"
// }
```

#### `fromJSON(json)`

从 JSON 字符串导入，成功返回 `true`，失败返回 `false`。

```ts
const json = localStorage.getItem('flowchart')
if (json) {
  fc.fromJSON(json)
}
```

> **存储策略由使用者负责。** 库不关心你用 localStorage、IndexedDB 还是后端 API。推荐监听 `dirty` 事件触发持久化。

---

### 导出图片

```ts
fc.exportImage(options?)  // 返回 PNG data URL
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `background` | `'grid' \| 'transparent'` | `'grid'` | 背景模式：`grid` 带网格背景色，`transparent` 透明背景（PNG 透明通道） |
| `scale` | `number` | `1` | 导出倍率，`2` = 2x 高清 |

```ts
// 带网格背景
const dataUrl = fc.exportImage({ background: 'grid' })

// 透明背景（适合叠加到其他文档）
const dataUrl = fc.exportImage({ background: 'transparent' })

// 2x 高清
const dataUrl = fc.exportImage({ background: 'grid', scale: 2 })

// 下载
const a = document.createElement('a')
a.href = dataUrl
a.download = 'flowchart.png'
a.click()
```

导出时不会包含交互元素（选中框、锚点、resize 手柄等），只输出连线 + 节点内容。

### 导出 SVG 矢量图

```ts
fc.exportSVG(options?)  // 返回 SVG XML 字符串
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `background` | `'grid' \| 'transparent'` | `'transparent'` | 背景模式：`grid` 带网格背景色，`transparent` 透明背景 |
| `padding` | `number` | `40` | 内容边距（画布坐标） |

```ts
// 透明背景（默认）
const svg = fc.exportSVG()

// 网格背景
const svg = fc.exportSVG({ background: 'grid' })

// 下载
const blob = new Blob([svg], { type: 'image/svg+xml' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'flowchart.svg'
a.click()
URL.revokeObjectURL(url)
```

SVG 矢量图放大不失真，可用 Figma、Illustrator 等工具编辑。导出内容与 `exportImage` 一致（只含连线 + 节点），但路径和形状使用 SVG 元素（`<rect>`、`<circle>`、`<path>` 等）。

---

### 文字编辑

```ts
fc.startEdit(node)    // 开始编辑指定节点的文字
fc.isEditing()        // 是否正在编辑
```

默认行为：双击节点进入编辑模式。可通过 `options.textEditor: false` 关闭。

---

### 右键菜单

```ts
fc.showContextMenu(screenX, screenY, target)  // 显示菜单
fc.closeContextMenu()                          // 关闭菜单
fc.isContextMenuOpen()                         // 菜单是否打开
```

`target` 可以是 `'canvas'`、节点对象或连线对象。可通过 `options.contextMenu: false` 关闭。

---

### 渲染控制

```ts
fc.forceRender()  // 强制重新渲染
fc.render()       // 直接渲染（同步，跳过 dirty 检查）
fc.markDirty()    // 标记数据已变化
```

通常无需手动调用 — 任何 API 操作都会自动触发渲染。仅在特殊场景（如 canvas 尺寸变化）下使用 `forceRender()`。

---

### 销毁

```ts
fc.destroy()
```

销毁实例，移除所有事件监听器、DOM 元素和 RAF 循环。页面卸载前应调用。

---

## 事件

通过 `on()` 监听事件，返回取消监听的函数。

```ts
const off = fc.on('selection:change', (e) => {
  console.log(e.selectedIds)
})

// 取消监听
off()
// 或
fc.off('selection:change', listener)
```

### 事件列表

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `node:add` | `{ node: FlowNode }` | 添加节点 |
| `node:remove` | `{ id: string }` | 删除节点 |
| `node:update` | `{ node: FlowNode, changes: Partial<FlowNode> }` | 更新节点 |
| `edge:add` | `{ edge: FlowEdge }` | 添加连线 |
| `edge:remove` | `{ id: string }` | 删除连线 |
| `selection:change` | `{ selectedIds: string[] }` | 选中变化 |
| `viewport:change` | `{ viewport: Viewport }` | 视口变化 |
| `dirty` | `void` | 数据已变化（可触发持久化） |
| `theme:change` | `{ theme: ThemeColors }` | 主题变化 |
| `history:change` | `{ canUndo: boolean, canRedo: boolean }` | 历史栈变化 |
| `destroy` | `void` | 实例销毁 |

### 典型用法

```ts
// 持久化
fc.on('dirty', () => {
  localStorage.setItem('flowchart-data', fc.toJSON())
})

// 更新工具栏按钮状态
fc.on('history:change', ({ canUndo, canRedo }) => {
  undoBtn.disabled = !canUndo
  redoBtn.disabled = !canRedo
})

// 更新属性面板
fc.on('selection:change', (e) => {
  if (e.selectedIds.length === 1) {
    showPropertyPanel(fc.getNode(e.selectedIds[0]))
  } else {
    hidePropertyPanel()
  }
})

// 同步缩放显示
fc.on('viewport:change', ({ viewport }) => {
  zoomDisplay.textContent = `${Math.round(viewport.scale * 100)}%`
})
```

---

## 类型定义

```ts
type NodeShape  = 'rect' | 'round-rect' | 'diamond' | 'circle'
type AnchorDir  = 'top' | 'right' | 'bottom' | 'left'
type LineType   = 'bezier' | 'orthogonal'

interface FlowNode {
  id: string
  shape: NodeShape
  x: number        // 画布坐标（中心点）
  y: number
  width: number
  height: number
  text: string
  color?: string   // 自定义颜色，不设则用主题默认色
}

interface FlowEdge {
  id: string
  sourceId: string
  sourceAnchor: AnchorDir
  targetId: string
  targetAnchor: AnchorDir
  label?: string
  lineType?: LineType
}

interface Viewport {
  scale: number     // 1.0 = 100%
  offsetX: number   // 屏幕像素
  offsetY: number
}
```

所有类型均可从包入口导入：

```ts
import type {
  NodeShape, AnchorDir, LineType,
  FlowNode, FlowEdge, Viewport, Point,
  FlowchartData, ThemeColors, ThemeOption,
  FlowchartOptions, EventMap,
} from 'flowchart-canvas'
```

---

## 内置交互

库内置以下鼠标/键盘交互，无需额外代码：

| 操作 | 方式 |
|------|------|
| 拖拽节点 | 鼠标按下节点并拖动 |
| 框选 | 鼠标按下空白区域并拖动 |
| 平移画布 | 鼠标中键拖动 / 空格+拖动 |
| 缩放 | 鼠标滚轮 |
| 连线 | 从节点锚点拖拽到目标节点 |
| 重连连线 | 拖拽连线端点 |
| 调整节点大小 | 拖拽选中节点的边角手柄 |
| 编辑文字 | 双击节点（需 `textEditor: true`） |
| 右键菜单 | 右键点击（需 `contextMenu: true`） |
| 删除 | Delete / Backspace 键 |
| 撤销/重做 | Ctrl+Z / Ctrl+Y |
| 全选 | Ctrl+A |
| 取消选中 | Escape |

---

## 完整示例

```ts
import 'flowchart-canvas/style.css'
import { Flowchart } from 'flowchart-canvas'

const canvas = document.getElementById('canvas') as HTMLCanvasElement

// 创建实例
const fc = new Flowchart(canvas, {
  theme: 'dark',
  snapToGrid: true,
  defaultLineType: 'bezier',
  contextMenu: true,
  textEditor: true,
})

// 加载已保存的数据
const saved = localStorage.getItem('flowchart-data')
if (saved) {
  fc.fromJSON(saved)
} else {
  // 创建示例流程
  const start   = fc.addNode('round-rect', 300, 100, '开始')
  const input   = fc.addNode('rect',       300, 220, '接收输入')
  const decide  = fc.addNode('diamond',    300, 340, '是否有效?')
  const process = fc.addNode('rect',       480, 340, '处理数据')
  const error   = fc.addNode('rect',       120, 340, '返回错误')
  const end     = fc.addNode('round-rect', 300, 460, '结束')

  fc.addEdge(start.id,   'bottom', input.id,   'top')
  fc.addEdge(input.id,   'bottom', decide.id,  'top')
  fc.addEdge(decide.id,  'right',  process.id, 'left',  '是')
  fc.addEdge(decide.id,  'left',   error.id,   'right', '否')
  fc.addEdge(process.id, 'bottom', end.id,     'top')
  fc.addEdge(error.id,   'bottom', end.id,     'top')

  fc.fitView()
}

// 自动持久化
fc.on('dirty', () => {
  localStorage.setItem('flowchart-data', fc.toJSON())
})

// 窗口大小变化时重绘
window.addEventListener('resize', () => {
  fc.canvasHelper.resizeCanvas()
  fc.forceRender()
})
```

---

## 项目结构

```
src/
  core/           核心层
    types.ts        类型定义
    theme.ts        主题系统
    event-emitter.ts  事件系统
    state.ts        状态管理
    flowchart.ts    主类（API 入口）
  engine/          引擎层
    canvas.ts       Canvas 辅助（DPR、坐标转换）
    renderer.ts     渲染管线
    history.ts      撤销/重做
    interaction.ts  鼠标/键盘交互
    text-editor.ts  文字编辑器（可选）
    context-menu.ts 右键菜单（可选）
  geometry/        几何层（纯函数）
    config.ts       常量
    geometry.ts     几何工具
    bezier.ts       贝塞尔曲线
    nodes.ts        节点渲染
    edges.ts        连线渲染
    anchors.ts      锚点渲染
    grid.ts         网格渲染
  index.ts         公共导出
  style.css        库内置组件样式
demo/
  vanilla/         原生 JS 示例
```
