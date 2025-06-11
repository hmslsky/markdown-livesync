# 3. 模块详解

## 3.1 核心服务模块 (Core)

### 3.1.1 插件生命周期管理
```typescript
export class Extension {
  private static instance: Extension;
  private context: vscode.ExtensionContext;
  private configManager: ConfigurationManager;
  private disposables: vscode.Disposable[] = [];

  // 插件激活
  public async activate(): Promise<void> {
    Logger.info('Markdown LiveSync 插件正在激活...');
    
    try {
      this.registerCommands();
      this.registerEventListeners();
      this.registerConfigurationListeners();
      
      Logger.info('Markdown LiveSync 插件激活成功');
    } catch (error) {
      Logger.error('插件激活失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  // 插件停用
  public deactivate(): void {
    Logger.info('Markdown LiveSync 插件正在停用...');
    
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    Logger.info('Markdown LiveSync 插件已停用');
  }
}
```

### 3.1.2 命令注册和处理
```typescript
private registerCommands(): void {
  // 打开预览命令
  const openPreviewCommand = vscode.commands.registerCommand(
    'markdown-livesync.openPreview',
    async () => {
      try {
        await this.openPreview();
      } catch (error) {
        Logger.error('执行打开预览命令失败: ' + (error instanceof Error ? error.message : String(error)));
        vscode.window.showErrorMessage('打开预览失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  // 在侧边打开预览命令
  const openPreviewToSideCommand = vscode.commands.registerCommand(
    'markdown-livesync.openPreviewToSide',
    async () => {
      try {
        await this.openPreviewToSide();
      } catch (error) {
        Logger.error('执行打开侧边预览命令失败: ' + (error instanceof Error ? error.message : String(error)));
        vscode.window.showErrorMessage('打开侧边预览失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  // 切换调试工具命令
  const toggleDebugToolsCommand = vscode.commands.registerCommand(
    'markdown-livesync.toggleDebugTools',
    () => {
      try {
        this.toggleDebugTools();
      } catch (error) {
        Logger.error('执行切换调试工具命令失败: ' + (error instanceof Error ? error.message : String(error)));
        vscode.window.showErrorMessage('切换调试工具失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  this.disposables.push(
    openPreviewCommand,
    openPreviewToSideCommand,
    toggleDebugToolsCommand
  );
}
```

### 3.1.3 事件监听管理
```typescript
private registerEventListeners(): void {
  // 监听文档关闭事件
  const onDocumentClose = vscode.workspace.onDidCloseTextDocument(doc => {
    if (doc.languageId === 'markdown') {
      MarkdownPreviewPanel.getInstance().closePreviewForDocument(doc.uri);
    }
  });

  // 监听活动编辑器变更事件
  const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && editor.document.languageId === 'markdown') {
      const panel = MarkdownPreviewPanel.getInstance();
      if (panel.isVisible()) {
        panel.updateActiveDocument(editor.document);
      }
    }
  });

  // 监听文档内容变更事件
  const onDocumentChange = vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'markdown') {
      const panel = MarkdownPreviewPanel.getInstance();
      if (panel.isVisible() && panel.isCurrentDocument(event.document)) {
        panel.updateContent();
      }
    }
  });

  // 监听光标位置变更事件
  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor.document.languageId === 'markdown') {
      const panel = MarkdownPreviewPanel.getInstance();
      if (panel.isVisible() && panel.isCurrentDocument(event.textEditor.document)) {
        panel.syncCursorPosition(event.selections[0].active);
      }
    }
  });

  this.disposables.push(
    onDocumentClose,
    onActiveEditorChange,
    onDocumentChange,
    onSelectionChange
  );
}
```

## 3.2 预览系统模块 (Preview)

### 3.2.1 WebView面板管理
```typescript
export class MarkdownPreviewPanel {
  private static instance: MarkdownPreviewPanel;
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private tocProvider: TocProvider;
  private configManager: ConfigurationManager;

  // 显示预览面板
  public async show(document: vscode.TextDocument, column: vscode.ViewColumn): Promise<void> {
    Logger.info(`显示预览面板: ${document.fileName}`);

    try {
      if (this.panel) {
        this.panel.reveal(column);
      } else {
        await this.createPanel(column);
      }

      this.currentDocument = document;
      this.updateContent();
    } catch (error) {
      Logger.error('显示预览面板失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  // 创建WebView面板
  private async createPanel(column: vscode.ViewColumn): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      'markdownPreview',
      'Markdown Preview',
      column,
      {
        enableScripts: true,
        enableFindWidget: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(Extension.getInstance().getContext().extensionPath, 'media'))
        ]
      }
    );

    // 设置WebView内容
    this.panel.webview.html = await this.getWebviewContent();

    // 处理WebView消息
    this.panel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      undefined,
      Extension.getInstance().getContext().subscriptions
    );

    // 处理面板关闭事件
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        Logger.info('预览面板已关闭');
      },
      null,
      Extension.getInstance().getContext().subscriptions
    );
  }
}
```

