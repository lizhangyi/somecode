<template>
  <el-container style="min-height: 100vh">
    <!-- 侧边栏 -->
    <el-aside width="220px" style="background: #304156">
      <div class="logo">
        <el-icon size="24" color="#409EFF"><Monitor /></el-icon>
        <span class="logo-text">无界微前端 Demo</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/sub-vue">
          <el-icon><List /></el-icon>
          <span>Vue 子应用</span>
        </el-menu-item>
        <el-menu-item index="/sub-react">
          <el-icon><DataBoard /></el-icon>
          <span>React 子应用</span>
        </el-menu-item>
        <el-menu-item index="/communication">
          <el-icon><ChatDotRound /></el-icon>
          <span>通信演示</span>
        </el-menu-item>
        <el-menu-item index="/isolation">
          <el-icon><Lock /></el-icon>
          <span>隔离演示</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部 Header -->
      <el-header style="background: #fff; border-bottom: 1px solid #e8e8e8; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <el-icon size="20" color="#409EFF"><Menu /></el-icon>
          <span style="font-size: 16px; font-weight: 500;">{{ currentTitle }}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-tag type="success" size="small">wujie-vue3</el-tag>
          <el-tag type="info" size="small">v1.10.x</el-tag>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main style="padding: 20px; background: #f0f2f5;">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bus } from 'wujie'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta.title as string) || '无界微前端')

// 当前活跃的 wujie 子应用名称（用于定向询问）
const currentSubAppName = computed(() => {
  const path = route.path
  if (path.startsWith('/sub-vue')) return 'sub-vue'
  if (path.startsWith('/sub-react')) return 'sub-react'
  if (path.startsWith('/communication')) return 'sub-vue-comm' // 通信页有多个子应用
  if (path.startsWith('/isolation')) return 'sub-vue3'
  return null
})

// 请求 ID，用于匹配响应
let pendingRequestId: string | null = null
let pendingResolve: ((allowed: boolean) => void) | null = null

/**
 * 菜单点击拦截：先向当前子应用询问是否允许切换
 */
async function handleMenuSelect(index: string) {
  // 如果点击的是当前菜单，不做处理
  if (index === route.path) return

  const subApp = currentSubAppName.value
  if (!subApp) {
    // 当前页面没有子应用（如首页），直接跳转
    router.push(index)
    return
  }

  // 通过 bus 向子应用发起询问
  const requestId = `nav-${Date.now()}-${Math.random().toString(36).slice(2)}`
  pendingRequestId = requestId

  console.log(`%c[主应用] 向 ${subApp} 询问是否允许切换`, 'color: #409EFF; font-weight: bold;')

  // 等待子应用回复（最多等 3 秒）
  const allowed = await waitForNavigationResponse(requestId, 3000)

  if (allowed) {
    console.log(`%c[主应用] ${subApp} 允许切换`, 'color: #52c41a;')
    router.push(index)
  } else {
    console.log(`%c[主应用] ${subApp} 拒绝切换`, 'color: #f5222d;')
    ElMessage.warning(`子应用 [${subApp}] 拒绝了页面切换，请先处理当前页面的未完成操作`)
  }
}

/**
 * 等待子应用回复
 */
function waitForNavigationResponse(requestId: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    pendingResolve = resolve

    const timer = setTimeout(() => {
      // 超时：子应用无响应，默认允许切换
      console.log(`%c[主应用] 询问超时(${timeout}ms)，默认允许切换`, 'color: #fa8c16;')
      cleanup()
      resolve(true)
    }, timeout)

    const onResponse = (data: { requestId: string; allowed: boolean; reason?: string }) => {
      if (data.requestId !== requestId) return
      clearTimeout(timer)
      cleanup()
      if (!data.allowed && data.reason) {
        // 子应用拒绝了，弹出确认框让用户选择
        ElMessageBox.confirm(
          `子应用回复: ${data.reason}\n\n是否强制切换？`,
          '切换确认',
          { confirmButtonText: '强制切换', cancelButtonText: '留在当前页', type: 'warning' }
        ).then(() => resolve(true)).catch(() => resolve(false))
      } else {
        resolve(data.allowed)
      }
    }

    const cleanup = () => {
      bus.$off('navigationResponse', onResponse)
      pendingRequestId = null
      pendingResolve = null
    }

    bus.$on('navigationResponse', onResponse)

    // 发起询问
    bus.$emit('requestNavigation', { requestId, targetPath: route.path })
  })
}
</script>

<style scoped>
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.logo-text {
  white-space: nowrap;
}
</style>
