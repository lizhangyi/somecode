# JSON 编辑器项目 Code Wiki

## 项目概述

这是一个用于编辑 JSON 数据的工具项目，提供了两种实现版本：
1. **纯 HTML/JavaScript 版本**：独立文件，无需构建工具
2. **Vue 3 + Element Plus 版本**：基于现代前端框架，使用组件化开发

### 核心功能
- JSON 数据的可视化表格编辑
- 支持新增、删除键值对
- 自动类型识别（null、boolean、number、string）
- JSON 数据格式化展示
- 友好的交互体验和错误提示

---

## 目录结构

```
/workspace/
├── vue_project/               # Vue 3 版本项目
│   ├── src/
│   │   ├── components/
│   │   │   ├── HelloWorld.vue     # 示例组件
│   │   │   └── JsonEditor.vue     # 核心 JSON 编辑器组件
│   │   ├── App.vue                # 根组件
│   │   ├── main.js                # 应用入口
│   │   └── style.css              # 全局样式
│   ├── public/                    # 静态资源
│   ├── index.html                 # HTML 模板
│   ├── package.json               # 项目配置
│   └── vite.config.js             # Vite 配置
└── json-editor.html           # 纯 HTML/JavaScript 版本
```

---

## Vue 3 版本技术架构

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5.34 | 前端框架 |
| Element Plus | 2.14.0 | UI 组件库 |
| Vite | 6.4.2 | 构建工具 |
| @element-plus/icons-vue | 2.3.2 | 图标库 |

### 核心文件说明

#### 1. [main.js](file:///workspace/vue_project/src/main.js)
应用入口文件，负责初始化 Vue 应用并配置 Element Plus。

```javascript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'

createApp(App).use(ElementPlus).mount('#app')
```

#### 2. [App.vue](file:///workspace/vue_project/src/App.vue)
根组件，仅包含 JsonEditor 组件的引用和渲染。

```vue
<script setup>
import JsonEditor from './components/JsonEditor.vue'
</script>

<template>
  <JsonEditor />
</template>
```

#### 3. [JsonEditor.vue](file:///workspace/vue_project/src/components/JsonEditor.vue)
核心编辑器组件，包含完整的 JSON 编辑逻辑。

---

## 核心模块详解

### JsonEditor 组件

#### 状态管理

| 状态变量 | 类型 | 说明 |
|----------|------|------|
| jsonOutput | Ref<string> | JSON 字符串输出 |
| dialogVisible | Ref<boolean> | 控制编辑对话框显示/隐藏 |
| rows | Ref<Array> | 表格行数据数组 |
| parseError | Ref<string> | 解析错误信息 |

#### 核心函数

##### openDialog()
打开编辑对话框，解析当前 JSON 数据并填充到表格中。

**功能**：
- 清空之前的错误信息
- 解析 jsonOutput 为 JavaScript 对象
- 验证对象类型（仅支持单层 Object）
- 将对象转换为表格行数据
- 打开对话框

**异常处理**：捕获 JSON 解析错误，显示友好提示信息。

##### addRow()
向表格中添加新的空行。

##### deleteRow(index)
删除指定索引的表格行。

**参数**：
- `index`：要删除行的索引

##### clearRows()
清空表格的所有行。

##### save()
将表格数据保存为 JSON 格式。

**处理逻辑**：
1. 遍历所有表格行
2. 自动识别值类型（null、boolean、number、string）
3. 生成新的 JavaScript 对象
4. 格式化为 JSON 字符串
5. 关闭对话框并显示成功提示

#### 模板结构

```
JsonEditor 组件
├── 标题区域
├── JSON 数据展示区（只读文本域）
└── 编辑对话框
    ├── 错误提示区
    ├── 工具栏（新增、清空）
    ├── 表格编辑区
    │   ├── KEY 列
    │   ├── VALUE 列
    │   └── 删除操作列
    └── 底部操作栏（取消、保存）
```

---

## 纯 HTML/JavaScript 版本

### 文件说明
[json-editor.html](file:///workspace/json-editor.html) 是一个完整的单文件实现，包含 HTML、CSS 和 JavaScript。

### 核心函数

| 函数名 | 功能 |
|--------|------|
| openModal() | 打开编辑模态框，解析 JSON 并填充表格 |
| closeModal() | 关闭编辑模态框 |
| saveModal() | 保存表格数据为 JSON |
| addRow() | 添加新行 |
| clearRows() | 清空表格 |

### 特点
- 零依赖，直接在浏览器打开即可使用
- 原生 JavaScript 实现
- 支持模态框点击遮罩层关闭
- 回车键快捷操作

---

## 依赖关系

### Vue 版本依赖树

```
vue_project
├── vue@3.5.34
├── element-plus@2.14.0
├── @element-plus/icons-vue@2.3.2
└── vite@6.4.2 (开发依赖)
    └── @vitejs/plugin-vue@5.2.4
```

---

## 项目运行方式

### Vue 版本

#### 开发模式
```bash
cd /workspace/vue_project
npm install
npm run dev
```
访问显示的本地地址（通常为 `http://localhost:5173`）

#### 生产构建
```bash
npm run build
```

#### 预览构建结果
```bash
npm run preview
```

### 纯 HTML 版本
直接在浏览器中打开 [json-editor.html](file:///workspace/json-editor.html) 文件即可使用。

---

## 功能特性总结

| 功能 | Vue 版本 | HTML 版本 |
|------|----------|-----------|
| JSON 解析与验证 | ✅ | ✅ |
| 表格编辑 | ✅ | ✅ |
| 新增键值对 | ✅ | ✅ |
| 删除键值对 | ✅ | ✅ |
| 清空表格 | ✅ | ✅ |
| 类型自动识别 | ✅ | ✅ |
| 错误提示 | ✅ | ✅ |
| 成功反馈 | ✅ (ElMessage) | ❌ |
| 组件化架构 | ✅ | ❌ |
| 零依赖 | ❌ | ✅ |

---

## 数据流程

### 编辑流程

```
1. 用户点击"编辑"按钮
   ↓
2. 解析当前 JSON 字符串为对象
   ↓
3. 将对象转换为表格行数据
   ↓
4. 打开编辑对话框
   ↓
5. 用户编辑表格（新增/删除/修改）
   ↓
6. 点击"保存"
   ↓
7. 表格数据转换回 JSON 对象
   ↓
8. 格式化并更新显示
   ↓
9. 关闭对话框
```

---

## 注意事项

1. **JSON 结构限制**：仅支持单层 Object 结构，不支持嵌套对象或数组
2. **类型识别规则**：
   - 字符串 `"null"` → `null`
   - 字符串 `"true"` → `true`
   - 字符串 `"false"` → `false`
   - 可转换为数字的字符串 → `Number`
   - 其他 → 保持为字符串
3. **空值处理**：KEY 为空的行会被忽略

---

## 扩展建议

1. 支持嵌套对象和数组的可视化编辑
2. 添加 JSON 语法高亮
3. 支持导入/导出 JSON 文件
4. 添加撤销/重做功能
5. 支持 JSON Schema 验证
6. 添加搜索和替换功能
