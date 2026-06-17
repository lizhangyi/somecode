<template>
  <div class="app-container">
    <div class="app-header">
      <span class="app-title">待办事项</span>
      <span class="app-badge">sub-vue | Vue3</span>
    </div>

    <!-- Props 信息展示 -->
    <div class="props-info" v-if="propsInfo">
      <strong>Props 通信:</strong> 用户: {{ propsInfo.userInfo?.name }} | 角色: {{ propsInfo.userInfo?.role }}
    </div>

    <!-- 导航切换保护提示 -->
    <div
      v-if="pendingTodos.length > 0"
      style="margin-bottom: 12px; padding: 10px 14px; background: #fff7e6; border: 1px solid #ffd591; border-radius: 6px; font-size: 13px; color: #fa8c16;"
    >
      ⚠️ 当前有 {{ pendingTodos.length }} 个未完成待办，主应用切换菜单时会先询问确认。
    </div>

    <!-- 导航 -->
    <div class="nav-tabs">
      <div
        class="nav-tab"
        :class="{ active: $route.path === '/' }"
        @click="$router.push('/')"
      >
        列表
      </div>
      <div
        class="nav-tab"
        :class="{ active: $route.path === '/stats' }"
        @click="$router.push('/stats')"
      >
        统计
      </div>
    </div>

    <router-view :todos="todos" @add-todo="addTodo" @toggle-todo="toggleTodo" @remove-todo="removeTodo" />

    <!-- 通信面板 -->
    <div class="comm-panel">
      <h4>eventBus 通信</h4>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <input class="todo-input" v-model="commMessage" placeholder="输入要发送的消息..." />
        <button class="btn btn-info btn-small" @click="sendMessage">发送给其他应用</button>
      </div>
      <div class="comm-log">
        <div v-if="receivedMessages.length === 0" style="color: #999;">等待接收消息...</div>
        <div v-for="(msg, i) in receivedMessages" :key="i" style="padding: 2px 0;">
          [{{ msg.from }}] {{ msg.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = reactive<Todo[]>([
  { id: 1, text: '学习无界微前端框架', done: true },
  { id: 2, text: '搭建主应用项目', done: true },
  { id: 3, text: '配置子应用路由同步', done: false }
])

let nextId = 4

// 获取 props
const propsInfo = (window as any).$wujie?.props || null

// ========== 待办事项操作 ==========
function addTodo(text: string) {
  todos.push({ id: nextId++, text, done: false })
}

function toggleTodo(id: number) {
  const todo = todos.find(t => t.id === id)
  if (todo) todo.done = !todo.done
}

function removeTodo(id: number) {
  const index = todos.findIndex(t => t.id === id)
  if (index !== -1) todos.splice(index, 1)
}

// ========== 导航切换保护 ==========
const pendingTodos = computed(() => todos.filter(t => !t.done))

/**
 * 监听主应用的导航询问
 * 如果有未完成的待办事项，拒绝切换并说明原因
 */
function handleNavigationRequest(data: { requestId: string; targetPath: string }) {
  const bus = (window as any).$wujie?.bus
  if (!bus) return

  const unfinished = todos.filter(t => !t.done)
  if (unfinished.length > 0) {
    console.log(`%c[sub-vue] 收到导航询问，有 ${unfinished.length} 个未完成待办，拒绝切换`, 'color: #fa8c16; font-weight: bold;')
    bus.$emit('navigationResponse', {
      requestId: data.requestId,
      allowed: false,
      reason: `当前有 ${unfinished.length} 个待办事项未完成，请先处理后再切换`
    })
  } else {
    console.log('%c[sub-vue] 收到导航询问，全部完成，允许切换', 'color: #52c41a; font-weight: bold;')
    bus.$emit('navigationResponse', {
      requestId: data.requestId,
      allowed: true
    })
  }
}

// ========== eventBus 通信 ==========
const commMessage = ref('')
const receivedMessages = ref<{ from: string; content: string }[]>([])

function sendMessage() {
  if (!commMessage.value.trim()) return
  const bus = (window as any).$wujie?.bus
  if (bus) {
    bus.$emit('subMessage', {
      from: 'sub-vue',
      message: commMessage.value
    })
    commMessage.value = ''
  } else {
    console.log('[sub-vue] 不在微前端环境中，无法发送消息')
  }
}

function handleIncomingMessage(data: { from: string; message: string }) {
  receivedMessages.value.unshift({ from: data.from, content: data.message })
}

onMounted(() => {
  const bus = (window as any).$wujie?.bus
  if (bus) {
    bus.$on('subMessage', handleIncomingMessage)
    bus.$on('requestNavigation', handleNavigationRequest)
  }
})

onUnmounted(() => {
  const bus = (window as any).$wujie?.bus
  if (bus) {
    bus.$off('subMessage', handleIncomingMessage)
    bus.$off('requestNavigation', handleNavigationRequest)
  }
})
</script>
