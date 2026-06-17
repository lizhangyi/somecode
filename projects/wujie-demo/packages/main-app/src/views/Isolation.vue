<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <el-icon size="20" color="#f5222d"><Lock /></el-icon>
            <span style="font-weight: bold;">sub-vue3 - JS/CSS 隔离演示</span>
          </div>
          <div>
            <span class="feature-tag isolation">JS 沙箱隔离</span>
            <span class="feature-tag isolation">CSS 样式隔离</span>
          </div>
        </div>
      </template>
      <el-alert
        title="原生隔离说明"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      >
        <template #default>
          无界通过 <strong>iframe</strong> 提供原生 JS 运行环境隔离，通过 <strong>Web Components (Shadow DOM)</strong>
          实现 CSS 样式隔离。子应用中定义的全局变量和样式不会污染主应用和其他子应用。
          下方子应用故意设置了与主应用同名的变量和样式，请观察隔离效果。
        </template>
      </el-alert>

      <!-- 主应用的全局变量展示 -->
      <el-descriptions title="主应用全局变量" :column="2" border size="small">
        <el-descriptions-item label="window.__MAIN_APP_NAME__">
          {{ mainAppName }}
        </el-descriptions-item>
        <el-descriptions-item label="window.__MAIN_APP_VERSION__">
          {{ mainAppVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="window.__SHARED_THEME__">
          {{ mainTheme }}
        </el-descriptions-item>
        <el-descriptions-item label="window.__APP_SOURCE__">
          主应用 (main-app)
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 加载 sub-vue3 子应用 -->
    <div class="wujie-container">
      <WujieVue
        name="sub-vue3"
        url="http://localhost:3003/"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import WujieVue from 'wujie-vue3'

// 读取主应用的全局变量
const mainAppName = ref((window as any).__MAIN_APP_NAME__ || '未设置')
const mainAppVersion = ref((window as any).__MAIN_APP_VERSION__ || '未设置')
const mainTheme = ref((window as any).__SHARED_THEME__ || '未设置')
</script>
