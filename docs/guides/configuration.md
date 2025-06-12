# 配置指南

本指南详细介绍了 Markdown LiveSync 的所有配置选项，帮助您自定义最适合的使用体验。

## 📋 配置概览

Markdown LiveSync 提供了丰富的配置选项，分为以下几个类别：
- **预览设置** - 控制预览面板行为
- **目录设置** - 自定义目录导航
- **主题设置** - 外观和样式配置
- **Mermaid设置** - 图表功能配置

## ⚙️ 访问配置

### 方法1：VS Code 设置界面
1. 按 `Ctrl+,` (Windows/Linux) 或 `Cmd+,` (macOS)
2. 搜索 "markdown livesync"
3. 在图形界面中修改设置

### 方法2：settings.json 文件
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "Preferences: Open Settings (JSON)"
3. 在 JSON 文件中添加配置

## 🖥️ 预览设置

### 基本预览配置
```json
{
  "markdownLiveSync.preview.syncScroll": true,
  "markdownLiveSync.preview.defaultView": "side",
  "markdownLiveSync.preview.highlightOnScroll": true,
  "markdownLiveSync.preview.refreshDelay": 300
}
```

#### syncScroll
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 启用编辑器和预览面板的双向滚动同步

#### defaultView
- **类型**: `string`
- **可选值**: `"side"` | `"tab"`
- **默认值**: `"side"`
- **说明**: 预览面板的默认显示方式

#### highlightOnScroll
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 滚动时高亮显示当前行

#### refreshDelay
- **类型**: `number`
- **默认值**: `300`
- **说明**: 内容更新的延迟时间（毫秒）

## 📑 目录设置

### 目录导航配置
```json
{
  "markdownLiveSync.toc.enabled": true,
  "markdownLiveSync.toc.showToggleButton": true,
  "markdownLiveSync.toc.defaultCollapseLevel": 2,
  "markdownLiveSync.toc.autoExpandCurrent": true,
  "markdownLiveSync.toc.position": "left",
  "markdownLiveSync.toc.width": 280
}
```

#### enabled
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 启用目录导航功能

#### showToggleButton
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 显示目录切换按钮

#### defaultCollapseLevel
- **类型**: `number`
- **默认值**: `2`
- **说明**: 默认展开的标题级别（1-6）

#### autoExpandCurrent
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 自动展开当前章节

#### position
- **类型**: `string`
- **可选值**: `"left"` | `"right"`
- **默认值**: `"left"`
- **说明**: 目录面板位置

#### width
- **类型**: `number`
- **默认值**: `280`
- **说明**: 目录面板宽度（像素）

## 🎨 主题设置

### 主题配置
```json
{
  "markdownLiveSync.theme.current": "light",
  "markdownLiveSync.theme.followVSCode": true,
  "markdownLiveSync.theme.custom": {
    "light": {
      "textColor": "#24292e",
      "backgroundColor": "#ffffff",
      "borderColor": "#e1e4e8",
      "linkColor": "#0366d6"
    },
    "dark": {
      "textColor": "#e1e4e8",
      "backgroundColor": "#0d1117",
      "borderColor": "#30363d",
      "linkColor": "#58a6ff"
    }
  }
}
```

#### current
- **类型**: `string`
- **可选值**: `"light"` | `"dark"`
- **默认值**: `"light"`
- **说明**: 当前使用的主题

#### followVSCode
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 跟随 VS Code 主题自动切换

#### custom
- **类型**: `object`
- **说明**: 自定义主题颜色配置

### 自定义主题颜色

#### 浅色主题自定义
```json
{
  "markdownLiveSync.theme.custom.light": {
    "textColor": "#24292e",           // 主文本颜色
    "backgroundColor": "#ffffff",      // 背景颜色
    "borderColor": "#e1e4e8",         // 边框颜色
    "linkColor": "#0366d6",           // 链接颜色
    "codeBackground": "#f6f8fa",      // 代码背景
    "sidebarBackground": "#f6f8fa",   // 侧边栏背景
    "tocLevel1Color": "#24292e",      // 一级标题颜色
    "tocLevel2Color": "#586069",      // 二级标题颜色
    "tocLevel3Color": "#6a737d"       // 三级标题颜色
  }
}
```

