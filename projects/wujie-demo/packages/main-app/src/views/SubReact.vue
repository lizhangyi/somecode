<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <el-icon size="20" color="#61dafb"><DataBoard /></el-icon>
            <span style="font-weight: bold;">sub-react - 数据仪表盘</span>
          </div>
          <div>
            <span class="feature-tag">跨框架支持</span>
            <span class="feature-tag sync">sync 路由同步</span>
            <span class="feature-tag plugin">插件系统</span>
          </div>
        </div>
      </template>
      <el-alert
        title="跨框架 + 插件系统说明"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      >
        <template #default>
          这是一个 <strong>React</strong> 子应用，运行在 <strong>Vue3</strong> 主应用中，展示无界的跨框架能力。
          通过 <code>jsBeforeLoaders</code> 插件在子应用加载前注入 <code>window.APP_CONFIG</code> 共享配置。
          打开浏览器控制台可查看注入的变量。
        </template>
      </el-alert>
    </el-card>

    <!-- 加载 sub-react 子应用，开启路由同步 + 插件注入 -->
    <div class="wujie-container">
      <WujieVue
        name="sub-react"
        url="http://localhost:3002/"
        :sync="true"
        :plugins="plugins"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import WujieVue from 'wujie-vue3'

// 插件配置：在子应用 JS 执行前注入共享变量
const plugins = [
  {
    // 在子应用所有 JS 加载前执行的脚本
    jsBeforeLoaders: [
      {
        content: `
          window.APP_CONFIG = {
            appName: '无界微前端 Demo',
            version: '1.0.0',
            apiBase: 'http://localhost:3000/api',
            theme: 'light',
            locale: 'zh-CN',
            injectedAt: new Date().toLocaleString()
          };
          console.log('%c[插件] jsBeforeLoaders: 已注入 window.APP_CONFIG', 'color: #13c2c2; font-weight: bold;');
        `
      }
    ]
  }
]
</script>
