# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Two separate projects at root:

- **`json-editor.html`** — Standalone single-file JSON editor tool. Vanilla HTML/CSS/JS with a modal table UI for editing JSON key-value pairs. No build step needed, open directly in browser.
- **`vue_project/`** — Vue 3 + Vite 6 scaffold (standard create-vite template). Uses `<script setup>` SFCs. Contains a default HelloWorld counter component.

## Vue Project Commands

```bash
# dev server (port 5173)
cd vue_project && npm run dev

# production build
cd vue_project && npm run build

# preview production build
cd vue_project && npm run preview
```

## Architecture Notes

- **Node version**: v20.17.0 — Vite was downgraded from v8 to v6 for compatibility (Vite 8 requires Node ≥20.19 or ≥22.12).
- **`vue_project/src/main.js`** mounts `App.vue` into `#app`.
- **`vue_project/src/App.vue`** is the root component; imports `HelloWorld`.
- **`vue_project/src/style.css`** has global styles with light/dark `prefers-color-scheme` support.
- No TypeScript, no routing, no state management, no component library, no tests configured.
