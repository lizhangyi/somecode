<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'

const { frontCard, backCard, isFlipped, toggleFlip } = useWordMaster()
</script>

<template>
  <div class="card-scene" @click="toggleFlip">
    <div class="card-inner" :class="{ 'is-flipped': isFlipped }">
      <!-- 正面：英文 -->
      <div class="card-face card-front">
        <div class="card-word">{{ frontCard?.word ?? '-' }}</div>
        <div class="card-phonetic">{{ frontCard?.phonetic || '' }}</div>
        <div class="card-hint">点击翻转查看释义</div>
      </div>
      <!-- 背面：释义 -->
      <div class="card-face card-back">
        <div class="card-meaning">{{ backCard?.meaning ?? '-' }}</div>
        <div v-if="backCard?.example" class="card-example">{{ backCard.example }}</div>
        <div class="card-phonetic" style="margin-top:12px">{{ backCard?.phonetic || '' }}</div>
        <span v-if="backCard?.pos" class="card-pos">{{ backCard.pos }}</span>
      </div>
    </div>
  </div>
</template>
