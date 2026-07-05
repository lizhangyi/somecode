<script setup lang="ts">
import { ref } from 'vue'
import { useFlowchart } from '../composables/useFlowchart'
import {
  Upload, Download, Plus, RefreshLeft, RefreshRight,
  ZoomIn, ZoomOut, FullScreen, Sunny, Moon, ArrowRight,
} from '@element-plus/icons-vue'
import type { NodeShape, ExportBackground } from 'flowchart-canvas'

const {
  canUndo, canRedo, zoomScale,
  currentTheme, defaultLineType, snapToGrid,
  addNode, undo, redo, deleteSelected,
  zoomIn, zoomOut, fitView, resetZoom,
  toggleTheme, toggleLineType, toggleSnap,
  exportJSON, exportImage, exportSVG, importJSON,
} = useFlowchart()

const fileInputRef = ref<HTMLInputElement | null>(null)
const showAddDropdown = ref(false)

const shapes: { key: NodeShape; label: string; icon: string }[] = [
  { key: 'rect', label: '矩形', icon: '▭' },
  { key: 'round-rect', label: '圆角矩形', icon: '▢' },
  { key: 'diamond', label: '菱形', icon: '◇' },
  { key: 'circle', label: '圆形', icon: '○' },
]

function onAddNode(shape: NodeShape) {
  addNode(shape)
  showAddDropdown.value = false
}

function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) importJSON(file)
  }
  input.click()
}

function onExportImage(bg: ExportBackground) {
  exportImage(bg)
}

function onExportSVG(bg: ExportBackground) {
  exportSVG(bg)
}

const lineTypeLabel = () => defaultLineType.value === 'bezier' ? '贝塞尔' : '正交折线'
const themeIcon = () => currentTheme.value === 'dark' ? Moon : Sunny
</script>

<template>
  <div class="toolbar">
    <!-- 左侧：文件操作 + 添加 -->
    <div class="toolbar-left">
      <el-dropdown trigger="click">
        <el-button size="small">📁 文件</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="exportJSON()">
              💾 导出 JSON
            </el-dropdown-item>
            <el-dropdown-item divided>
              <span class="submenu-trigger">
                图片导出
                <el-icon class="submenu-arrow"><ArrowRight /></el-icon>
              </span>
              <div class="submenu-inline">
                <div class="submenu-item" @click.stop="onExportImage('grid')">▦ 网格背景</div>
                <div class="submenu-item" @click.stop="onExportImage('transparent')">□ 透明背景</div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <span class="submenu-trigger">
                矢量图导出
                <el-icon class="submenu-arrow"><ArrowRight /></el-icon>
              </span>
              <div class="submenu-inline">
                <div class="submenu-item" @click.stop="onExportSVG('grid')">▦ 网格背景</div>
                <div class="submenu-item" @click.stop="onExportSVG('transparent')">□ 透明背景</div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided @click="onImport()">
              📂 导入 JSON
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" v-model="showAddDropdown">
        <el-button size="small">
          <el-icon><Plus /></el-icon> 添加节点
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="s in shapes"
              :key="s.key"
              @click="onAddNode(s.key)"
            >
              <span style="margin-right:8px">{{ s.icon }}</span>
              {{ s.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-divider direction="vertical" />

      <el-button
        :icon="RefreshLeft" size="small"
        :disabled="!canUndo" @click="undo()"
        title="撤销 Ctrl+Z"
      />
      <el-button
        :icon="RefreshRight" size="small"
        :disabled="!canRedo" @click="redo()"
        title="重做 Ctrl+Y"
      />
      <el-button size="small" @click="deleteSelected()" title="删除 Delete">
        🗑️
      </el-button>
    </div>

    <!-- 中间：缩放 + 设置 -->
    <div class="toolbar-center">
      <el-button :icon="ZoomIn" size="small" @click="zoomIn()" title="放大" />
      <span class="zoom-text" @click="resetZoom()">{{ Math.round(zoomScale * 100) }}%</span>
      <el-button :icon="ZoomOut" size="small" @click="zoomOut()" title="缩小" />
      <el-button :icon="FullScreen" size="small" @click="fitView()" title="适配视图" />

      <el-divider direction="vertical" />

      <el-button
        size="small" @click="toggleSnap()"
        :type="snapToGrid ? 'primary' : 'default'"
        title="对齐网格"
      >⊞</el-button>

      <el-button
        size="small" @click="toggleLineType()"
        :type="defaultLineType === 'bezier' ? 'default' : 'primary'"
        :title="lineTypeLabel()"
      >↗</el-button>

      <el-button
        size="small" @click="toggleTheme()"
        :title="currentTheme === 'dark' ? '切换亮色' : '切换暗色'"
      >
        <el-icon v-if="currentTheme === 'dark'"><Sunny /></el-icon>
        <el-icon v-else><Moon /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
}
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 4px;
}
.zoom-text {
  min-width: 48px;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
  user-select: none;
}
.submenu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  position: relative;
}
.submenu-arrow {
  margin-left: auto;
  font-size: 10px;
}
.submenu-inline {
  display: none;
  position: absolute;
  left: 100%;
  top: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  min-width: 140px;
  z-index: 101;
}
.submenu-trigger:hover .submenu-inline {
  display: block;
}
.submenu-item {
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
}
.submenu-item:hover {
  background: var(--accent-hover);
}
</style>
