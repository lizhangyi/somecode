<script setup lang="ts">
import { onMounted } from 'vue'
import { useWordMaster } from './composables/useWordMaster'
import InstallBanner from './components/InstallBanner.vue'
import NavBar from './components/NavBar.vue'
import TabBar from './components/TabBar.vue'
import LearnPage from './components/LearnPage.vue'
import StatsPage from './components/StatsPage.vue'
import SettingsPage from './components/SettingsPage.vue'

console.log('[WordMaster] App.vue script setup running')

const {
  currentPage,
  isInitialized,
  initError,
  navigateTo,
  init,
  setupInstallPrompt,
} = useWordMaster()

function handleReload() {
  window.location.reload()
}

onMounted(async () => {
  await init()
  // setupInstallPrompt() 已在模块顶层立即注册，此处不再调用
})
</script>

<template>
  <div v-if="!isInitialized && !initError" class="flex items-center justify-center min-h-screen text-slate-400 text-lg">
    加载中...
  </div>

  <div v-else-if="initError" class="flex flex-col items-center justify-center min-h-screen text-red-400 p-6 text-center">
    <div class="text-xl mb-4">⚠️ 初始化失败</div>
    <div class="bg-slate-800 p-4 rounded text-sm text-left max-w-md overflow-auto">{{ initError }}</div>
    <button class="mt-4 px-4 py-2 bg-slate-700 rounded" @click="handleReload">重新加载</button>
  </div>

  <template v-else>
    <InstallBanner />
    <NavBar />
    <main class="main">
      <LearnPage v-if="currentPage === 'learn'" />
      <StatsPage v-else-if="currentPage === 'stats'" />
      <SettingsPage v-else-if="currentPage === 'settings'" />
    </main>
    <TabBar :current-page="currentPage" @navigate="navigateTo" />
  </template>
</template>
