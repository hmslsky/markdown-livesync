# 2. 架构设计

## 2.1 系统架构

### 2.1.1 整体架构
```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  VS Code/Cursor  |<--->|  Markdown        |<--->|  浏览器预览      |
|  编辑器          |     |  LiveSync        |     |  页面            |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### 2.1.2 核心模块
```
Markdown LiveSync
├── 核心模块 (Core)
│   ├── 插件初始化
│   ├── 生命周期管理
│   └── 事件处理
│
├── Markdown 处理 (Markdown)
│   ├── 语法解析
│   ├── 扩展支持
│   └── HTML 生成
│
├── 预览系统 (Preview)
│   ├── 浏览器集成
│   ├── 实时渲染
│   └── 同步控制
│
└── 服务器模块 (Server)
    ├── HTTP 服务
    ├── 资源处理
    └── 通信管理
```

## 2.2 数据流

### 2.2.1 编辑到预览流程
```
编辑器内容
    ↓
Markdown 解析
    ↓
HTML 生成
    ↓
资源处理
    ↓
浏览器预览
    ↓
同步处理
```

### 2.2.2 同步流程
```
编辑器状态
    ↓
位置计算
    ↓
状态转换
    ↓
浏览器更新
    ↓
视觉反馈
```

## 2.3 模块设计

### 2.3.1 核心模块 (Core)
- **职责**：
  - 插件生命周期管理
  - 命令注册和处理
  - 事件分发
  - 配置管理

- **关键类**：
  ```typescript
  class Extension {
    activate(context: vscode.ExtensionContext): void
    deactivate(): void
    registerCommands(): void
    handleEvents(): void
  }
  ```

### 2.3.2 Markdown 处理模块
- **职责**：
  - Markdown 语法解析
  - 扩展语法支持
  - HTML 生成
  - 资源处理

- **关键类**：
  ```typescript
  class MarkdownProcessor {
    parse(content: string): string
    convertToHtml(markdown: string): string
    processResources(html: string): string
  }
  ```

### 2.3.3 预览系统
- **职责**：
  - 浏览器管理
  - 预览页面渲染
  - 位置同步
  - 用户交互

- **关键类**：
  ```typescript
  class PreviewManager {
    openPreview(uri: vscode.Uri): void
    updateContent(content: string): void
    syncPosition(position: Position): void
  }
  ```

### 2.3.4 服务器模块
- **职责**：
  - HTTP 服务管理
  - 资源服务
  - WebSocket 通信
  - 安全控制

- **关键类**：
  ```typescript
  class PreviewServer {
    start(): void
    stop(): void
    handleRequest(req: Request, res: Response): void
  }
  ```

## 2.4 通信机制

### 2.4.1 编辑器到预览
- WebSocket 实时通信
- HTTP 资源请求
- 文件系统监听

### 2.4.2 预览到编辑器
- 位置同步
- 用户交互反馈
- 状态更新

## 2.5 扩展性设计

### 2.5.1 插件系统
- 自定义语法支持
- 自定义渲染器
- 自定义主题

### 2.5.2 配置系统
- 用户配置
- 主题配置
- 扩展配置

## 2.6 性能优化

### 2.6.1 渲染优化
- 增量更新
- 延迟加载
- 资源预加载

### 2.6.2 同步优化
- 节流处理
- 批量更新
- 缓存机制

## 2.7 安全设计

### 2.7.1 通信安全
- 本地服务器限制
- 请求验证
- 资源保护

### 2.7.2 数据安全
- 本地数据处理
- 输入验证
- 错误处理 