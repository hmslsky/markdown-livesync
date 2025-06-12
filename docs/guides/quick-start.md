# 快速开始指南

欢迎使用 Markdown LiveSync！本指南将帮助您在5分钟内开始使用这个强大的 Markdown 预览扩展。

## 📦 安装

### 从 VS Code 市场安装
1. 打开 VS Code
2. 按 `Ctrl+Shift+X` (Windows/Linux) 或 `Cmd+Shift+X` (macOS) 打开扩展面板
3. 搜索 "Markdown LiveSync"
4. 点击"安装"按钮

### 从 VSIX 文件安装
1. 下载最新的 `.vsix` 文件
2. 在 VS Code 中按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Extensions: Install from VSIX"
4. 选择下载的 `.vsix` 文件

## 🚀 基本使用

### 打开预览
1. 打开任意 `.md` 文件
2. 使用以下任一方式打开预览：
   - 按 `Ctrl+Shift+V` (Windows/Linux) 或 `Cmd+Shift+V` (macOS)
   - 右键点击编辑器，选择"打开预览"
   - 使用命令面板：`Markdown LiveSync: 打开预览`

### 核心功能体验

#### 1. 双向滚动同步
- 在编辑器中移动光标，预览面板会自动滚动到对应位置
- 在预览面板中滚动，编辑器光标会自动跟随
- 同步延迟 < 100ms，体验流畅

#### 2. 智能目录导航
- 预览面板左侧显示文档目录
- 点击目录项快速跳转到对应章节
- 支持分级展开/折叠（点击数字按钮 1,2,3,4）
- 响应式设计：窗口较窄时自动变为浮动模式

#### 3. 主题切换
- 点击预览面板右上角的主题按钮（🌞/🌙）
- 或使用快捷键 `Ctrl+Shift+T`
- 支持 GitHub 官方浅色/深色主题

#### 4. Mermaid 图表
```mermaid
graph TD
    A[开始] --> B{是否安装?}
    B -->|是| C[打开预览]
    B -->|否| D[安装扩展]
    D --> C
    C --> E[享受使用!]
```

## ⚙️ 基本配置

### 访问设置
1. 按 `Ctrl+,` (Windows/Linux) 或 `Cmd+,` (macOS) 打开设置
2. 搜索 "markdown livesync"

### 常用设置
```json
{
  "markdownLiveSync.preview.syncScroll": true,
  "markdownLiveSync.toc.enabled": true,
  "markdownLiveSync.theme.current": "light"
}
```

## 🎯 快速技巧

### 键盘快捷键
- `Ctrl+Shift+V` - 打开/关闭预览
- `Ctrl+Shift+T` - 切换主题
- `Escape` - 隐藏浮动目录（移动模式下）

### 目录操作
- **📁** - 折叠所有目录项
- **📂** - 展开所有目录项
- **👁️** - 隐藏/显示目录面板
- **1,2,3,4** - 展开到指定级别

### 响应式体验
- 桌面模式（宽度 > 900px）：固定侧边栏
- 移动模式（宽度 ≤ 900px）：浮动目录，点击 📋 图标触发

## 🔧 故障排除

### 预览不显示
1. 确认文件是 `.md` 格式
2. 检查是否有语法错误
3. 重启 VS Code

### 同步不工作
1. 检查设置中的 `syncScroll` 是否启用
2. 确认预览面板可见
3. 查看开发者控制台是否有错误

### 主题不切换
1. 确认 GitHub 样式文件已加载
2. 检查浏览器控制台错误
3. 尝试刷新预览面板

## 📚 下一步

- [完整用户手册](user-guide.md) - 了解所有功能
- [配置指南](configuration.md) - 自定义您的体验
- [故障排除](troubleshooting.md) - 解决常见问题

---

🎉 **恭喜！** 您已经掌握了 Markdown LiveSync 的基本使用。现在可以享受流畅的 Markdown 编写体验了！ 