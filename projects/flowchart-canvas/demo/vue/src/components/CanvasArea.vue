<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useFlowchart } from '../composables/useFlowchart'

const { fc, canvasRef, initFlowchart, destroy } = useFlowchart()

const canvasContainer = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (canvasContainer.value) {
    const canvas = document.createElement('canvas')
    canvas.id = 'canvas'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvasContainer.value.appendChild(canvas)
    initFlowchart(canvas)
  }
})

onBeforeUnmount(() => {
  destroy()
})
</script>

<template>
  <div ref="canvasContainer" class="canvas-container" />
</template>

<style scoped>
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
