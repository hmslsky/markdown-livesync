# Markdown LiveSync - VS Code/Cursor 实时预览插件

Markdown LiveSync 是一个为 VS Code 和 Cursor 编辑器设计的 Markdown 实时预览插件，提供无缝的编辑和预览体验。

作者: [hmslsky](https://github.com/hmslsky)

## 主要功能

### 实时预览与同步

在浏览器中预览 Markdown 文件，支持以下特性：
- 实时同步编辑内容到预览
- 自动同步编辑器光标位置到预览
- 可折叠的目录导航
- **Mermaid图表渲染**: 支持流程图、序列图、甘特图等多种图表类型
- 代码高亮显示
- 响应式设计，适配不同屏幕尺寸

## 安装

### 从VSIX安装
1. 下载最新的`.vsix`文件
2. 在VS Code中，选择"扩展"视图
3. 点击"..."菜单，选择"从VSIX安装..."
4. 选择下载的`.vsix`文件

### 从源码安装
1. 克隆仓库
2. 运行`npm install`安装依赖
3. 运行`npm run compile`编译代码
4. 按F5启动调试实例

## 使用方法

### 启动预览

1. 打开一个Markdown文件
2. 使用以下任一方式启动预览：
   - 按下快捷键 `Ctrl+Shift+V` (Windows/Linux) 或 `Cmd+Shift+V` (Mac)
   - 右键点击编辑器，选择"Markdown LiveSync: 在浏览器中预览"
   - 打开命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`)，输入"Markdown LiveSync: 在浏览器中预览"

### 使用目录导航

- 点击目录项可快速跳转到对应标题
- 使用目录顶部的快捷操作可展开/折叠不同级别的目录项
- 点击目录项旁的箭头可展开/折叠子目录

### Mermaid图表

插件支持Mermaid图表的实时渲染，使用方法：

1. 在Markdown文档中创建代码块，指定语言为 `mermaid`
2. 在代码块中编写Mermaid图表代码
3. 保存文件后，图表将自动在预览中渲染

支持的图表类型：
- 流程图 (Flowchart)
- 序列图 (Sequence Diagram)
- 甘特图 (Gantt Chart)
- 类图 (Class Diagram)
- 状态图 (State Diagram)
- 饼图 (Pie Chart)

示例：
````markdown
```mermaid
graph TD
    A[开始] --> B{条件判断}
    B -->|是| C[执行操作]
    B -->|否| D[结束]
    C --> D
```
````

### 调试工具

预览页面中提供了调试工具，帮助开发者调试和测试：

- 使用快捷键 `Ctrl+Shift+E` (Windows/Linux) 或 `Cmd+Shift+E` (Mac) 可以快速切换调试工具的显示状态
- 调试工具提供行号标记、跳转功能和当前光标位置显示

## 配置选项

在VS Code设置中，可以配置以下选项：

- `markdown-livesync.browser`: 指定用于打开预览的浏览器路径，留空使用默认浏览器
- `markdown-livesync.showToc`: 是否默认显示目录导航（默认：是）
- `markdown-livesync.highlightOnScroll`: 滚动到指定位置时是否高亮显示目标元素（默认：否）
- `markdown-livesync.debug`: 启用调试日志（默认：否）

## 开发功能

### 项目结构

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
├── package.json          # 插件配置
└── tsconfig.json         # TypeScript配置
```
### 构建和测试

- `npm run compile`: 编译TypeScript代码
- `npm run watch`: 监视文件变化并自动编译
- `npm run lint`: 运行ESLint检查代码
- `npm test`: 运行测试

## 许可证

Apache License 2.0

Copyright 2023 hmslsky

## 贡献

欢迎提交问题和功能请求！
