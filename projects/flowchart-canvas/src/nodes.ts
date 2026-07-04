// nodes.ts — 节点渲染 + 命中检测

import type { FlowNode, NodeShape, Point, ResizeHandle } from './types'
import { ctx } from './canvas'
import { viewport, nodes } from './state'
import { THEME, NODE_COLORS, FONT_FAMILY, FONT_SIZE, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_HIT_SIZE } from './config'
import { pointInRect, pointInCircle, pointInDiamond } from './utils/geometry'

/**
 * 绘制单个节点
 * 调用时ctx应已设置为视口变换
 */
export function drawNode(node: FlowNode, isSelected: boolean) {
  const color = node.color || NODE_COLORS[node.shape]
  const scale = viewport.scale

  ctx.save()

  // 选中态外发光
  if (isSelected) {
    ctx.shadowColor = THEME.selectedOutline
    ctx.shadowBlur = 12
  }

  // 填充和描边
  ctx.fillStyle = THEME.nodeFill
  ctx.strokeStyle = color
  ctx.lineWidth = 2 / scale  // 保持视觉线宽一致

  drawShape(node.shape, node.x, node.y, node.width, node.height)

  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  // 文字
  ctx.fillStyle = THEME.nodeText
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  drawNodeText(node.text, node.x, node.y, node.width, node.height, node.shape)

  ctx.restore()
}

/** 根据形状绘制路径 */
function drawShape(shape: NodeShape, cx: number, cy: number, w: number, h: number) {
  ctx.beginPath()
  switch (shape) {
    case 'rect':
      ctx.rect(cx - w / 2, cy - h / 2, w, h)
      break
    case 'round-rect':
      drawRoundRect(cx - w / 2, cy - h / 2, w, h, 8)
      break
    case 'diamond':
      ctx.moveTo(cx, cy - h / 2)
      ctx.lineTo(cx + w / 2, cy)
      ctx.lineTo(cx, cy + h / 2)
      ctx.lineTo(cx - w / 2, cy)
      ctx.closePath()
      break
    case 'circle':
      const r = Math.min(w, h) / 2
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      break
  }
}

/** 绘制圆角矩形路径 */
function drawRoundRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 绘制节点文字（裁剪到形状内 + 自动换行 + 超出显示省略号） */
function drawNodeText(text: string, cx: number, cy: number, w: number, h: number, shape: NodeShape) {
  if (!text) return

  // 菱形和圆形需要缩小可用区域
  let availW = w - 16
  let availH = h - 12
  if (shape === 'diamond') {
    availW = w * 0.6
    availH = h * 0.6
  } else if (shape === 'circle') {
    availW = w * 0.7
    availH = h * 0.7
  }

  const lines = wrapText(text, availW)
  const lineH = FONT_SIZE + 4

  // 计算可显示的最大行数
  const maxLines = Math.floor(availH / lineH)
  const visibleLines = Math.min(lines.length, maxLines)

  // 居中显示可见行
  const startY = cy - (visibleLines - 1) * lineH / 2

  // 裁剪到节点形状内，确保文字不溢出
  ctx.save()
  drawShape(shape, cx, cy, w, h)
  ctx.clip()

  for (let i = 0; i < visibleLines; i++) {
    let line = lines[i]
    // 最后一行如果被截断，加省略号
    if (i === visibleLines - 1 && lines.length > maxLines) {
      // 确保省略号能放下
      while (ctx.measureText(line + '...').width > availW && line.length > 0) {
        line = line.slice(0, -1)
      }
      line = line + '...'
    }
    ctx.fillText(line, cx, startY + i * lineH)
  }

  ctx.restore()
}

/** 文字换行 */
function wrapText(text: string, maxWidth: number): string[] {
  const chars = text.split('')
  const lines: string[] = []
  let current = ''

  for (const char of chars) {
    if (char === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const test = current + char
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/**
 * 命中检测：返回点击位置命中的节点（从后往前，即最上层）
 */
export function hitTestNode(point: Point): FlowNode | null {
  // 从最后添加的节点开始检测（视觉上在上层）
  const nodeArray = Array.from(getAllNodes()).reverse()
  for (const node of nodeArray) {
    if (hitTestNodeShape(point, node)) {
      return node
    }
  }
  return null
}

/** 判断点是否在某个节点形状内 */
export function hitTestNodeShape(point: Point, node: FlowNode): boolean {
  const { x, y, width, height, shape } = node
  switch (shape) {
    case 'rect':
    case 'round-rect':
      return pointInRect(point, x, y, width, height)
    case 'circle':
      const r = Math.min(width, height) / 2
      return pointInCircle(point, x, y, r)
    case 'diamond':
      return pointInDiamond(point, x, y, width, height)
    default:
      return false
  }
}

/** 获取所有节点（按添加顺序） */
export function getAllNodes(): FlowNode[] {
  return Array.from(nodes.values())
}

// --- Resize 手柄 ---

/** 节点 4 个角手柄位置 */
const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'ne', 'se', 'sw']

/** 获取节点 resize 手柄的位置（画布坐标） */
function getResizeHandlePositions(node: FlowNode): Record<ResizeHandle, Point> {
  const { x, y, width, height } = node
  const hw = width / 2
  const hh = height / 2
  return {
    nw: { x: x - hw, y: y - hh },
    n:  { x: x,      y: y - hh },
    ne: { x: x + hw, y: y - hh },
    e:  { x: x + hw, y: y      },
    se: { x: x + hw, y: y + hh },
    s:  { x: x,      y: y + hh },
    sw: { x: x - hw, y: y + hh },
    w:  { x: x - hw, y: y      },
  }
}

/** 绘制选中节点的 resize 手柄（4 个角） */
export function drawResizeHandles(node: FlowNode) {
  const scale = viewport.scale
  const size = RESIZE_HANDLE_SIZE / scale
  const positions = getResizeHandlePositions(node)

  ctx.save()
  ctx.fillStyle = THEME.anchor
  ctx.strokeStyle = THEME.nodeFill
  ctx.lineWidth = 2 / scale

  for (const h of RESIZE_HANDLES) {
    const pos = positions[h]
    ctx.beginPath()
    ctx.rect(pos.x - size / 2, pos.y - size / 2, size, size)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 命中检测：检测点击是否命中节点的 resize 手柄（4 个角）
 * 返回命中的手柄类型，未命中返回 null
 */
export function hitTestResizeHandle(point: Point, node: FlowNode): ResizeHandle | null {
  const scale = viewport.scale
  const hitSize = RESIZE_HANDLE_HIT_SIZE / scale
  const positions = getResizeHandlePositions(node)

  for (const h of RESIZE_HANDLES) {
    const pos = positions[h]
    if (Math.abs(point.x - pos.x) <= hitSize / 2 &&
        Math.abs(point.y - pos.y) <= hitSize / 2) {
      return h
    }
  }
  return null
}

/** 根据 resize 手柄返回对应的 CSS cursor */
export function getResizeCursor(handle: ResizeHandle): string {
  switch (handle) {
    case 'nw':
    case 'se': return 'nwse-resize'
    case 'ne':
    case 'sw': return 'nesw-resize'
    default: return 'default'
  }
}
