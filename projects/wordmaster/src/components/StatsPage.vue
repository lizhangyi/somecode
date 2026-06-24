<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'

const { stats, streak, statsPct } = useWordMaster()
</script>

<template>
  <div>
    <div style="text-align: center; padding: 16px 0">
      <div style="font-size: 3rem; font-weight: 700; letter-spacing: -1px">{{ streak }}</div>
      <div class="stat-label">连续打卡天数</div>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">总词数</div>
        <div class="stat-value pri">{{ stats?.total ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已学习</div>
        <div class="stat-value suc">{{ stats?.learned ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">掌握率</div>
        <div class="stat-value pur">{{ statsPct }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待复习</div>
        <div class="stat-value war">{{ stats?.due ?? 0 }}</div>
      </div>
    </div>
    <div class="stat-card" style="margin: 0 1rem 8px">
      <div class="stat-label">牢固掌握（复习3次以上）</div>
      <div style="font-size: 1.1rem">{{ stats?.masterCount ?? 0 }}</div>
    </div>
  </div>
</template>
