<script setup lang="ts">
import { useWordMaster } from '../composables/useWordMaster'

const { currentCard, isFlipped, toggleFlip } = useWordMaster()
</script>

<template>
  <div class="card-container" @click="toggleFlip">
    <div class="card-flip" :class="{ flipped: isFlipped }">
      <div class="card-face card-front">
        <div class="card-word">{{ currentCard?.word ?? '-' }}</div>
        <div class="card-phonetic">{{ currentCard?.phonetic || '' }}</div>
        <div class="card-hint">点击翻转查看释义</div>
      </div>
      <div class="card-face card-back">
        <div class="card-meaning">{{ currentCard?.meaning ?? '-' }}</div>
        <div v-if="currentCard?.example" class="card-example">{{ currentCard.example }}</div>
        <div class="card-phonetic" style="margin-top:12px">{{ currentCard?.phonetic || '' }}</div>
        <span
          v-if="currentCard?.pos"
          class="card-pos"
        >{{ currentCard.pos }}</span>
      </div>
    </div>
  </div>
</template>
