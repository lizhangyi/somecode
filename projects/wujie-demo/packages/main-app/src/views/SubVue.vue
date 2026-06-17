<template>
  <div>
    <el-card shadow="hover" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <el-icon size="20" color="#42b883"><List /></el-icon>
            <span style="font-weight: bold;">sub-vue - 待办事项应用</span>
          </div>
          <div>
            <span class="feature-tag alive">alive 保活</span>
            <span class="feature-tag sync">sync 路由同步</span>
            <span class="feature-tag communication">props 通信</span>
          </div>
        </div>
      </template>
      <el-alert
        title="保活 (alive) 说明"
        type="success"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      >
        <template #default>
          开启 <code>alive=true</code> 后，切换菜单再回来，子应用状态不会丢失。
          请在子应用中添加几个待办事项，然后切换到其他页面再回来，观察数据是否保留。
          打开浏览器控制台可查看生命周期钩子日志。
        </template>
      </el-alert>

      <div style="margin-bottom: 8px; color: #999; font-size: 12px;">
        props 传递的用户信息: {{ JSON.stringify(subProps.userInfo) }}
      </div>
    </el-card>

    <!-- 加载 sub-vue 子应用，开启保活和路由同步 -->
    <div class="wujie-container">
      <WujieVue
        name="sub-vue"
        url="http://localhost:3001/"
        :sync="true"
        :alive="true"
        :props="subProps"
        :beforeLoad="beforeLoad"
        :beforeMount="beforeMount"
        :afterMount="afterMount"
        :beforeUnmount="beforeUnmount"
        :afterUnmount="afterUnmount"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import WujieVue from 'wujie-vue3'

// 通过 props 传递给子应用的数据
const subProps = reactive({
  userInfo: {
    name: '张三',
    role: '管理员',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
  },
  jump: (path: string) => {
    console.log('[主应用] 收到子应用跳转请求:', path)
    // 这里可以调用 router.push
  }
})

// ========== 生命周期钩子 ==========
const beforeLoad = () => {
  console.log('%c[生命周期] sub-vue: beforeLoad', 'color: #42b883; font-weight: bold;')
}

const beforeMount = () => {
  console.log('%c[生命周期] sub-vue: beforeMount', 'color: #42b883; font-weight: bold;')
}

const afterMount = () => {
  console.log('%c[生命周期] sub-vue: afterMount', 'color: #42b883; font-weight: bold;')
}

const beforeUnmount = () => {
  console.log('%c[生命周期] sub-vue: beforeUnmount', 'color: #42b883; font-weight: bold;')
}

const afterUnmount = () => {
  console.log('%c[生命周期] sub-vue: afterUnmount', 'color: #42b883; font-weight: bold;')
}
</script>
