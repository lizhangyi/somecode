// engine/svg-exporter.ts — SVG 矢量图导出（方案 A：直接从数据模型生成 SVG XML）
// 复用几何层纯函数计算路径，将 Canvas 绘制原语映射为 SVG 元素

import type {
  FlowNode, FlowEdge, ThemeColors, Point, LineType, ExportBackground,
} from '../core/types'
import type { Flowchart } from '../core/flowchart'
import { getAnchorPosition } from '../geometry/anchors'
import { getControlPoints, cubicBezier } from '../geometry/bezier'
import { getOrthogonalPath } from '../geometry/edges'
import { NODE_COLORS, FONT_FAMILY, FONT_SIZE, GRID_SIZE, GRID_MAJOR_INTERVAL } from '../geometry/config'

// ============================================================
//  工具函数
// ============================================================

/** 数字格式化：保留 2 位小数，去除尾随零 */
function f(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** XML 特殊字符转义 */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 估算字符宽度（替代 Canvas measureText） */
function charWidth(char: string): number {
  const code = char.charCodeAt(0)
  // CJK 统一汉字、CJK 标点、假名等全角字符约为方形
  if (code >= 0x4e00 && code <= 0x9fff) return FONT_SIZE
  if (code >= 0x3000 && code <= 0x30ff) return FONT_SIZE
  if (code >= 0xff00 && code <= 0xffef) return FONT_SIZE
  // ASCII / Latin 约为字号 0.55 倍
  return FONT_SIZE * 0.55
}

/** 估算文本总宽度 */
function textWidth(text: string): number {
  let w = 0
  for (const c of text) w += charWidth(c)
  return w
}

/** 文字换行（估算宽度版，逻辑与 nodes.ts 的 wrapText 一致） */
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
    if (textWidth(test) > maxWidth && current) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

// ============================================================
//  包围盒计算
// ============================================================

/** 计算所有节点的包围盒（含 padding） */
function calcBounds(
  nodes: Map<string, FlowNode>, padding: number,
): { x: number; y: number; w: number; h: number } {
  if (nodes.size === 0) {
    return { x: 0, y: 0, w: 200, h: 100 }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of nodes.values()) {
    minX = Math.min(minX, node.x - node.width / 2)
    minY = Math.min(minY, node.y - node.height / 2)
    maxX = Math.max(maxX, node.x + node.width / 2)
    maxY = Math.max(maxY, node.y + node.height / 2)
  }
  return {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2,
  }
}

// ============================================================
//  节点 SVG 生成
// ============================================================

/** 生成节点形状 SVG 元素（含 fill/stroke） */
function shapeSVG(node: FlowNode, fill: string, stroke: string): string {
  const { x, y, width: w, height: h, shape } = node
  const attr = `fill="${fill}" stroke="${stroke}" stroke-width="2"`
  switch (shape) {
    case 'rect':
      return `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" ${attr}/>`
    case 'round-rect':
      return `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="8" ${attr}/>`
    case 'circle': {
      const r = Math.min(w, h) / 2
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${attr}/>`
    }
    case 'diamond': {
      const hw = w / 2, hh = h / 2
      const pts = `${f(x)},${f(y - hh)} ${f(x + hw)},${f(y)} ${f(x)},${f(y + hh)} ${f(x - hw)},${f(y)}`
      return `<polygon points="${pts}" ${attr}/>`
    }
  }
}

/** 生成节点文字 SVG（多行 + 省略号，逻辑与 nodes.ts 的 drawNodeText 一致） */
function textSVG(node: FlowNode, theme: ThemeColors): string {
  if (!node.text) return ''

  let availW = node.width - 16
  let availH = node.height - 12
  if (node.shape === 'diamond') {
    availW = node.width * 0.6
    availH = node.height * 0.6
  } else if (node.shape === 'circle') {
    availW = node.width * 0.7
    availH = node.height * 0.7
  }

  const lines = wrapText(node.text, availW)
  const lineH = FONT_SIZE + 4
  const maxLines = Math.floor(availH / lineH)
  const visibleLines = Math.min(lines.length, maxLines)
  const startY = node.y - (visibleLines - 1) * lineH / 2

  let tspans = ''
  for (let i = 0; i < visibleLines; i++) {
    let line = lines[i]
    if (i === visibleLines - 1 && lines.length > maxLines) {
      while (textWidth(line + '...') > availW && line.length > 0) {
        line = line.slice(0, -1)
      }
      line += '...'
    }
    const dy = i === 0 ? '0' : f(lineH)
    tspans += `<tspan x="${f(node.x)}" dy="${dy}">${esc(line)}</tspan>`
  }

  return `<text x="${f(node.x)}" y="${f(startY)}" text-anchor="middle" dominant-baseline="middle" font-family="${esc(FONT_FAMILY)}" font-size="${FONT_SIZE}" fill="${theme.nodeText}">${tspans}</text>`
}

// ============================================================
//  连线 SVG 生成
// ============================================================

/** 生成单条连线的 SVG path d 属性 */
function edgePathD(
  edge: FlowEdge, nodes: Map<string, FlowNode>,
): string {
  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return ''

  const p0 = getAnchorPosition(source, edge.sourceAnchor)
  const p3 = getAnchorPosition(target, edge.targetAnchor)
  const lineType: LineType = edge.lineType || 'bezier'

  if (lineType === 'bezier') {
    const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
    return `M${f(p0.x)} ${f(p0.y)}C${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(p3.x)} ${f(p3.y)}`
  } else {
    const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
    let d = `M${f(path[0].x)} ${f(path[0].y)}`
    for (let i = 1; i < path.length; i++) {
      d += `L${f(path[i].x)} ${f(path[i].y)}`
    }
    return d
  }
}

/** 生成连线标签 SVG */
function edgeLabelSVG(
  edge: FlowEdge, nodes: Map<string, FlowNode>, theme: ThemeColors,
): string {
  if (!edge.label) return ''

  const source = nodes.get(edge.sourceId)
  const target = nodes.get(edge.targetId)
  if (!source || !target) return ''

  const p0 = getAnchorPosition(source, edge.sourceAnchor)
  const p3 = getAnchorPosition(target, edge.targetAnchor)
  const lineType: LineType = edge.lineType || 'bezier'

  let mid: Point
  if (lineType === 'bezier') {
    const { p1, p2 } = getControlPoints(p0, p3, edge.sourceAnchor, edge.targetAnchor)
    mid = cubicBezier(0.5, p0, p1, p2, p3)
  } else {
    const path = getOrthogonalPath(p0, edge.sourceAnchor, p3, edge.targetAnchor)
    const midIdx = Math.floor((path.length - 1) / 2)
    mid = {
      x: (path[midIdx].x + path[midIdx + 1].x) / 2,
      y: (path[midIdx].y + path[midIdx + 1].y) / 2,
    }
  }

  const labelW = textWidth(edge.label)
  const padX = 6
  const rectW = labelW + padX * 2
  const rectH = 18

  return (
    `<rect x="${f(mid.x - rectW / 2)}" y="${f(mid.y - rectH / 2)}" width="${f(rectW)}" height="${rectH}" fill="rgba(30,30,60,0.9)" rx="2"/>` +
    `<text x="${f(mid.x)}" y="${f(mid.y)}" text-anchor="middle" dominant-baseline="middle" font-family="${esc(FONT_FAMILY)}" font-size="12" fill="${theme.nodeText}">${esc(edge.label)}</text>`
  )
}

// ============================================================
//  网格背景 SVG 生成
// ============================================================

/** 生成网格背景 SVG（背景色 + 细线 + 粗线） */
function gridSVG(
  bounds: { x: number; y: number; w: number; h: number },
  theme: ThemeColors,
): string {
  const { x, y, w, h } = bounds
  const right = x + w
  const bottom = y + h

  // 细线
  const startX = Math.floor(x / GRID_SIZE) * GRID_SIZE
  const startY = Math.floor(y / GRID_SIZE) * GRID_SIZE
  let minorD = ''
  for (let gx = startX; gx <= right; gx += GRID_SIZE) {
    minorD += `M${f(gx)} ${f(y)}L${f(gx)} ${f(bottom)}`
  }
  for (let gy = startY; gy <= bottom; gy += GRID_SIZE) {
    minorD += `M${f(x)} ${f(gy)}L${f(right)} ${f(gy)}`
  }

  // 粗线
  const majorStep = GRID_SIZE * GRID_MAJOR_INTERVAL
  const startMX = Math.floor(x / majorStep) * majorStep
  const startMY = Math.floor(y / majorStep) * majorStep
  let majorD = ''
  for (let gx = startMX; gx <= right; gx += majorStep) {
    majorD += `M${f(gx)} ${f(y)}L${f(gx)} ${f(bottom)}`
  }
  for (let gy = startMY; gy <= bottom; gy += majorStep) {
    majorD += `M${f(x)} ${f(gy)}L${f(right)} ${f(gy)}`
  }

  return (
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${theme.background}"/>` +
    `<path d="${minorD}" stroke="${theme.grid}" stroke-width="0.5" fill="none"/>` +
    `<path d="${majorD}" stroke="${theme.gridMajor}" stroke-width="1" fill="none"/>`
  )
}

// ============================================================
//  主函数
// ============================================================

/**
 * 生成完整 SVG 字符串
 * 从 Flowchart 实例读取数据模型，复用几何层纯函数计算路径
 *
 * @param fc Flowchart 实例
 * @param options.background 背景模式：'grid' 网格背景，'transparent' 透明，默认 'transparent'
 * @param options.padding 内容边距，默认 40
 * @returns SVG XML 字符串
 */
export function generateSVG(
  fc: Flowchart,
  options?: { background?: ExportBackground; padding?: number },
): string {
  const background: ExportBackground = options?.background ?? 'transparent'
  const padding = options?.padding ?? 40
  const { state, theme } = fc
  const nodes = state.nodes
  const edges = state.edges

  const bounds = calcBounds(nodes, padding)

  // <defs>: 箭头 marker（userSpaceOnUse 确保尺寸不受 stroke-width 影响）
  const defs =
    `<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" ` +
    `markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">` +
    `<path d="M0 0L10 5L0 10z" fill="${theme.edge}"/></marker>`

  // 背景
  const bg = background === 'grid' ? gridSVG(bounds, theme) : ''

  // 连线（绘制顺序：path → label）
  let edgesSVG = ''
  for (const edge of edges.values()) {
    const d = edgePathD(edge, nodes)
    if (!d) continue
    edgesSVG +=
      `<path d="${d}" stroke="${theme.edge}" stroke-width="2" fill="none" ` +
      `marker-end="url(#arrow)" stroke-linecap="round" stroke-linejoin="round"/>`
    edgesSVG += edgeLabelSVG(edge, nodes, theme)
  }

  // 节点（绘制顺序：shape → text）
  let nodesSVG = ''
  for (const node of nodes.values()) {
    const color = node.color || NODE_COLORS[node.shape]
    nodesSVG +=
      '<g>' +
      shapeSVG(node, theme.nodeFill, color) +
      textSVG(node, theme) +
      '</g>'
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${f(bounds.x)} ${f(bounds.y)} ${f(bounds.w)} ${f(bounds.h)}" ` +
    `width="${f(bounds.w)}" height="${f(bounds.h)}">` +
    `<defs>${defs}</defs>` +
    bg +
    `<g class="edges">${edgesSVG}</g>` +
    `<g class="nodes">${nodesSVG}</g>` +
    `</svg>`
  )
}