#### 深色主题自定义
```json
{
  "markdownLiveSync.theme.custom.dark": {
    "textColor": "#e1e4e8",
    "backgroundColor": "#0d1117",
    "borderColor": "#30363d",
    "linkColor": "#58a6ff",
    "codeBackground": "#161b22",
    "sidebarBackground": "#161b22",
    "tocLevel1Color": "#f0f6fc",
    "tocLevel2Color": "#e1e4e8",
    "tocLevel3Color": "#8b949e"
  }
}
```

## 📊 Mermaid 设置

### Mermaid 图表配置
```json
{
  "markdownLiveSync.mermaid.enabled": true,
  "markdownLiveSync.mermaid.theme": "default",
  "markdownLiveSync.mermaid.enableZoom": true,
  "markdownLiveSync.mermaid.enableFullscreen": true
}
```

#### enabled
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 启用 Mermaid 图表支持

#### theme
- **类型**: `string`
- **可选值**: `"default"` | `"dark"` | `"forest"` | `"neutral"`
- **默认值**: `"default"`
- **说明**: Mermaid 图表主题

#### enableZoom
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 启用图表缩放功能

#### enableFullscreen
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 启用图表全屏功能

## 🔧 高级配置

### 性能优化配置
```json
{
  "markdownLiveSync.performance.syncDebounceDelay": 50,
  "markdownLiveSync.performance.minSyncInterval": 100,
  "markdownLiveSync.performance.enableLazyLoading": true
}
```

### 调试配置
```json
{
  "markdownLiveSync.debug.enableLogging": false,
  "markdownLiveSync.debug.logLevel": "info",
  "markdownLiveSync.debug.showPerformanceMetrics": false
}
```

## 📝 配置示例

### 最小化配置
适合简单使用场景：
```json
{
  "markdownLiveSync.preview.syncScroll": true,
  "markdownLiveSync.toc.enabled": true,
  "markdownLiveSync.theme.followVSCode": true
}
```

### 完整配置
适合高级用户：
```json
{
  "markdownLiveSync.preview.syncScroll": true,
  "markdownLiveSync.preview.defaultView": "side",
  "markdownLiveSync.preview.highlightOnScroll": true,
  "markdownLiveSync.preview.refreshDelay": 200,
  
  "markdownLiveSync.toc.enabled": true,
  "markdownLiveSync.toc.showToggleButton": true,
  "markdownLiveSync.toc.defaultCollapseLevel": 3,
  "markdownLiveSync.toc.autoExpandCurrent": true,
  "markdownLiveSync.toc.position": "left",
  "markdownLiveSync.toc.width": 320,
  
  "markdownLiveSync.theme.current": "dark",
  "markdownLiveSync.theme.followVSCode": false,
  
  "markdownLiveSync.mermaid.enabled": true,
  "markdownLiveSync.mermaid.theme": "dark",
  "markdownLiveSync.mermaid.enableZoom": true,
  "markdownLiveSync.mermaid.enableFullscreen": true
}
```

### 性能优化配置
适合大文档或低性能设备：
```json
{
  "markdownLiveSync.preview.refreshDelay": 500,
  "markdownLiveSync.performance.syncDebounceDelay": 100,
  "markdownLiveSync.performance.minSyncInterval": 200,
  "markdownLiveSync.performance.enableLazyLoading": true,
  "markdownLiveSync.toc.defaultCollapseLevel": 1
}
```

## 🔄 配置重置

### 重置所有配置
1. 打开 VS Code 设置
2. 搜索 "markdown livesync"
3. 点击每个设置项旁边的重置按钮

### 重置特定配置
在 `settings.json` 中删除对应的配置项即可恢复默认值。

## 📚 相关文档

- [快速开始](quick-start.md) - 基本使用方法
- [用户手册](user-guide.md) - 完整功能说明
- [故障排除](troubleshooting.md) - 配置问题解决

---

💡 **提示**：配置修改后会立即生效，无需重启 VS Code。如果遇到问题，可以尝试重新打开预览面板。 