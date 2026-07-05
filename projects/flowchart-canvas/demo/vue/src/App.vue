<script setup lang="ts">
import ToolBar from './components/ToolBar.vue'
import CanvasArea from './components/CanvasArea.vue'
import PropertyPanel from './components/PropertyPanel.vue'
</script>

<template>
  <div class="app-layout">
    <ToolBar />
    <div class="main-area">
      <CanvasArea />
      <PropertyPanel />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
