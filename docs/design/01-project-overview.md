# 1. 项目概述

## 1.1 项目简介

Markdown LiveSync 是一个为 VS Code 和 Cursor 编辑器设计的 Markdown 实时预览插件。重构后的版本完全基于 VSCode 内置预览面板，使用 WebView API 提供高性能的实时预览体验，支持实时同步、目录导航、Mermaid 图表渲染等功能。

## 1.2 核心特性

### 1.2.1 VSCode集成预览
- **内置预览面板**：完全集成到VSCode编辑器中，无需外部浏览器
- **实时同步**：编辑内容即时同步到预览面板
- **光标位置同步**：编辑器光标位置自动同步到预览，预览面板也可以同步到编辑器
- **灵活布局**：支持侧边栏预览或当前窗口预览
- **智能文档切换**：自动跟随当前活动的Markdown文档

### 1.2.2 Markdown 扩展支持
- **Mermaid 图表渲染**
  - 流程图 (Flowchart)
  - 序列图 (Sequence Diagram)
  - 甘特图 (Gantt Chart)
  - 类图 (Class Diagram)
  - 状态图 (State Diagram)
  - 饼图 (Pie Chart)
- **代码语法高亮**：自动高亮显示代码块
- **表格和任务列表**：完美渲染表格和复选框
- **数学公式支持**：规划支持KaTeX数学公式

### 1.2.3 目录导航系统
- **自动目录生成**：根据文档标题自动生成导航目录
- **分级折叠控制**：支持按级别折叠/展开，默认折叠到第2级
- **快速定位跳转**：点击目录项快速跳转到对应位置
- **当前位置高亮**：自动高亮当前浏览位置
- **状态记忆**：记住用户的目录折叠状态

### 1.2.4 开发和调试工具
- **调试工具面板**：内置调试工具支持
- **行号标记**：支持显示行号辅助定位
- **状态监控**：实时显示同步状态和性能信息
- **错误诊断**：提供详细的错误信息和调试数据

## 1.3 技术栈

- **开发语言**: TypeScript
- **运行环境**: Node.js + VSCode Extension API  
- **核心框架**: VSCode WebView API
- **Markdown 解析**: markdown-it
- **图表渲染**: Mermaid.js
- **UI框架**: VSCode 原生WebView

## 1.4 项目结构

```
markdown-livesync/
├── src/                     # 源代码
│   ├── app.ts              # 插件入口点
│   ├── core/               # 核心功能模块
│   │   └── extension-service.ts # 插件核心服务和生命周期管理
│   ├── preview/            # 预览系统
│   │   ├── markdown-preview-panel.ts # WebView预览面板实现
│   │   └── toc-provider.ts           # 目录导航提供者
│   ├── markdown/           # Markdown处理
│   │   ├── markdown-processor.ts    # Markdown解析和处理
│   │   ├── mermaid-plugin.ts        # Mermaid图表插件
│   │   └── line-number-plugin.ts    # 行号插件
│   ├── config/             # 配置管理
│   │   └── config-manager.ts        # 用户配置管理器
│   ├── utils/              # 工具函数
│   │   ├── logger-util.ts  # 日志记录工具
│   │   └── debounce-util.ts # 防抖处理工具
│   └── types/              # 类型定义
│       └── markdown-it.d.ts # TypeScript类型定义
├── media/                  # 媒体资源文件
├── tests/                  # 测试文件
├── docs/                   # 项目文档
│   ├── design/            # 架构设计文档
│   ├── mermaid/           # Mermaid相关文档
│   └── refactor/          # 重构说明文档
└── images/                 # 图标等图片资源
```

## 1.5 快速开始

### 1.5.1 安装
1. 从 VSIX 安装
   - 下载最新的 `.vsix` 文件
   - 在 VS Code 中，选择"扩展"视图（Ctrl+Shift+X）
   - 点击右上角"..."菜单，选择"从 VSIX 安装..."
   - 选择下载的 `.vsix` 文件并安装

