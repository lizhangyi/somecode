<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFlowchart } from '../composables/useFlowchart'

const { selectedNode, updateNodeText, updateNodeSize, updateNodeColor, removeSelectedNode } = useFlowchart()

const shapeLabels: Record<string, string> = {
  rect: '矩形',
  'round-rect': '圆角矩形',
  diamond: '菱形',
  circle: '圆形',
}

const text = ref('')
const width = ref(120)
const height = ref(60)
const color = ref('#4e7eff')

const shapeLabel = computed(() => {
  if (!selectedNode.value) return ''
  return shapeLabels[selectedNode.value.shape] || selectedNode.value.shape
})

// 当选中节点变化时，同步表单
watch(selectedNode, (node) => {
  if (!node) {
    text.value = ''
    width.value = 120
    height.value = 60
    color.value = '#4e7eff'
    return
  }
  text.value = node.text
  width.value = node.width
  height.value = node.height
  color.value = node.color || '#4e7eff'
}, { immediate: true })

function onTextChange() {
  updateNodeText(text.value)
}

function onSizeChange() {
  updateNodeSize(width.value, height.value)
}

function onColorChange() {
  updateNodeColor(color.value)
}

function onDelete() {
  removeSelectedNode()
}
</script>

<template>
  <div class="property-panel">
    <template v-if="selectedNode">
      <div class="panel-title">属性</div>

      <el-form size="small" label-width="56px">
        <el-form-item label="类型">
          <span class="field-value">{{ shapeLabel }}</span>
        </el-form-item>

        <el-form-item label="文字">
          <el-input
            v-model="text"
            type="textarea"
            :rows="2"
            @change="onTextChange"
          />
        </el-form-item>

        <el-form-item label="宽度">
          <el-input-number
            v-model="width"
            :min="40" :max="600" :step="10"
            controls-position="right"
            style="width:100%"
            @change="onSizeChange"
          />
        </el-form-item>

        <el-form-item label="高度">
          <el-input-number
            v-model="height"
            :min="40" :max="400" :step="10"
            controls-position="right"
            style="width:100%"
            @change="onSizeChange"
          />
        </el-form-item>

        <el-form-item label="颜色">
          <el-color-picker v-model="color" show-alpha @change="onColorChange" />
        </el-form-item>
      </el-form>

      <el-button type="danger" size="small" style="width:100%;margin-top:16px" @click="onDelete()">
        删除节点
      </el-button>
    </template>

    <template v-else>
      <div class="panel-empty">未选中任何节点</div>
    </template>
  </div>
</template>

<style scoped>
.property-panel {
  width: 240px;
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}
.panel-empty {
  color: var(--text-dim);
  text-align: center;
  padding: 40px 0;
}
.field-value {
  color: var(--text);
  font-size: 13px;
}
</style>
