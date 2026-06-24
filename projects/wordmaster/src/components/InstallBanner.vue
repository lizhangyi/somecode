<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'

const { showInstallBanner, installApp, dismissInstallBanner } = useWordMaster()
</script>

<template>
  <div v-if="showInstallBanner" class="install-banner">
    <span>添加到主屏幕，离线也能背单词</span>
    <button class="install-btn" @click="installApp">安装</button>
    <button class="close-banner" @click="dismissInstallBanner">×</button>
  </div>
</template>
