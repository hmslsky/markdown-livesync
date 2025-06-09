# 3. 模块详解

## 3.1 Markdown 处理模块

### 3.1.1 语法解析
```typescript
class MarkdownParser {
  // 配置 Markdown-it 实例
  private configureMarkdownIt(): void {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  // 解析 Markdown 内容
  parse(content: string): string {
    return this.md.render(content);
  }
}
```

### 3.1.2 扩展语法支持
```typescript
class MarkdownExtensions {
  // Mermaid 图表支持
  private setupMermaid(): void {
    this.md.use(mermaidPlugin, {
      startOnLoad: true,
      theme: 'default'
    });
  }

  // 数学公式支持
  private setupMath(): void {
    this.md.use(katexPlugin, {
      throwOnError: false
    });
  }
}
```

### 3.1.3 资源处理
```typescript
class ResourceProcessor {
  // 处理图片路径
  processImagePaths(html: string, basePath: string): string {
    return html.replace(
      /<img src="([^"]+)"/g,
      (match, src) => `<img src="${this.resolvePath(src, basePath)}"`
    );
  }

  // 处理链接路径
  processLinkPaths(html: string, basePath: string): string {
    return html.replace(
      /<a href="([^"]+)"/g,
      (match, href) => `<a href="${this.resolvePath(href, basePath)}"`
    );
  }
}
```

## 3.2 预览系统

### 3.2.1 浏览器管理
```typescript
class BrowserManager {
  // 打开浏览器
  async openBrowser(url: string): Promise<void> {
    const browser = await this.getBrowserPath();
    await this.launchBrowser(browser, url);
  }

  // 获取浏览器路径
  private async getBrowserPath(): Promise<string> {
    return vscode.workspace.getConfiguration('markdown-livesync')
      .get('browser') || this.getDefaultBrowser();
  }
}
```

### 3.2.2 实时渲染
```typescript
class PreviewRenderer {
  // 更新预览内容
  updateContent(content: string): void {
    this.ws.send(JSON.stringify({
      type: 'content',
      content: this.processContent(content)
    }));
  }

  // 处理内容
  private processContent(content: string): string {
    return this.mdParser.parse(content);
  }
}
```

### 3.2.3 位置同步
```typescript
class PositionSync {
  // 同步编辑器位置到预览
  syncPosition(position: vscode.Position): void {
    const element = this.findElementAtPosition(position);
    if (element) {
      this.scrollToElement(element);
      this.highlightElement(element);
    }
  }

  // 查找对应元素
  private findElementAtPosition(position: vscode.Position): Element | null {
    return this.positionMap.get(position.line);
  }
}
```

## 3.3 服务器模块

### 3.3.1 HTTP 服务
```typescript
class PreviewServer {
  // 启动服务器
  async start(): Promise<void> {
    this.app = express();
    this.setupRoutes();
    this.server = this.app.listen(this.port);
  }

  // 设置路由
  private setupRoutes(): void {
    this.app.get('/preview', this.handlePreview);
    this.app.get('/resource/*', this.handleResource);
    this.app.ws('/ws', this.handleWebSocket);
  }
}
```

### 3.3.2 WebSocket 通信
```typescript
class WebSocketManager {
  // 处理 WebSocket 连接
  handleConnection(ws: WebSocket): void {
    ws.on('message', (message: string) => {
      const data = JSON.parse(message);
      this.handleMessage(data);
    });
  }

  // 处理消息
  private handleMessage(data: any): void {
    switch (data.type) {
      case 'scroll':
        this.handleScroll(data);
        break;
      case 'click':
        this.handleClick(data);
        break;
    }
  }
}
```

## 3.4 核心功能实现

### 3.4.1 目录生成
```typescript
class TocGenerator {
  // 生成目录
  generateToc(content: string): TocItem[] {
    const headings = this.extractHeadings(content);
    return this.buildTocTree(headings);
  }

  // 提取标题
  private extractHeadings(content: string): Heading[] {
    const regex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Heading[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: this.getLineNumber(content, match.index)
      });
    }
    return headings;
  }
}
```

### 3.4.2 主题支持
```typescript
class ThemeManager {
  // 应用主题
  applyTheme(theme: string): void {
    const themeData = this.loadTheme(theme);
    this.updateStyles(themeData);
  }

  // 加载主题
  private loadTheme(theme: string): ThemeData {
    return require(`../themes/${theme}.json`);
  }
}
```

### 3.4.3 调试工具
```typescript
class DebugTools {
  // 显示调试信息
  showDebugInfo(): void {
    this.showLineNumbers();
    this.showPosition();
    this.showSyncStatus();
  }

  // 显示行号
  private showLineNumbers(): void {
    const elements = document.querySelectorAll('pre code');
    elements.forEach(element => {
      this.addLineNumbers(element);
    });
  }
}
```

## 3.5 性能优化实现

### 3.5.1 增量更新
```typescript
class IncrementalUpdater {
  // 增量更新内容
  updateContent(oldContent: string, newContent: string): void {
    const diff = this.computeDiff(oldContent, newContent);
    this.applyDiff(diff);
  }

  // 计算差异
  private computeDiff(oldContent: string, newContent: string): Diff {
    return diff.diffWords(oldContent, newContent);
  }
}
```

### 3.5.2 缓存机制
```typescript
class CacheManager {
  // 缓存内容
  cacheContent(key: string, content: string): void {
    this.cache.set(key, {
      content,
      timestamp: Date.now()
    });
  }

  // 获取缓存
  getCachedContent(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.content;
    }
    return null;
  }
}
```

### 3.5.3 资源预加载
```typescript
class ResourcePreloader {
  // 预加载资源
  preloadResources(resources: string[]): void {
    resources.forEach(resource => {
      this.preloadImage(resource);
      this.preloadScript(resource);
    });
  }

  // 预加载图片
  private preloadImage(url: string): void {
    const img = new Image();
    img.src = url;
  }
}
``` 