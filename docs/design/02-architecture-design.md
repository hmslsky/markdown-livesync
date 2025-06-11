# 2. 架构设计

## 2.1 系统架构

### 2.1.1 整体架构
```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  VS Code/Cursor  |<--->|  Markdown        |<--->|  WebView         |
|  编辑器          |     |  LiveSync        |     |  预览面板        |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

**架构说明**：
- **VS Code编辑器**：提供Markdown文档编辑功能，监听文档变更和光标移动
- **Markdown LiveSync插件**：核心处理逻辑，包括文档解析、同步控制、配置管理
- **WebView预览面板**：使用VSCode内置WebView API渲染预览内容

### 2.1.2 核心模块
```
Markdown LiveSync 插件架构
├── 核心服务 (Core)
│   ├── 插件生命周期管理
│   ├── 命令注册和处理
│   ├── 事件监听和分发
│   └── 错误处理和日志
│
├── 预览系统 (Preview)
│   ├── WebView面板管理
│   ├── 内容渲染和更新
│   ├── 目录导航控制
│   └── 光标位置同步
│
├── Markdown处理 (Markdown)
│   ├── 语法解析和转换
│   ├── Mermaid图表渲染
│   ├── 行号标记处理
│   └── 扩展语法支持
│
├── 配置管理 (Configuration)
│   ├── 用户设置读取
│   ├── 配置变更监听
│   ├── 默认值管理
│   └── 配置验证
│
└── 工具模块 (Utils)
    ├── 日志记录工具
    ├── 防抖处理工具
    ├── 错误处理工具
    └── 性能监控工具
```

## 2.2 数据流

### 2.2.1 编辑到预览流程
```
编辑器内容变更
    ↓
文档变更事件监听
    ↓
Markdown内容解析
    ↓
HTML内容生成
    ↓
WebView内容更新
    ↓
预览面板渲染
```

### 2.2.2 光标同步流程
```
编辑器光标位置变更
    ↓
位置变更事件监听
    ↓
行号位置计算
    ↓
目标元素定位
    ↓
WebView滚动控制
    ↓
预览面板位置同步
```

### 2.2.3 配置更新流程
```
用户修改设置
    ↓
配置变更事件监听
    ↓
配置管理器重新加载
    ↓
通知相关模块
    ↓
预览面板样式更新
```

## 2.3 模块设计

### 2.3.1 核心服务模块 (Core)
**职责**：
- 插件生命周期管理（激活/停用）
- VSCode命令注册和处理
- 事件监听器注册和管理
- 全局错误处理和日志记录

**关键类**：
```typescript
export class Extension {
  private static instance: Extension;
  private context: vscode.ExtensionContext;
  private configManager: ConfigurationManager;
  private disposables: vscode.Disposable[] = [];

  // 单例模式获取实例
  public static getInstance(context?: vscode.ExtensionContext): Extension;

  // 插件激活
  public async activate(): Promise<void>;

  // 插件停用
  public deactivate(): void;

  // 命令注册
  private registerCommands(): void;

  // 事件监听器注册
  private registerEventListeners(): void;

  // 配置监听器注册
  private registerConfigurationListeners(): void;
}
```

### 2.3.2 预览系统模块 (Preview)
**职责**：
- WebView面板的创建和管理
- 预览内容的渲染和更新
- 目录导航的生成和控制
- 编辑器与预览的位置同步

**关键类**：
```typescript
export class MarkdownPreviewPanel {
  private static instance: MarkdownPreviewPanel;
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private tocProvider: TocProvider;

  // 单例模式获取实例
  public static getInstance(): MarkdownPreviewPanel;

  // 显示预览面板
  public async show(document: vscode.TextDocument, column: vscode.ViewColumn): Promise<void>;

  // 更新预览内容
  public updateContent(): void;

  // 同步光标位置
  public syncCursorPosition(position: vscode.Position): void;

  // 处理WebView消息
  private handleWebviewMessage(message: any): void;

  // 生成HTML内容
  private generateHtmlContent(): string;
}

export class TocProvider {
  // 生成目录结构
  public generateToc(content: string): TocItem[];

  // 渲染目录HTML
  public renderTocHtml(toc: TocItem[]): string;

  // 查找行号对应的目录项
  public findTocItemByLine(line: number): TocItem | null;
}
```

### 2.3.3 Markdown处理模块
**职责**：
- Markdown语法解析和HTML转换
- Mermaid图表的识别和渲染
- 行号标记的添加和处理
- 自定义语法扩展的支持

**关键类**：
```typescript
export class MarkdownProcessor {
  private static instance: MarkdownProcessor;
  private md: markdownIt;

  // 单例模式获取实例
  public static getInstance(): MarkdownProcessor;

  // 转换Markdown为HTML
  public convertToHtml(markdown: string): string;

  // 获取markdown-it实例
  public getMarkdownIt(): markdownIt;

  // 初始化插件
  private initializePlugins(): void;
}

// Mermaid图表插件
export function mermaidPlugin(md: markdownIt): void;

