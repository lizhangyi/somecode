// nodes.ts — 节点渲染 + 命中检测

import type { FlowNode, NodeShape, Point } from './types'
import { ctx } from './canvas'
import { viewport, nodes } from './state'
import { THEME, NODE_COLORS, FONT_FAMILY, FONT_SIZE } from './config'
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

/** 绘制节点文字（自动换行 + 居中） */
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
  const startY = cy - (lines.length - 1) * lineH / 2

  for (let i = 0; i < lines.length; i++) {
    // 如果文字超出可用高度，截断
    if (i * lineH > availH) {
      ctx.fillText('...', cx, startY + i * lineH)
      break
    }
    ctx.fillText(lines[i], cx, startY + i * lineH)
  }
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
