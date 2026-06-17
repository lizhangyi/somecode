<template>
  <div class="home-page">
    <el-card shadow="hover" style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-icon size="20" color="#409EFF"><InfoFilled /></el-icon>
          <span style="font-weight: bold;">关于本项目</span>
        </div>
      </template>
      <p style="line-height: 1.8; color: #666;">
        这是一个基于 <strong>无界 (Wujie)</strong> 微前端框架的功能演示项目。
        无界采用 <strong>Web Components + iframe</strong> 沙箱模式，实现原生 JS/CSS 隔离，
        具备成本低、速度快、隔离彻底、功能强大等优点。
      </p>
      <p style="margin-top: 12px;">
        <el-tag type="primary" size="small">Web Components</el-tag>
        <el-tag type="success" size="small" style="margin-left: 8px;">iframe 沙箱</el-tag>
        <el-tag type="warning" size="small" style="margin-left: 8px;">技术栈无关</el-tag>
      </p>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="8" v-for="item in subApps" :key="item.name">
        <el-card shadow="hover" :body-style="{ padding: '20px' }">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <el-icon size="24" :color="item.color"><component :is="item.icon" /></el-icon>
            <span style="font-size: 16px; font-weight: bold;">{{ item.name }}</span>
          </div>
          <p style="color: #666; font-size: 13px; margin-bottom: 12px;">{{ item.description }}</p>
          <div>
            <span class="feature-tag" :class="item.tagClass">{{ item.feature }}</span>
          </div>
          <div style="margin-top: 12px;">
            <el-tag size="small" type="info">{{ item.tech }}</el-tag>
            <span style="margin-left: 8px; color: #999; font-size: 12px;">:{{ item.port }}</span>
          </div>
          <el-button type="primary" size="small" style="margin-top: 16px; width: 100%;" @click="router.push(item.route)">
            进入子应用
          </el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <span style="font-weight: bold;">无界特色功能一览</span>
      </template>
      <el-table :data="features" stripe>
        <el-table-column prop="feature" label="功能" width="160" />
        <el-table-column prop="description" label="说明" />
        <el-table-column prop="page" label="演示页面" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const subApps = [
  {
    name: 'sub-vue (待办事项)',
    description: 'Vue3 子应用，演示保活、路由同步、props 通信和生命周期钩子。',
    tech: 'Vue3 + Vite',
    port: '3001',
    color: '#42b883',
    icon: 'List',
    tagClass: 'alive',
    feature: '保活 + 路由同步',
    route: '/sub-vue'
  },
  {
    name: 'sub-react (数据仪表盘)',
    description: 'React 子应用，演示跨框架支持、插件系统和 eventBus 通信。',
    tech: 'React + Vite',
    port: '3002',
    color: '#61dafb',
    icon: 'DataBoard',
    tagClass: 'plugin',
    feature: '跨框架 + 插件系统',
    route: '/sub-react'
  },
  {
    name: 'sub-vue3 (隔离演示)',
    description: 'Vue3 子应用，演示 JS 沙箱隔离和 CSS 样式隔离效果。',
    tech: 'Vue3 + Vite',
    port: '3003',
    color: '#f5222d',
    icon: 'Lock',
    tagClass: 'isolation',
    feature: 'JS/CSS 原生隔离',
    route: '/isolation'
  }
]

const features = [
  { feature: '跨框架支持', description: '主应用 Vue3，子应用混合 Vue3 + React，技术栈完全无关', page: 'React 子应用' },
  { feature: 'JS/CSS 原生隔离', description: 'iframe 隔离 JS 环境，Web Components 隔离 CSS 样式', page: '隔离演示' },
  { feature: '子应用保活 (alive)', description: '切换菜单时子应用状态不丢失，无需重新加载', page: 'Vue 子应用' },
  { feature: '路由同步 (sync)', description: '子应用路由变化与主应用双向同步，支持浏览器前进/后退', page: 'Vue/React 子应用' },
  { feature: 'props 通信', description: '主应用向子应用传递数据和回调函数', page: 'Vue 子应用' },
  { feature: 'eventBus 通信', description: '去中心化事件总线，子应用间互相发送/接收消息', page: '通信演示' },
  { feature: '预加载 (preloadApp)', description: '主应用启动时后台预加载所有子应用资源', page: '全局 (控制台日志)' },
  { feature: '生命周期钩子', description: 'beforeLoad / beforeMount / afterMount / beforeUnmount / afterUnmount', page: 'Vue 子应用' },
  { feature: '插件系统', description: '通过 jsBeforeLoaders 在子应用加载前注入脚本或变量', page: 'React 子应用' },
  { feature: '多应用同时激活', description: '在同一页面同时加载并展示多个子应用', page: '通信演示' }
]
</script>
