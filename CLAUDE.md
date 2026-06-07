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
│   └── snake-game/
│       └── index.html             # 贪吃蛇游戏（霓虹赛博朋克风格）
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

Single HTML file at `projects/snake-game/index.html`. Open directly in browser - no dependencies.

Controls:
- SPACE: Start/Restart
- P: Pause
- Arrow keys or WASD: Move
