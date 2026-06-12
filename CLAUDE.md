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