// 行号标记插件
export function lineNumberPlugin(md: markdownIt): void;
```

### 2.3.4 配置管理模块
**职责**：
- 读取和管理用户配置
- 监听配置变更并通知相关模块
- 提供配置项的类型安全访问
- 处理配置的默认值和验证

**关键类**：
```typescript
export class ConfigurationManager {
  private static instance: ConfigurationManager;

  // 单例模式获取实例
  public static getInstance(): ConfigurationManager;

  // 获取预览配置
  public getPreviewConfig(): PreviewConfig;

  // 获取目录配置
  public getTocConfig(): TocConfig;

  // 获取主题配置
  public getThemeConfig(): ThemeConfig;

  // 获取性能配置
  public getPerformanceConfig(): PerformanceConfig;

  // 重新加载配置
  public reloadConfiguration(): void;

  // 获取特定配置项
  public get<T>(key: string, defaultValue?: T): T;
}
```

## 2.4 通信机制

### 2.4.1 插件内部通信
- **事件驱动**：使用VSCode事件API进行模块间通信
- **单例模式**：确保全局状态的一致性
- **配置中心**：统一的配置管理和分发

### 2.4.2 编辑器与预览通信
- **VSCode API**：直接使用VSCode Extension API
- **WebView消息**：通过postMessage进行双向通信
- **实时同步**：基于文档变更事件的即时更新

### 2.4.3 WebView内容更新
```typescript
// 从插件向WebView发送消息
this.panel.webview.postMessage({
  type: 'updateContent',
  content: htmlContent,
  scrollPosition: position
});

// 从WebView向插件发送消息
this.panel.webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case 'scrollToLine':
      this.scrollToLine(message.line);
      break;
    case 'toggleDebug':
      this.toggleDebugMode();
      break;
  }
});
```

## 2.5 扩展性设计

### 2.5.1 插件系统
- **Markdown-it插件**：支持自定义语法扩展
- **主题系统**：支持自定义CSS样式
- **渲染器扩展**：支持自定义内容渲染

### 2.5.2 配置系统
- **分层配置**：用户配置、工作区配置、默认配置
- **类型安全**：TypeScript接口定义配置结构
- **动态更新**：配置变更时自动更新相关功能

### 2.5.3 事件系统
```typescript
// 事件监听注册
private registerEventListeners(): void {
  // 文档内容变更
  const onDocumentChange = vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'markdown') {
      this.handleDocumentChange(event);
    }
  });

  // 光标位置变更
  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor.document.languageId === 'markdown') {
      this.handleSelectionChange(event);
    }
  });

  // 配置变更
  const onConfigChange = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('markdown-livesync')) {
      this.handleConfigurationChange(event);
    }
  });
}
```

## 2.6 性能优化

### 2.6.1 渲染优化
- **增量更新**：只更新变更的内容部分
- **防抖处理**：避免频繁的重复渲染
- **懒加载**：按需加载大型图表和图片
- **缓存机制**：缓存已渲染的HTML内容

### 2.6.2 内存管理
- **资源清理**：及时清理不再使用的资源
- **单例模式**：减少重复对象创建
- **事件解绑**：插件停用时清理所有事件监听器
- **WebView生命周期**：合理管理WebView的创建和销毁

### 2.6.3 同步优化
```typescript
// 防抖处理示例
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用防抖优化内容更新
private debouncedUpdateContent = debounce(() => {
  this.updateContent();
}, 300);
```

## 2.7 安全设计

### 2.7.1 WebView安全
- **内容安全策略**：限制WebView中的脚本执行
- **本地资源访问**：严格控制文件系统访问权限
- **消息验证**：验证WebView与插件间的消息格式

### 2.7.2 文件系统安全
- **路径验证**：验证文件路径的合法性
- **权限检查**：确保只访问允许的文件和目录
- **错误处理**：安全地处理文件读取错误

### 2.7.3 输入验证
```typescript
// 消息验证示例
private validateMessage(message: any): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const validTypes = ['scrollToLine', 'toggleDebug', 'updateToc'];
  if (!validTypes.includes(message.type)) {
    return false;
  }

  // 根据消息类型进行具体验证
  switch (message.type) {
    case 'scrollToLine':
      return typeof message.line === 'number' && message.line >= 0;
    default:
      return true;
  }
}
```

## 2.8 重构后的架构优势

### 2.8.1 简化的架构
- **移除复杂组件**：不再需要HTTP服务器、WebSocket等
- **减少依赖**：移除Express.js、ws等外部依赖
- **统一技术栈**：完全基于VSCode Extension API

### 2.8.2 更好的性能
- **直接通信**：消除网络通信开销
- **内存优化**：使用VSCode内置的WebView管理
- **更快响应**：减少通信层次，提高响应速度

### 2.8.3 更好的用户体验
- **无缝集成**：完全融入VSCode界面
- **自动主题适配**：自动跟随VSCode主题变化
- **简化配置**：移除端口管理等复杂配置 