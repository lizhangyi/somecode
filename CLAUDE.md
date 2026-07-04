# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
/workspace/
├── projects/
│   ├── json-editor/
│   │   └── vue_project/           # Vue 3 + Element Plus JSON 编辑器
│   │       ├── src/
│   │       │   ├── components/
│   │       │   │   └── JsonEditor.vue
│   │       │   ├── App.vue
│   │       │   ├── main.js
│   │       │   └── style.css
│   │       └── package.json
│   ├── snake-game/
│   │   ├── index.html             # 贪吃蛇游戏入口
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts            # 入口，初始化
│   │       ├── style.css           # Tailwind + 自定义游戏样式
│   │       ├── types.ts            # 类型定义
│   │       ├── config.ts           # 常量配置
│   │       ├── state.ts            # 游戏状态
│   │       ├── sound.ts            # 音效系统（Web Audio API）
│   │       ├── theme.ts            # 主题管理
│   │       ├── history.ts          # 历史得分
│   │       ├── renderer.ts         # Canvas 渲染
│   │       ├── game.ts             # 游戏逻辑
│   │       └── controls.ts         # 输入控制
│   └── data-table/
│       └── index.html             # 数据表格（表头吸顶 + 横向滚动）
└── README.md
```

## Vue Project Commands

```bash
# dev server (port 5173)
cd projects/json-editor/vue_project && npm install && npm run dev

# production build
npm run build

# preview production build
npm run preview
```

## Architecture Notes

- **Node version**: v20.17.0 (Vite 6 requires Node ≥20.19)
- **Vue version**: 3.5.34
- **UI Library**: Element Plus 2.14.0
- **Build tool**: Vite 6.4.2

## Snake Game

**Tech**: Vite + TypeScript + Tailwind CSS v4  
**Path**: `projects/snake-game/`

```bash
# dev server (port 5173)
cd projects/snake-game && npm install && npm run dev

# production build
npm run build

# preview production build
npm run preview
```

Controls:
- SPACE: Start/Restart
- P: Pause
- Arrow keys or WASD: Move
- Same direction key again: Boost

## Data Table

Single HTML file at `projects/data-table/index.html`. Open directly in browser - no dependencies.

Features:
- Sticky header on page scroll
- Horizontal scroll for wide tables
- Synchronized column widths between header and body

## FlowChart Canvas

**Tech**: Vite + TypeScript + Tailwind CSS v4 + 纯Canvas渲染
**Path**: `projects/flowchart-canvas/`

```bash
# dev server (port 5173)
cd projects/flowchart-canvas && npm install && npm run dev

# production build
npm run build

# preview production build
npm run preview
```

### 架构

```
src/
├── main.ts           # 入口：初始化、工具栏/属性面板事件
├── types.ts          # 类型定义
├── config.ts         # 常量、颜色主题
├── state.ts          # 全局状态：nodes/edges/viewport/selected
├── canvas.ts         # Canvas初始化 + DPR适配 + 坐标转换
├── renderer.ts       # 渲染管线（分层渲染）
├── grid.ts           # 背景网格
├── nodes.ts          # 节点渲染（矩形/圆角/菱形/圆形）+ 命中检测
├── edges.ts          # 贝塞尔曲线连线 + 箭头 + 命中检测
├── anchors.ts        # 锚点位置/绘制/命中检测
├── interaction.ts    # 交互状态机 + 鼠标/键盘事件
├── history.ts        # 撤销/重做（命令模式）
├── serializer.ts     # JSON导入/导出
├── texteditor.ts     # 双击编辑文字
└── utils/
    ├── geometry.ts   # 几何工具
    └── bezier.ts     # 贝塞尔曲线工具
```

### 功能

- 四种节点形状：矩形、圆角矩形、菱形、圆形
- 贝塞尔曲线连线，带箭头，方向感知
- 节点拖拽、框选多选
- 鼠标滚轮缩放（以光标为中心），空格+拖拽/中键平移画布
- Ctrl+Z 撤销，Ctrl+Y 重做
- 双击节点编辑文字
- 选中节点显示锚点，从锚点拖出连线
- JSON 导入/导出
- 属性面板：编辑文字、宽高、颜色
