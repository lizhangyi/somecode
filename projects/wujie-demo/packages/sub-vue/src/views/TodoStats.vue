<template>
  <div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">{{ total }}</div>
        <div class="stat-label">总计</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #52c41a;">{{ completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #fa8c16;">{{ pending }}</div>
        <div class="stat-label">待完成</div>
      </div>
    </div>

    <!-- 完成率进度条 -->
    <div style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #f0f0f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 14px;">完成率</span>
        <span style="font-size: 14px; font-weight: bold; color: #42b883;">{{ completionRate }}%</span>
      </div>
      <div style="height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
        <div
          style="height: 100%; background: linear-gradient(90deg, #42b883, #52c41a); border-radius: 4px; transition: width 0.3s;"
          :style="{ width: completionRate + '%' }"
        ></div>
      </div>
    </div>

    <!-- 保活提示 -->
    <div style="margin-top: 16px; padding: 12px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 6px; font-size: 13px; color: #52c41a;">
      <strong>保活提示:</strong> 开启 alive 后，切换到其他页面再回来，这里的待办数据不会丢失。
      试试看: 回到列表页添加一些待办事项，然后切换到主应用的其他菜单，再回来查看。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

const props = defineProps<{ todos: Todo[] }>()

const total = computed(() => props.todos.length)
const completed = computed(() => props.todos.filter(t => t.done).length)
const pending = computed(() => total.value - completed.value)
const completionRate = computed(() =>
  total.value === 0 ? 0 : Math.round((completed.value / total.value) * 100)
)
</script>
