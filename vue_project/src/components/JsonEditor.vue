<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const initialJSON = {
  name: '张三',
  age: 28,
  city: '北京',
  email: 'zhangsan@example.com',
  role: 'developer',
  active: true,
  score: 95.5
}

const jsonOutput = ref(JSON.stringify(initialJSON, null, 2))
const dialogVisible = ref(false)
const rows = ref([])
const parseError = ref('')

function openDialog() {
  parseError.value = ''
  try {
    const obj = JSON.parse(jsonOutput.value)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('仅支持单层 Object 结构')
    }
    rows.value = Object.entries(obj).map(([key, value]) => ({
      key,
      value: value !== null && value !== undefined ? String(value) : ''
    }))
    dialogVisible.value = true
  } catch (e) {
    parseError.value = 'JSON 解析失败：' + e.message
  }
}

function addRow() {
  rows.value.push({ key: '', value: '' })
}

function deleteRow(index) {
  rows.value.splice(index, 1)
}

function clearRows() {
  rows.value = []
}

function save() {
  const obj = {}
  for (const row of rows.value) {
    const key = row.key.trim()
    if (!key) continue
    const val = row.value.trim()
    let parsed = val
    if (val === 'null') parsed = null
    else if (val === 'true') parsed = true
    else if (val === 'false') parsed = false
    else if (val !== '' && !isNaN(Number(val))) parsed = Number(val)
    obj[key] = parsed
  }
  jsonOutput.value = JSON.stringify(obj, null, 2)
  dialogVisible.value = false
  ElMessage.success('保存成功')
}
</script>

<template>
  <div class="json-editor">
    <h1>JSON 编辑器</h1>

    <div class="section-label">
      <span>JSON 数据</span>
      <el-button type="primary" size="small" @click="openDialog">编辑</el-button>
    </div>

    <el-input
      type="textarea"
      :rows="14"
      :model-value="jsonOutput"
      readonly
      class="json-textarea"
    />

    <el-dialog
      v-model="dialogVisible"
      title="编辑 JSON"
      width="700px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert
        v-if="parseError"
        :title="parseError"
        type="error"
        show-icon
        :closable="false"
        class="parse-error"
      />

      <div class="dialog-toolbar">
        <el-button type="primary" @click="addRow">+ 新增</el-button>
        <el-button @click="clearRows">清空表格</el-button>
      </div>

      <el-table :data="rows" max-height="400" stripe>
        <el-table-column label="KEY" min-width="45">
          <template #default="{ row }">
            <el-input v-model="row.key" placeholder="key" />
          </template>
        </el-table-column>
        <el-table-column label="VALUE" min-width="45">
          <template #default="{ row }">
            <el-input
              v-model="row.value"
              placeholder="value"
              @keydown.enter="(e) => {
                const allInputs = document.querySelectorAll('.el-table__body-wrapper input')
                const idx = Array.from(allInputs).indexOf(e.target)
                const next = allInputs[idx + 1]
                next ? next.focus() : addRow()
              }"
            />
          </template>
        </el-table-column>
        <el-table-column label="" width="64">
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              circle
              @click="deleteRow($index)"
            >
              &times;
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.json-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px;
}

.json-editor h1 {
  font-size: 22px;
  margin-bottom: 20px;
  color: #1a1a2e;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.json-textarea :deep(textarea) {
  font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.dialog-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.parse-error {
  margin-bottom: 14px;
}
</style>
