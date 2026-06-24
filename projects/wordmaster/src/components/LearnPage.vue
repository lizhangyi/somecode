<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'
import FlashCard from './FlashCard.vue'

const {
  topDue,
  topLearned,
  isFlipped,
  progressPct,
  progressText,
  progressRemain,
  isDone,
  doneCount,
  handleRating,
} = useWordMaster()
</script>

<template>
  <div>
    <!-- 统计概览 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">待复习</div>
        <div class="stat-value war">{{ topDue }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已掌握</div>
        <div class="stat-value suc">{{ topLearned }}</div>
      </div>
    </div>

    <!-- 闪卡区域 -->
    <div v-if="!isDone">
      <FlashCard />

      <!-- 评分按钮 -->
      <div class="rating-bar" :style="{ opacity: isFlipped ? 1 : 0 }">
        <button class="rating-btn again" @click.stop="handleRating(0)">不认识</button>
        <button class="rating-btn hard" @click.stop="handleRating(2)">模糊</button>
        <button class="rating-btn good" @click.stop="handleRating(4)">认识</button>
        <button class="rating-btn easy" @click.stop="handleRating(5)">很熟</button>
      </div>

      <!-- 进度 -->
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="progress-text">
        <span>{{ progressText }}</span>
        <span>{{ progressRemain }}</span>
      </div>
    </div>

    <!-- 完成状态 -->
    <div v-else class="empty-state">
      <span class="done-check">🎉</span>
      <div class="empty-title">今日任务完成！</div>
      <div class="empty-desc" style="margin-bottom:20px">
        今天学了 <strong>{{ doneCount }}</strong> 个单词<br>
        明天记得来复习哦
      </div>
    </div>
  </div>
</template>
