# 项目索引

这是我的代码知识库，记录工作中遇到的各种问题和解决方案。

## 项目列表

### 1. JSON 编辑器
**路径**: `projects/json-editor/`  
**描述**: 可视化 JSON 数据编辑工具，支持表格方式编辑键值对

**包含版本**:
- Vue 3 + Element Plus 版本 (`vue_project/`)
- 纯 HTML/JavaScript 版本 (`json-editor.html`)

**功能特性**:
- JSON 数据格式化展示
- 表格编辑新增/删除键值对
- 自动类型识别
- 友好的错误提示

**快速开始**:
```bash
# Vue 版本
cd projects/json-editor/vue_project
npm install
npm run dev

# HTML 版本
# 直接用浏览器打开 json-editor.html
```

---

### 2. 贪吃蛇游戏
**路径**: `projects/snake-game/`  
**描述**: 复古风格贪吃蛇游戏，采用霓虹赛博朋克 + CRT 复古美学

**玩法说明**:
- 使用方向键或 WASD 控制蛇的移动
- 吃到食物增长身体，分数 +10
- 碰到墙壁或自己的身体则游戏结束
- 按空格键开始/重新开始，P 键暂停

**快速开始**:
```bash
# 直接用浏览器打开
open projects/snake-game/index.html
```

---

## 添加新项目

添加新项目时，建议：
1. 在 `projects/` 下创建以项目名称命名的文件夹
2. 在文件夹中创建 `README.md` 说明文档
3. 更新本索引文件

## 文件夹结构

```
projects/
├── json-editor/
│   ├── vue_project/          # Vue 3 版本
│   ├── json-editor.html     # HTML 版本
│   └── CODE_WIKI.md         # 项目文档
├── snake-game/
│   └── index.html           # 贪吃蛇游戏
└── index.md                 # 本索引文件
```
