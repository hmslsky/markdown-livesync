# 1. 项目概述

## 1.1 项目简介

Markdown LiveSync 是一个为 VS Code 和 Cursor 编辑器设计的 Markdown 实时预览插件。它提供了无缝的编辑和预览体验，支持实时同步、目录导航、Mermaid 图表渲染等功能。

## 1.2 核心特性

### 1.2.1 实时预览与同步
- 实时同步编辑内容到预览
- 自动同步编辑器光标位置到预览
- 可折叠的目录导航
- 响应式设计，适配不同屏幕尺寸

### 1.2.2 Markdown 扩展支持
- Mermaid 图表渲染
  - 流程图
  - 序列图
  - 甘特图
  - 类图
  - 状态图
  - 饼图
- 代码高亮显示
- 数学公式支持

### 1.2.3 开发工具
- 调试工具支持
- 行号标记
- 跳转功能
- 光标位置显示

## 1.3 技术栈

- **开发语言**: TypeScript
- **运行环境**: Node.js
- **核心框架**: VS Code Extension API
- **Markdown 解析**: Markdown-it
- **HTTP 服务器**: Express.js
- **图表渲染**: Mermaid.js

## 1.4 项目结构

```
markdown-livesync/
├── src/                  # 源代码
│   ├── extension.ts      # 插件入口点
│   ├── commands/         # 命令实现
│   ├── markdown/         # Markdown处理逻辑
│   ├── server/           # 本地HTTP服务器
│   ├── browser/          # 浏览器集成
│   └── utils/            # 工具函数
├── webview/              # 浏览器预览页面资源
├── docs/                 # 项目文档
├── tests/                # 测试文件
├── package.json          # 插件配置
└── tsconfig.json         # TypeScript配置
```

## 1.5 快速开始

### 1.5.1 安装
1. 从 VSIX 安装
   - 下载最新的 `.vsix` 文件
   - 在 VS Code 中，选择"扩展"视图
   - 点击"..."菜单，选择"从 VSIX 安装..."
   - 选择下载的 `.vsix` 文件

2. 从源码安装
   ```bash
   git clone [项目地址]
   cd markdown-livesync
   npm install
   npm run compile
   ```

### 1.5.2 使用方法
1. 启动预览
   - 快捷键: `Ctrl+Shift+V` (Windows/Linux) 或 `Cmd+Shift+V` (Mac)
   - 右键菜单: "Markdown LiveSync: 在浏览器中预览"
   - 命令面板: 输入"Markdown LiveSync: 在浏览器中预览"

2. 目录导航
   - 点击目录项快速跳转
   - 使用快捷操作展开/折叠目录
   - 点击箭头展开/折叠子目录

3. Mermaid 图表
   ```markdown
   ```mermaid
   graph TD
       A[开始] --> B{条件判断}
       B -->|是| C[执行操作]
       B -->|否| D[结束]
       C --> D
   ```
   ```

## 1.6 配置选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| markdown-livesync.browser | 指定预览浏览器路径 | 默认浏览器 |
| markdown-livesync.showToc | 是否显示目录导航 | true |
| markdown-livesync.highlightOnScroll | 滚动时高亮目标元素 | false |
| markdown-livesync.debug | 启用调试日志 | false |

## 1.7 开发命令

```bash
# 编译
npm run compile

# 监视文件变化
npm run watch

# 代码检查
npm run lint

# 运行测试
npm test
``` 