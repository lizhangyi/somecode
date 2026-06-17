# 代码知识库

个人代码知识库，记录工作中遇到的问题和解决方案。

## 项目列表

### 1. JSON 编辑器

**路径**: `projects/json-editor/vue_project/`  
**技术栈**: Vue 3 + Element Plus + Vite

**功能**:
- JSON 数据可视化表格编辑
- 支持新增、删除键值对
- 自动类型识别（null、boolean、number、string）

**运行方式**:
```bash
cd projects/json-editor/vue_project
npm install
npm run dev
```

---

### 2. 贪吃蛇游戏

**路径**: `projects/snake-game/`
**技术栈**: 原生 HTML/CSS/JavaScript + Canvas API

**玩法**:
- 方向键或 WASD 控制移动
- 空格键开始/重新开始
- P 键暂停

**运行方式**: 直接用浏览器打开 `projects/snake-game/index.html`

---

### 3. 数据表格

**路径**: `projects/data-table/`
**技术栈**: 原生 HTML/CSS/JavaScript

**功能**:
- 表格表头吸顶效果（页面滚动时表头固定在屏幕顶部）
- 表格内容较宽时支持横向滚动
- 表头与内容列宽同步对齐
- 支持多个表格同时存在

**运行方式**: 直接用浏览器打开 `projects/data-table/index.html`

---

### 4. 无界微前端 Demo

**路径**: `projects/wujie-demo/`
**技术栈**: Vue 3 + React + Vite + Element Plus + Wujie (无界微前端框架)

**架构**: 1 个主应用 + 3 个子应用的 monorepo 结构

| 应用 | 技术栈 | 端口 | 功能 |
|------|--------|------|------|
| main-app (主应用) | Vue 3 + Element Plus | 3000 | 后台管理布局，子应用加载/预加载/生命周期管理 |
| sub-vue | Vue 3 | 3001 | 待办事项应用，演示保活/路由同步/props 通信 |
| sub-react | React | 3002 | 数据仪表盘，演示跨框架支持/插件系统 |
| sub-vue3 | Vue 3 | 3003 | 隔离演示，展示 JS 沙箱/CSS 样式隔离 |

**演示的无界特色功能**:
- 跨框架支持：主应用 Vue 3，子应用混合 Vue 3 + React
- JS/CSS 原生隔离：iframe 沙箱 + Web Components Shadow DOM
- 子应用保活 (alive)：切换菜单状态不丢失
- 路由同步 (sync)：子应用与主应用路由双向同步
- 通信系统：props 通信 + eventBus 去中心化通信
- 预加载 (preloadApp)：主应用启动时预加载所有子应用
- 生命周期钩子：beforeLoad / beforeMount / afterMount / beforeUnmount / afterUnmount
- 插件系统 (jsBeforeLoaders)：加载前注入共享变量
- 多应用同时激活：同一页面加载多个子应用
- 导航切换保护：切换菜单前向子应用询问确认，支持拒绝/强制切换

**运行方式**:
```bash
# 分别启动各子应用（4 个终端）
cd projects/wujie-demo/packages/sub-vue && npm install && npm run dev
cd projects/wujie-demo/packages/sub-react && npm install && npm run dev
cd projects/wujie-demo/packages/sub-vue3 && npm install && npm run dev
cd projects/wujie-demo/packages/main-app && npm install && npm run dev
```

---

## 技术栈

- Vue 3 + Element Plus
- React + React Router
- Vite 6
- Wujie (无界微前端框架)
- TypeScript
- 原生 HTML/CSS/JavaScript
- Canvas API

---

*最后更新: 2026-06-17*
