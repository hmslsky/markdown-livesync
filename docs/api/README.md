# API 参考文档

本文档提供了 Markdown LiveSync 扩展的完整 API 参考，包括所有公开的接口、类型定义和使用示例。

## 📚 API 概览

### 核心模块
- [扩展服务 API](extension-service.md) - 主要扩展服务接口
- [配置管理 API](config-manager.md) - 配置管理相关接口
- [预览面板 API](preview-panel.md) - 预览面板控制接口
- [目录提供器 API](toc-provider.md) - 目录生成和管理接口

### 工具模块
- [Markdown 处理器 API](markdown-processor.md) - Markdown 转换接口
- [文件工具 API](file-utils.md) - 文件操作工具接口
- [日志系统 API](logger.md) - 日志记录接口

### 类型定义
- [核心类型](types/core-types.md) - 核心数据类型
- [配置类型](types/config-types.md) - 配置相关类型
- [事件类型](types/event-types.md) - 事件系统类型

## 🚀 快速开始

### 基本使用
```typescript
import { ExtensionService } from './core/extension-service';
import { ConfigManager } from './config/config-manager';

// 获取扩展服务实例
const extensionService = ExtensionService.getInstance();

// 获取配置管理器
const configManager = ConfigManager.getInstance();

// 打开预览面板
await extensionService.openPreview();
```

### 配置管理
```typescript
// 获取配置值
const syncEnabled = configManager.get('preview.syncScroll');

// 设置配置值
await configManager.set('theme.current', 'dark');

// 监听配置变化
configManager.onConfigChanged((key, value) => {
  console.log(`配置 ${key} 已更改为:`, value);
});
```

## 📖 详细文档

### [扩展服务 API](extension-service.md)
主要的扩展服务接口，提供预览面板管理、命令注册等功能。

**主要方法**:
- `openPreview()` - 打开预览面板
- `closePreview()` - 关闭预览面板
- `refreshPreview()` - 刷新预览内容
- `toggleTheme()` - 切换主题

### [配置管理 API](config-manager.md)
配置系统的核心接口，处理所有配置相关操作。

**主要方法**:
- `get(key)` - 获取配置值
- `set(key, value)` - 设置配置值
- `reset(key)` - 重置配置
- `onConfigChanged(callback)` - 监听配置变化

### [预览面板 API](preview-panel.md)
WebView 预览面板的控制接口。

**主要方法**:
- `show()` - 显示面板
- `hide()` - 隐藏面板
- `updateContent(html)` - 更新内容
- `syncToLine(line)` - 同步到指定行

### [目录提供器 API](toc-provider.md)
文档目录生成和管理接口。

**主要方法**:
- `generateToc(content)` - 生成目录
- `updateToc(toc)` - 更新目录
- `expandToLevel(level)` - 展开到指定级别
- `collapseAll()` - 折叠所有项目

## 🔧 高级用法

### 自定义插件开发
```typescript
import { MarkdownProcessor } from './markdown/markdown-processor';

// 创建自定义插件
const customPlugin = {
  name: 'custom-plugin',
  process: (content: string) => {
    // 自定义处理逻辑
    return content.replace(/\[custom\]/g, '<span class="custom">Custom</span>');
  }
};

// 注册插件
const processor = new MarkdownProcessor();
processor.addPlugin(customPlugin);
```

### 事件监听
```typescript
import { EventEmitter } from './utils/event-emitter';

// 监听预览更新事件
EventEmitter.on('preview:updated', (data) => {
  console.log('预览已更新:', data);
});

// 监听主题切换事件
EventEmitter.on('theme:changed', (theme) => {
  console.log('主题已切换到:', theme);
});
```

## 📋 类型定义

### 核心接口
```typescript
interface IExtensionService {
  openPreview(): Promise<void>;
  closePreview(): void;
  refreshPreview(): void;
  toggleTheme(): void;
}

interface IConfigManager {
  get<T>(key: string): T;
  set<T>(key: string, value: T): Promise<void>;
  reset(key: string): Promise<void>;
  onConfigChanged(callback: ConfigChangeCallback): void;
}
```

### 配置类型
```typescript
interface PreviewConfig {
  syncScroll: boolean;
  defaultView: 'side' | 'tab';
  highlightOnScroll: boolean;
  refreshDelay: number;
}

interface TocConfig {
  enabled: boolean;
  showToggleButton: boolean;
  defaultCollapseLevel: number;
  autoExpandCurrent: boolean;
  position: 'left' | 'right';
  width: number;
}
```

## 🔍 错误处理

### 常见错误类型
```typescript
enum ErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  PREVIEW_ERROR = 'PREVIEW_ERROR',
  TOC_ERROR = 'TOC_ERROR',
  THEME_ERROR = 'THEME_ERROR'
}

interface ExtensionError {
  type: ErrorType;
  message: string;
  details?: any;
}
```

### 错误处理示例
```typescript
try {
  await extensionService.openPreview();
} catch (error) {
  if (error.type === ErrorType.PREVIEW_ERROR) {
    console.error('预览面板打开失败:', error.message);
  }
}
```

## 📚 相关资源

- [开发指南](../design/04-development-guide.md) - 开发环境和工具
- [架构设计](../design/02-architecture-design.md) - 系统架构说明
- [模块详解](../design/03-module-details.md) - 各模块实现细节
- [故障排除](../guides/troubleshooting.md) - 常见问题解决

---

💡 **提示**：API 文档会随着版本更新而变化，请确保使用与您的扩展版本匹配的文档。 