<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'

const { dailyGoal, changeDailyGoal, handleResetProgress } = useWordMaster()
</script>

<template>
  <div>
    <div class="section-title">学习设置</div>
    <div class="setting-item">
      <span class="setting-label">每日目标</span>
      <span class="setting-value">
        <select :value="dailyGoal" @change="changeDailyGoal(Number(($event.target as HTMLSelectElement).value))">
          <option :value="10">10 词/天</option>
          <option :value="20">20 词/天</option>
          <option :value="30">30 词/天</option>
          <option :value="50">50 词/天</option>
          <option :value="100">100 词/天</option>
        </select>
      </span>
    </div>

    <div class="section-title">数据管理</div>
    <div class="setting-item cursor-pointer" @click="handleResetProgress()">
      <span class="setting-label">重置学习进度</span>
      <span class="setting-value" style="color: var(--danger, #f87171)">重置 →</span>
    </div>

    <div class="section-title">关于</div>
    <div class="setting-item">
      <span class="setting-label">词库</span>
      <span class="setting-value">雅思 + 六级高频 210 词</span>
    </div>
    <div class="setting-item">
      <span class="setting-label">算法</span>
      <span class="setting-value">SM-2 间隔重复</span>
    </div>
    <div class="setting-item">
      <span class="setting-label">版本</span>
      <span class="setting-value">v2.0 — Vue 3 + TypeScript</span>
    </div>
  </div>
</template>
