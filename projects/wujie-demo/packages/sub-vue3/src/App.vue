<template>
  <div class="app-container">
    <div class="app-header">
      <span class="app-title">JS/CSS 隔离演示</span>
      <span class="app-badge">sub-vue3 | Vue3</span>
    </div>

    <!-- JS 沙箱隔离对比 -->
    <div class="compare-section">
      <div class="compare-title">JS 沙箱隔离 (iframe)</div>

      <div class="compare-grid">
        <div class="compare-card child">
          <div class="compare-card-label">子应用 (sub-vue3)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__MAIN_APP_NAME__</div>
          <div class="compare-card-value">{{ childAppName }}</div>
        </div>
        <div class="compare-card parent">
          <div class="compare-card-label">主应用 (main-app)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__MAIN_APP_NAME__</div>
          <div class="compare-card-value">{{ parentAppName }}</div>
        </div>

        <div class="compare-card child">
          <div class="compare-card-label">子应用 (sub-vue3)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__SHARED_THEME__</div>
          <div class="compare-card-value">{{ childTheme }}</div>
        </div>
        <div class="compare-card parent">
          <div class="compare-card-label">主应用 (main-app)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__SHARED_THEME__</div>
          <div class="compare-card-value">{{ parentTheme }}</div>
        </div>

        <div class="compare-card child">
          <div class="compare-card-label">子应用 (sub-vue3)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__APP_SOURCE__</div>
          <div class="compare-card-value">{{ childSource }}</div>
        </div>
        <div class="compare-card parent">
          <div class="compare-card-label">主应用 (main-app)</div>
          <div style="margin-bottom: 6px; font-size: 12px; color: #999;">window.__APP_SOURCE__</div>
          <div class="compare-card-value">{{ parentSource }}</div>
        </div>
      </div>

      <div class="tip-box success">
        <strong>隔离效果:</strong> 子应用通过 iframe 获得了独立的 window 对象。
        修改子应用的全局变量不会影响主应用，反之亦然。
        子应用通过 <code>window.parent</code> 可以只读访问主应用的全局变量。
      </div>
    </div>

    <!-- CSS 样式隔离对比 -->
    <div class="compare-section">
      <div class="compare-title">CSS 样式隔离 (Web Components / Shadow DOM)</div>

      <div class="css-demo">
        <h4>相同 class 名，不同样式效果</h4>

        <div class="shared-class-name">.shared-class-name (子应用样式)</div>
        <div style="font-size: 12px; color: #999; margin-bottom: 12px;">
          子应用中 .shared-class-name = 红色背景 + 粗体
        </div>

        <div class="another-shared-class">.another-shared-class (子应用样式)</div>
        <div style="font-size: 12px; color: #999; margin-bottom: 12px;">
          子应用中 .another-shared-class = 渐变背景 + 白色文字
        </div>
      </div>

      <div class="tip-box warning" style="margin-top: 12px;">
        <strong>样式隔离说明:</strong> 无界将子应用的 DOM 渲染在 Web Components 的 Shadow DOM 中，
        因此即使子应用和主应用使用了完全相同的 class 名称和样式定义，它们也互不影响。
        上方按钮的样式只在子应用内生效，不会影响主应用的任何元素。
      </div>
    </div>

    <!-- 环境信息 -->
    <div class="compare-section">
      <div class="compare-title">运行环境信息</div>
      <div style="background: #16213e; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 2; border: 1px solid rgba(255,255,255,0.1);">
        <div><span style="color: #999;">运行环境:</span> <span style="color: #e94560;">{{ isWujie ? '无界微前端 (iframe 沙箱)' : '独立运行' }}</span></div>
        <div><span style="color: #999;">window.location.href:</span> <span style="color: #e94560;">{{ windowHref }}</span></div>
        <div><span style="color: #999;">document 类型:</span> <span style="color: #e94560;">{{ isWujie ? 'Shadow DOM (隔离)' : '原生 document' }}</span></div>
        <div><span style="color: #999;">CSS 隔离方式:</span> <span style="color: #e94560;">{{ isWujie ? 'Web Components Shadow DOM' : '无' }}</span></div>
        <div><span style="color: #999;">JS 隔离方式:</span> <span style="color: #e94560;">{{ isWujie ? 'iframe 原生沙箱' : '无' }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isWujie = ref(false)
const windowHref = ref('')

// 子应用自己的变量值
const childAppName = ref('')
const childTheme = ref('')
const childSource = ref('')

// 父应用的变量值（通过 window.parent 读取）
const parentAppName = ref('')
const parentTheme = ref('')
const parentSource = ref('')

onMounted(() => {
  isWujie.value = !!(window as any).__POWERED_BY_WUJIE__
  windowHref.value = window.location.href

  // ========== 故意设置与主应用相同名称的全局变量 ==========
  ;(window as any).__MAIN_APP_NAME__ = 'sub-vue3 子应用'
  ;(window as any).__SHARED_THEME__ = 'dark'
  ;(window as any).__APP_SOURCE__ = '子应用 (sub-vue3)'

  // 读取子应用自己的值
  childAppName.value = (window as any).__MAIN_APP_NAME__
  childTheme.value = (window as any).__SHARED_THEME__
  childSource.value = (window as any).__APP_SOURCE__

  // 通过 window.parent 读取主应用的值
  if (isWujie.value) {
    try {
      parentAppName.value = (window as any).parent?.__MAIN_APP_NAME__ || '无法读取'
      parentTheme.value = (window as any).parent?.__SHARED_THEME__ || '无法读取'
      parentSource.value = (window as any).parent?.__APP_SOURCE__ || '无法读取 (主应用未设置此变量)'
    } catch {
      parentAppName.value = '跨域无法访问'
      parentTheme.value = '跨域无法访问'
      parentSource.value = '跨域无法访问'
    }
  } else {
    parentAppName.value = '(独立运行，无父应用)'
    parentTheme.value = '(独立运行，无父应用)'
    parentSource.value = '(独立运行，无父应用)'
  }
})
</script>