2. 从源码安装
   ```bash
   git clone https://github.com/hmslsky/markdown-livesync.git
   cd markdown-livesync
   npm install
   npm run compile
   ```

### 1.5.2 使用方法
1. **启动预览**
   - 快捷键: `Ctrl+Shift+V` (Windows/Linux) 或 `Cmd+Shift+V` (Mac)
   - 右键菜单: "Markdown LiveSync: 打开预览"
   - 命令面板: 输入"Markdown LiveSync: 打开预览"
   - 编辑器标题栏: 点击"在侧边打开预览"按钮

2. **目录导航**
   - 点击目录项快速跳转到对应位置
   - 使用快捷操作展开/折叠目录级别
   - 点击箭头图标展开/折叠子目录

3. **Mermaid 图表**
   ```markdown
   ```mermaid
   graph TD
       A[开始] --> B{条件判断}
       B -->|是| C[执行操作]
       B -->|否| D[结束]
       C --> D
   ```
   ```

4. **调试工具**
   - 快捷键: `Ctrl+Shift+D` (Windows/Linux) 或 `Cmd+Shift+D` (Mac)
   - 查看同步状态和性能信息
   - 错误诊断和问题排查

## 1.6 配置选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| **预览配置** | | |
| markdown-livesync.preview.defaultView | 预览面板默认显示位置 | side |
| markdown-livesync.preview.showToc | 是否显示目录导航 | true |
| markdown-livesync.preview.syncScroll | 是否启用滚动同步 | true |
| markdown-livesync.preview.highlightOnScroll | 滚动时是否高亮目标元素 | false |
| **目录配置** | | |
| markdown-livesync.toc.defaultCollapseLevel | 目录默认折叠级别 | 2 |
| markdown-livesync.toc.showToggleButton | 是否显示折叠切换按钮 | true |
| markdown-livesync.toc.highlightCurrentItem | 是否高亮当前目录项 | true |
| markdown-livesync.toc.rememberCollapseState | 是否记住折叠状态 | true |
| **主题配置** | | |
| markdown-livesync.theme.fontSize | 预览字体大小 | 14 |
| markdown-livesync.theme.fontFamily | 预览字体族 | 系统默认 |
| markdown-livesync.theme.lineHeight | 行高 | 1.6 |
| **性能配置** | | |
| markdown-livesync.performance.chunkSize | 分块渲染大小 | 1000 |
| markdown-livesync.performance.cacheSize | 缓存大小 | 100 |
| markdown-livesync.performance.lazyLoad | 是否启用懒加载 | true |
| **调试配置** | | |
| markdown-livesync.debug | 启用调试日志 | false |

## 1.7 开发命令

```bash
# 编译TypeScript代码
npm run compile

# 监视文件变化并自动编译
npm run watch

# 代码质量检查
npm run lint

# 运行测试套件
npm test

# 启动调试（在VSCode中按F5）
# 调试实例将在新窗口中启动
```

## 1.8 重构亮点

### 1.8.1 性能提升
- **移除HTTP服务器开销**：不再需要本地Express服务器
- **消除WebSocket通信延迟**：直接使用VSCode API进行通信
- **减少资源占用**：无需启动额外的浏览器进程
- **优化内存使用**：使用VSCode内置的WebView管理

### 1.8.2 用户体验改进
- **无缝集成**：完全融入VSCode界面，无需切换窗口
- **更快响应**：实时同步无延迟，编辑即时可见
- **更好兼容性**：自动适配VSCode主题和设置
- **简化操作**：移除了复杂的浏览器配置和端口管理

### 1.8.3 架构优化
- **模块化设计**：清晰的模块分离和职责划分
- **类型安全**：完整的TypeScript类型定义
- **错误处理**：完善的错误捕获和用户提示
- **可扩展性**：插件化的功能扩展机制 