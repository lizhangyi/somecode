<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <el-icon size="20" color="#722ed1"><ChatDotRound /></el-icon>
            <span style="font-weight: bold;">多应用通信演示</span>
          </div>
          <div>
            <span class="feature-tag communication">eventBus 通信</span>
            <span class="feature-tag">多应用同时激活</span>
          </div>
        </div>
      </template>
      <el-alert
        title="eventBus 跨应用通信 + 多应用同时激活"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #default>
          同一页面同时加载 <strong>sub-vue</strong> 和 <strong>sub-react</strong> 两个子应用。
          使用无界的 <code>bus</code> 事件总线实现跨应用通信。
          点击子应用中的"发送消息"按钮，观察另一个子应用是否收到消息。
        </template>
      </el-alert>
    </el-card>

    <!-- 消息日志 -->
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: bold;">通信日志 (主应用接收)</span>
          <el-button size="small" @click="messages = []">清空</el-button>
        </div>
      </template>
      <div style="max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 13px;">
        <div v-if="messages.length === 0" style="color: #999;">暂无消息...</div>
        <div v-for="(msg, i) in messages" :key="i" style="padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
          <el-tag size="small" :type="msg.type === 'vue' ? 'success' : 'primary'" style="margin-right: 8px;">
            {{ msg.from }}
          </el-tag>
          <span>{{ msg.content }}</span>
          <span style="color: #999; margin-left: 8px; font-size: 11px;">{{ msg.time }}</span>
        </div>
      </div>
    </el-card>

    <!-- 同时加载两个子应用 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <div style="margin-bottom: 8px; font-weight: bold; color: #42b883;">sub-vue (Vue3)</div>
        <div class="wujie-container">
          <WujieVue
            name="sub-vue-comm"
            url="http://localhost:3001/"
            :alive="true"
            :props="commProps"
          />
        </div>
      </el-col>
      <el-col :span="12">
        <div style="margin-bottom: 8px; font-weight: bold; color: #61dafb;">sub-react (React)</div>
        <div class="wujie-container">
          <WujieVue
            name="sub-react-comm"
            url="http://localhost:3002/"
            :plugins="plugins"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import WujieVue from 'wujie-vue3'
import { bus } from 'wujie'

interface Message {
  from: string
  content: string
  type: string
  time: string
}

const messages = ref<Message[]>([])

const commProps = reactive({
  mode: 'communication',
  userInfo: { name: '通信测试用户', role: '测试员' }
})

const plugins = [
  {
    jsBeforeLoaders: [
      {
        content: `
          window.APP_CONFIG = { mode: 'communication', theme: 'light' };
          console.log('[插件] 通信模式: 已注入 window.APP_CONFIG');
        `
      }
    ]
  }
]

// 监听子应用发来的消息
const handleMessage = (data: { from: string; message: string }) => {
  messages.value.unshift({
    from: data.from,
    content: data.message,
    type: data.from.includes('vue') ? 'vue' : 'react',
    time: new Date().toLocaleTimeString()
  })
}

onMounted(() => {
  bus.$on('subMessage', handleMessage)
})

onUnmounted(() => {
  bus.$off('subMessage', handleMessage)
})
</script>
