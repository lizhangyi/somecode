<template>
  <div>
    <div class="todo-input-group">
      <input
        class="todo-input"
        v-model="newTodo"
        placeholder="添加新的待办事项..."
        @keyup.enter="handleAdd"
      />
      <button class="btn btn-primary" @click="handleAdd">添加</button>
    </div>

    <ul class="todo-list">
      <li
        v-for="todo in todos"
        :key="todo.id"
        class="todo-item"
        :class="{ done: todo.done }"
      >
        <input
          type="checkbox"
          class="todo-checkbox"
          :checked="todo.done"
          @change="$emit('toggleTodo', todo.id)"
        />
        <span class="todo-text">{{ todo.text }}</span>
        <button class="btn btn-danger btn-small" @click="$emit('removeTodo', todo.id)">删除</button>
      </li>
    </ul>

    <div v-if="todos.length === 0" style="text-align: center; padding: 40px; color: #999;">
      暂无待办事项，添加一个吧~
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

defineProps<{ todos: Todo[] }>()
const emit = defineEmits(['addTodo', 'toggleTodo', 'removeTodo'])

const newTodo = ref('')

function handleAdd() {
  if (!newTodo.value.trim()) return
  emit('addTodo', newTodo.value.trim())
  newTodo.value = ''
}
</script>
