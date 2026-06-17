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
        router
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta.title as string) || '无界微前端')
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
