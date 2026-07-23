# 项目长期记忆

## 项目结构

`D:\work\somecode` 是一个多项目 monorepo，子项目在 `projects/` 下：
- flowchart-canvas — Canvas 流程图库（Headless 库架构）
- data-table — 数据表格组件
- json-editor — JSON 编辑器
- snake-game — 贪吃蛇游戏
- wordmaster — Vue 单词学习应用
- wujie-demo — Wujie 微前端示例

## 技术偏好

- 提交信息用中文
- TypeScript strict 模式
- Vite 构建
- 纯 Canvas 渲染（无框架）用于可视化项目

## flowchart-canvas 架构

- 已改造为 Headless 库：`new Flowchart(canvas, options)` 创建实例
- 库源码在 `src/`，Demo 应用在 `demo/vanilla/`（后续可加 `demo/vue/`、`demo/react/`）
- 核心层 `src/core/` + 引擎层 `src/engine/` + 几何层 `src/geometry/`
- 主题方案 C：`theme: 'dark' | 'light' | ThemeColors`
- 事件系统替代轮询：`fc.on('selection:change', cb)`
- 库不关心存储策略，提供 `toJSON()` / `fromJSON()` + `dirty` 事件
- 右键菜单和文字编辑器内置但可通过 options 关闭
- 公共导出入口：`src/index.ts`
- Vite 配置 `root: 'demo/vanilla'`，构建输出到 `dist/`

## graph-editor — 关系图编辑器

- Vue 3 + TS + @antv/g6@4.8.x + SCSS 项目，位于 `projects/graph-editor/`
- 三 composable 架构：useGraphInstance（G6 实例）、useCommandManager（命令模式/撤销重做）、useGraphSync（防抖保存/重试）
- 所有数据修改通过命令执行（ICommand 接口），确保撤销重做与同步一致性
- StorageAdapter 模式：组件不关心存储细节，只需实现 load/save 接口
- Playground 使用 localStorage 适配器，附带 axios 注释示例
- 开发服务器端口 5174，`npm run dev` 启动