### 3.2.2 内容渲染和更新
```typescript
// 更新预览内容
public updateContent(): void {
  if (!this.panel || !this.currentDocument) {
    return;
  }

  try {
    const content = this.currentDocument.getText();
    const processor = MarkdownProcessor.getInstance();
    const htmlContent = processor.convertToHtml(content);
    
    // 生成目录
    const toc = this.tocProvider.generateToc(content);
    const tocHtml = this.tocProvider.renderTocHtml(toc);

    // 发送更新消息到WebView
    this.panel.webview.postMessage({
      type: 'updateContent',
      content: htmlContent,
      toc: tocHtml,
      config: this.configManager.getPreviewConfig()
    });

    Logger.debug('预览内容已更新');
  } catch (error) {
    Logger.error('更新预览内容失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 生成WebView HTML内容
private async getWebviewContent(): Promise<string> {
  const config = this.configManager.getPreviewConfig();
  const themeConfig = this.configManager.getThemeConfig();
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Preview</title>
    <style>
        body {
            font-family: ${themeConfig.fontFamily || 'system-ui, -apple-system, sans-serif'};
            font-size: ${themeConfig.fontSize}px;
            line-height: ${themeConfig.lineHeight};
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .container {
            display: flex;
            gap: 20px;
        }
        
        .toc {
            width: 250px;
            flex-shrink: 0;
            background-color: var(--vscode-sideBar-background);
            border-radius: 8px;
            padding: 15px;
            position: sticky;
            top: 20px;
            max-height: calc(100vh - 40px);
            overflow-y: auto;
            ${config.showToc ? '' : 'display: none;'}
        }
        
        .content {
            flex: 1;
            max-width: 100%;
        }
        
        .debug-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            font-size: 12px;
            display: none;
        }
        
        /* Mermaid图表样式 */
        .mermaid {
            text-align: center;
            margin: 20px 0;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="toc" id="toc">
            <!-- 目录内容将在这里动态加载 -->
        </div>
        <div class="content" id="content">
            <!-- Markdown内容将在这里动态加载 -->
        </div>
    </div>
    
    <div class="debug-panel" id="debugPanel">
        <div>状态: <span id="status">就绪</span></div>
        <div>行号: <span id="lineNumber">-</span></div>
        <div>滚动位置: <span id="scrollPosition">-</span></div>
    </div>

    <script>
        // 初始化Mermaid
        mermaid.initialize({ 
            startOnLoad: true,
            theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default'
        });

        // 处理来自插件的消息
        window.addEventListener('message', event => {
            const message = event.data;
            handleMessage(message);
        });

        function handleMessage(message) {
            switch (message.type) {
                case 'updateContent':
                    updateContent(message.content, message.toc, message.config);
                    break;
                case 'syncPosition':
                    syncPosition(message.line);
                    break;
                case 'toggleDebug':
                    toggleDebugPanel();
                    break;
            }
        }

        function updateContent(content, toc, config) {
            document.getElementById('content').innerHTML = content;
            document.getElementById('toc').innerHTML = toc;
            
            // 重新渲染Mermaid图表
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            
            // 更新状态
            updateDebugInfo('status', '已更新');
        }

        function syncPosition(line) {
            const element = document.querySelector(\`[data-line="\${line}"]\`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 高亮显示
                if (element.classList.contains('highlight')) {
                    element.classList.remove('highlight');
                }
                setTimeout(() => element.classList.add('highlight'), 10);
                
                updateDebugInfo('lineNumber', line);
            }
        }

        function toggleDebugPanel() {
            const panel = document.getElementById('debugPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        function updateDebugInfo(key, value) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        }

        // 监听滚动事件
        window.addEventListener('scroll', () => {
            updateDebugInfo('scrollPosition', window.scrollY);
        });

        // 监听目录点击事件
        document.addEventListener('click', event => {
            if (event.target.classList.contains('toc-item')) {
                const line = event.target.getAttribute('data-line');
                if (line) {
                    // 通知插件跳转到指定行
                    vscode.postMessage({
                        type: 'jumpToLine',
                        line: parseInt(line)
                    });
                }
            }
        });
    </script>
</body>
</html>`;
}
```

### 3.2.3 位置同步
```typescript
// 同步光标位置
public syncCursorPosition(position: vscode.Position): void {
  if (!this.panel || !this.currentDocument) {
    return;
  }

  try {
    // 发送位置同步消息到WebView
    this.panel.webview.postMessage({
      type: 'syncPosition',
      line: position.line
    });

    Logger.debug(`光标位置已同步: 行 ${position.line}`);
  } catch (error) {
    Logger.error('同步光标位置失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 处理WebView消息
private handleWebviewMessage(message: any): void {
  try {
    switch (message.type) {
      case 'jumpToLine':
        this.jumpToLine(message.line);
        break;
      case 'toggleDebug':
        this.toggleDebugMode();
        break;
      case 'ready':
        Logger.info('WebView已就绪');
        break;
      default:
        Logger.warn('未知的WebView消息类型: ' + message.type);
    }
  } catch (error) {
    Logger.error('处理WebView消息失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 跳转到指定行
private jumpToLine(line: number): void {
  const editor = vscode.window.activeTextEditor;
  if (editor && this.isCurrentDocument(editor.document)) {
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}
```

## 3.3 目录导航模块 (ToC)

### 3.3.1 目录生成
```typescript
export class TocProvider {
  private configManager: ConfigurationManager;

  constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  // 生成目录结构
  public generateToc(content: string): TocItem[] {
    const headings = this.extractHeadings(content);
    return this.buildTocTree(headings);
  }

  // 提取标题
  private extractHeadings(content: string): Heading[] {
    const regex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Heading[] = [];
    const lines = content.split('\n');
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const line = this.getLineNumber(content, match.index);
      
      headings.push({
        level,
        text,
        line,
        id: this.generateId(text)
      });
    }
    
    return headings;
  }

  // 构建目录树
  private buildTocTree(headings: Heading[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: TocItem[] = [];

    for (const heading of headings) {
      const item: TocItem = {
        text: heading.text,
        level: heading.level,
        line: heading.line,
        id: heading.id,
        children: []
      };

      // 找到合适的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return root;
  }

  // 生成ID
  private generateId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // 获取行号
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length - 1;
  }
}
```

### 3.3.2 目录渲染
```typescript
// 渲染目录HTML
public renderTocHtml(toc: TocItem[]): string {
  const config = this.configManager.getTocConfig();
  
  if (toc.length === 0) {
    return '<div class="toc-empty">暂无目录</div>';
  }

  let html = '<div class="toc-header">';
  html += '<h3>目录</h3>';
  
  if (config.showToggleButton) {
    html += `
      <div class="toc-controls">
        <button onclick="expandAll()" title="展开全部">⊞</button>
        <button onclick="collapseAll()" title="折叠全部">⊟</button>
      </div>
    `;
  }
  
  html += '</div>';
  html += '<div class="toc-content">';
  html += this.renderTocItems(toc, config.defaultCollapseLevel);
  html += '</div>';

  return html;
}

// 渲染目录项
private renderTocItems(items: TocItem[], collapseLevel: number, currentLevel: number = 1): string {
  let html = '<ul class="toc-list">';

  for (const item of items) {
    const hasChildren = item.children.length > 0;
    const isCollapsed = currentLevel > collapseLevel;
    
    html += `<li class="toc-item toc-level-${item.level}">`;
    
    if (hasChildren) {
      html += `
        <div class="toc-item-header">
          <span class="toc-toggle ${isCollapsed ? 'collapsed' : ''}" 
                onclick="toggleTocItem(this)">▼</span>
          <a class="toc-link" data-line="${item.line}" href="#${item.id}">
            ${this.escapeHtml(item.text)}
          </a>
        </div>
      `;
      
      html += `<div class="toc-children ${isCollapsed ? 'collapsed' : ''}">`;
      html += this.renderTocItems(item.children, collapseLevel, currentLevel + 1);
      html += '</div>';
    } else {
      html += `
        <a class="toc-link" data-line="${item.line}" href="#${item.id}">
          ${this.escapeHtml(item.text)}
        </a>
      `;
    }
    
    html += '</li>';
  }

  html += '</ul>';
  return html;
}

// HTML转义
private escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

## 3.4 Markdown处理模块

### 3.4.1 Markdown解析
```typescript
export class MarkdownProcessor {
  private static instance: MarkdownProcessor;
  private md: markdownIt;

  private constructor() {
    this.md = new markdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: false
    });

    this.initializePlugins();
  }

  public static getInstance(): MarkdownProcessor {
    if (!MarkdownProcessor.instance) {
      MarkdownProcessor.instance = new MarkdownProcessor();
    }
    return MarkdownProcessor.instance;
  }

  // 初始化插件
  private initializePlugins(): void {
    // 添加行号插件
    this.md.use(lineNumberPlugin);
    
    // 添加Mermaid插件
    this.md.use(mermaidPlugin);
    
    Logger.info('Markdown插件初始化完成');
  }

  // 转换Markdown为HTML
  public convertToHtml(markdown: string): string {
    try {
      const html = this.md.render(markdown);
      Logger.debug('Markdown转换成功');
      return html;
    } catch (error) {
      Logger.error('Markdown转换失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  public getMarkdownIt(): markdownIt {
    return this.md;
  }
}
```

### 3.4.2 Mermaid图表插件
```typescript
export function mermaidPlugin(md: markdownIt): void {
  const fence = md.renderer.rules.fence!;

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    const code = token.content.trim();
    const info = token.info ? token.info.trim() : '';

    if (info === 'mermaid') {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      return `
        <div class="mermaid-container">
          <div class="mermaid" id="${id}">${escapeHtml(code)}</div>
        </div>
      `;
    }

    return fence(tokens, idx, options, env, slf);
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### 3.4.3 行号插件
```typescript
export function lineNumberPlugin(md: markdownIt): void {
  // 保存原始的段落渲染规则
  const defaultParagraphRender = md.renderer.rules.paragraph_open || 
    ((tokens, idx, options, env, slf) => slf.renderToken(tokens, idx, options));

  // 保存原始的标题渲染规则
  const defaultHeadingRender = md.renderer.rules.heading_open ||
    ((tokens, idx, options, env, slf) => slf.renderToken(tokens, idx, options));

  // 重写段落渲染规则
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (token.map && token.map.length >= 2) {
      const line = token.map[0];
      token.attrSet('data-line', line.toString());
    }
    return defaultParagraphRender(tokens, idx, options, env, slf);
  };

  // 重写标题渲染规则
  md.renderer.rules.heading_open = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (token.map && token.map.length >= 2) {
      const line = token.map[0];
      token.attrSet('data-line', line.toString());
    }
    return defaultHeadingRender(tokens, idx, options, env, slf);
  };

  // 添加代码块行号
  const defaultCodeRender = md.renderer.rules.code_block ||
    ((tokens, idx, options, env, slf) => slf.renderToken(tokens, idx, options));

  md.renderer.rules.code_block = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (token.map && token.map.length >= 2) {
      const line = token.map[0];
      token.attrSet('data-line', line.toString());
    }
    return defaultCodeRender(tokens, idx, options, env, slf);
  };
}
```

## 3.5 配置管理模块

### 3.5.1 配置读取和管理
```typescript
export class ConfigurationManager {
  private static instance: ConfigurationManager;

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  // 获取预览配置
  public getPreviewConfig(): PreviewConfig {
    const config = vscode.workspace.getConfiguration('markdown-livesync.preview');
    
    return {
      defaultView: config.get('defaultView', 'side'),
      showToc: config.get('showToc', true),
      syncScroll: config.get('syncScroll', true),
      highlightOnScroll: config.get('highlightOnScroll', false)
    };
  }

  // 获取目录配置
  public getTocConfig(): TocConfig {
    const config = vscode.workspace.getConfiguration('markdown-livesync.toc');
    
    return {
      defaultCollapseLevel: config.get('defaultCollapseLevel', 2),
      showToggleButton: config.get('showToggleButton', true),
      highlightCurrentItem: config.get('highlightCurrentItem', true),
      rememberCollapseState: config.get('rememberCollapseState', true)
    };
  }

  // 获取主题配置
  public getThemeConfig(): ThemeConfig {
    const config = vscode.workspace.getConfiguration('markdown-livesync.theme');
    
    return {
      fontSize: config.get('fontSize', 14),
      fontFamily: config.get('fontFamily', ''),
      lineHeight: config.get('lineHeight', 1.6)
    };
  }

  // 获取性能配置
  public getPerformanceConfig(): PerformanceConfig {
    const config = vscode.workspace.getConfiguration('markdown-livesync.performance');
    
    return {
      chunkSize: config.get('chunkSize', 1000),
      cacheSize: config.get('cacheSize', 100),
      lazyLoad: config.get('lazyLoad', true)
    };
  }

  // 重新加载配置
  public reloadConfiguration(): void {
    Logger.info('重新加载配置');
    // 配置会在下次获取时自动刷新
  }

  // 获取特定配置项
  public get<T>(key: string, defaultValue?: T): T {
    return vscode.workspace.getConfiguration('markdown-livesync').get(key, defaultValue!);
  }
}
```

### 3.5.2 配置类型定义
```typescript
export interface PreviewConfig {
  defaultView: 'side' | 'window';
  showToc: boolean;
  syncScroll: boolean;
  highlightOnScroll: boolean;
}

export interface TocConfig {
  defaultCollapseLevel: number;
  showToggleButton: boolean;
  highlightCurrentItem: boolean;
  rememberCollapseState: boolean;
}

export interface ThemeConfig {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

export interface PerformanceConfig {
  chunkSize: number;
  cacheSize: number;
  lazyLoad: boolean;
}

export interface TocItem {
  text: string;
  level: number;
  line: number;
  id: string;
  children: TocItem[];
}

export interface Heading {
  level: number;
  text: string;
  line: number;
  id: string;
}
```

## 3.6 工具模块

### 3.6.1 日志工具
```typescript
export class Logger {
  private static isDebugMode: boolean = false;

  public static setDebugMode(enabled: boolean): void {
    Logger.isDebugMode = enabled;
  }

  public static info(message: string): void {
    console.log(`[Markdown LiveSync] INFO: ${message}`);
  }

  public static warn(message: string): void {
    console.warn(`[Markdown LiveSync] WARN: ${message}`);
  }

  public static error(message: string): void {
    console.error(`[Markdown LiveSync] ERROR: ${message}`);
  }

  public static debug(message: string): void {
    if (Logger.isDebugMode) {
      console.debug(`[Markdown LiveSync] DEBUG: ${message}`);
    }
  }

  public static dispose(): void {
    // 清理日志资源
  }
}
```

### 3.6.2 防抖工具
```typescript
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

// 使用示例
export class DebouncedUpdater {
  private debouncedUpdate: (...args: any[]) => void;

  constructor(updateFunction: (...args: any[]) => void, delay: number = 300) {
    this.debouncedUpdate = debounce(updateFunction, delay);
  }

  public update(...args: any[]): void {
    this.debouncedUpdate(...args);
  }
}
```

## 3.7 模块集成示例

### 3.7.1 完整的预览更新流程
```typescript
// 在Extension类中的完整更新流程
private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  if (event.document.languageId !== 'markdown') {
    return;
  }

  const panel = MarkdownPreviewPanel.getInstance();
  if (!panel.isVisible() || !panel.isCurrentDocument(event.document)) {
    return;
  }

  try {
    // 1. 获取文档内容
    const content = event.document.getText();
    
    // 2. 处理Markdown
    const processor = MarkdownProcessor.getInstance();
    const htmlContent = processor.convertToHtml(content);
    
    // 3. 生成目录
    const tocProvider = new TocProvider();
    const toc = tocProvider.generateToc(content);
    const tocHtml = tocProvider.renderTocHtml(toc);
    
    // 4. 获取配置
    const config = ConfigurationManager.getInstance();
    const previewConfig = config.getPreviewConfig();
    
    // 5. 更新WebView
    panel.postMessage({
      type: 'updateContent',
      content: htmlContent,
      toc: tocHtml,
      config: previewConfig
    });
    
    Logger.debug('文档变更处理完成');
  } catch (error) {
    Logger.error('处理文档变更失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}
```

### 3.7.2 错误处理和恢复
```typescript
// 统一错误处理
export class ErrorHandler {
  public static handle(error: Error, context: string): void {
    Logger.error(`${context}: ${error.message}`);
    
    // 根据错误类型进行不同处理
    if (error.name === 'MarkdownError') {
      vscode.window.showWarningMessage(`Markdown解析错误: ${error.message}`);
    } else if (error.name === 'ConfigurationError') {
      vscode.window.showErrorMessage(`配置错误: ${error.message}`);
    } else {
      vscode.window.showErrorMessage(`插件错误: ${error.message}`);
    }
  }

  public static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('重试次数已达上限');
  }
}
``` 