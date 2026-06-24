<script setup lang="ts">
defineProps<{
  currentPage: string
}>()

const emit = defineEmits<{
  navigate: [page: 'learn' | 'stats' | 'settings']
}>()
</script>

<template>
  <nav class="tab-bar">
    <button
      class="tab"
      :class="{ active: currentPage === 'learn' }"
      @click="emit('navigate', 'learn')"
    >
      <span class="tab-icon">📚</span>
      <span>学习</span>
    </button>
    <button
      class="tab"
      :class="{ active: currentPage === 'stats' }"
      @click="emit('navigate', 'stats')"
    >
      <span class="tab-icon">📊</span>
      <span>统计</span>
    </button>
    <button
      class="tab"
      :class="{ active: currentPage === 'settings' }"
      @click="emit('navigate', 'settings')"
    >
      <span class="tab-icon">⚙️</span>
      <span>设置</span>
    </button>
  </nav>
</template>
