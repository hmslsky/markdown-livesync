/**
 * Markdown预览面板
 * 
 * 负责管理VSCode Webview预览面板的生命周期和内容渲染
 * 这是重构后的核心预览组件，替代了原有的浏览器预览方式
 * 
 * @author hmslsky
 * @version 1.0.0
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownProcessor } from '../markdown/markdown-processor';
import { TocProvider } from './toc-provider';
import { ConfigurationManager } from '../config/config-manager';
import { Logger } from '../utils/logger-util';

/**
 * Markdown预览面板类
 * 
 * 管理VSCode Webview面板，提供Markdown内容的实时预览功能
 */
export class MarkdownPreviewPanel {
  private static instance: MarkdownPreviewPanel;
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private markdownProcessor: MarkdownProcessor;
  private tocProvider: TocProvider;
  private configManager: ConfigurationManager;
  private logger: typeof Logger;
  private disposables: vscode.Disposable[] = [];
  private debugToolsVisible: boolean = false;
  private webviewReady: boolean = false;

  /**
   * 私有构造函数
   */
  private constructor() {
    this.markdownProcessor = MarkdownProcessor.getInstance();
    this.tocProvider = new TocProvider();
    this.configManager = ConfigurationManager.getInstance();
    this.logger = Logger;
  }

  /**
   * 获取预览面板实例（单例模式）
   * @returns MarkdownPreviewPanel实例
   */
  public static getInstance(): MarkdownPreviewPanel {
    if (!MarkdownPreviewPanel.instance) {
      MarkdownPreviewPanel.instance = new MarkdownPreviewPanel();
    }
    return MarkdownPreviewPanel.instance;
  }

  /**
   * 显示预览面板
   * @param document 要预览的Markdown文档
   * @param viewColumn 显示位置
   */
  public async show(document: vscode.TextDocument, viewColumn?: vscode.ViewColumn): Promise<void> {
    this.logger.info(`显示预览面板: ${path.basename(document.fileName)}`);
    
    try {
      // 如果面板不存在，创建新面板
      if (!this.panel) {
        await this.createPanel(viewColumn);
      }

      // 更新当前文档
      this.currentDocument = document;

      // 更新内容
      await this.updateContent();

      // 显示面板
      this.panel!.reveal(viewColumn);

    } catch (error) {
      this.logger.error('显示预览面板失败' + (error instanceof Error ? (' ' + error.message) : ''));
      throw error;
    }
  }

  /**
   * 创建Webview面板
   * @param viewColumn 显示位置
   */
  private async createPanel(viewColumn?: vscode.ViewColumn): Promise<void> {
    const config = this.configManager.getPreviewConfig();
    const column = viewColumn || (config.defaultView === 'side' ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);

    this.panel = vscode.window.createWebviewPanel(
      'markdownPreview',
      'Markdown预览',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(__dirname, '..', '..', 'media')),
          vscode.Uri.file(path.join(__dirname, '..', '..', 'node_modules'))
        ]
      }
    );

    // 设置面板图标
    this.panel.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, '..', '..', 'images', 'icon-light.svg')),
      dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'images', 'icon-dark.svg'))
    };

    // 设置事件监听器
    this.setupEventListeners();

    this.logger.info('Webview面板已创建');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.panel) return;

    // 面板关闭事件
    this.panel.onDidDispose(() => {
      this.logger.info('预览面板已关闭');
      this.dispose();
    }, null, this.disposables);

    // 面板可见性变化事件
    this.panel.onDidChangeViewState(e => {
      this.logger.debug(`面板可见性变化: ${e.webviewPanel.visible}`);
    }, null, this.disposables);

    // Webview消息处理
    this.panel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * 处理来自Webview的消息
   * @param message 消息对象
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    this.logger.debug(`收到Webview消息: ${message.type}`);
    switch (message.type) {
      case 'ready':
        this.logger.debug('[Webview] 预览面板就绪');
        if (!this.webviewReady) {
          this.webviewReady = true;
          await this.updateContent();
        }
        break;
      case 'click':
        this.logger.debug('[Webview] 处理点击事件');
        await this.handleClick(message);
        break;
      case 'scroll':
        this.logger.debug(`[Webview] 处理滚动事件: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        this.handleScroll(message);
        break;
      case 'toc-click':
        this.logger.debug(`[Webview] 处理目录点击: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        await this.handleTocClick(message);
        break;
      case 'sync-cursor':
        this.logger.debug(`[Webview] 预览同步到编辑器: 第${message.line + 1}行`);
        await this.syncEditorToLineWithoutFocus(message.line);
        break;
      case 'toc-toggle':
        this.logger.debug('[Webview] 处理目录折叠/展开');
        this.handleTocToggle(message);
        break;
      case 'toc-expand-to-level':
        this.logger.debug(`[Webview] 处理目录分级展开: 第${message.level}级`);
        this.handleTocExpandToLevel(message);
        break;
      case 'debug-info':
        this.logger.debug('[Webview] 处理调试信息请求');
        this.handleDebugInfo(message);
        break;
      default:
        this.logger.warn(`未知的消息类型: ${message.type}`);
    }
  }

  /**
   * 更新预览内容
   */
  public async updateContent(): Promise<void> {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    try {
      const content = this.currentDocument.getText();
      const html = this.markdownProcessor.convertToHtml(content);
      const toc = this.tocProvider.generateToc(this.currentDocument);

      // 如果是首次加载，仍然重设webview.html
      if (!this.webviewReady) {
        const webviewHtml = this.getWebviewContent(html, toc);
        this.panel.webview.html = webviewHtml;
        this.panel.title = `预览: ${path.basename(this.currentDocument.fileName)}`;
      } else {
        // 实时同步：只发送内容到前端
        this.panel.webview.postMessage({ type: 'update-content', html, toc });
      }
      this.logger.debug('预览内容已更新');
    } catch (error) {
      this.logger.error('更新预览内容失败' + (error instanceof Error ? (' ' + error.message) : ''));
      this.panel.webview.html = this.getErrorContent(error as Error);
    }
  }

  /**
   * 生成Webview HTML内容
   * @param html Markdown转换后的HTML
   * @param toc 目录结构
   * @returns 完整的HTML内容
   */
  private getWebviewContent(html: string, toc: any[]): string {
    const config = this.configManager.getConfig();
    const nonce = this.generateNonce();

    // 获取资源URI
    const styleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'preview.css'))
    );
    
    const githubLightUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'github-markdown-light.css'))
    );
    
    const githubDarkUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'github-markdown-dark.css'))
    );
    
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'preview.js'))
    );

    const mermaidUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'))
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel!.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${this.panel!.webview.cspSource} https: data:;">
    <title>Markdown预览</title>
    <!-- GitHub官方Markdown样式 -->
    <link rel="stylesheet" href="${githubLightUri}" media="(prefers-color-scheme: light)">
    <link rel="stylesheet" href="${githubDarkUri}" media="(prefers-color-scheme: dark)">
    <link rel="stylesheet" href="${githubLightUri}" id="github-light-theme">
    <link rel="stylesheet" href="${githubDarkUri}" id="github-dark-theme" disabled>
    <!-- 自定义布局和目录样式 -->
    <link rel="stylesheet" href="${styleUri}">
    <script nonce="${nonce}">
        // 传递配置到前端
        window.markdownLiveSyncConfig = ${JSON.stringify(config)};
        console.log('[配置] 传递配置到前端:', window.markdownLiveSyncConfig);
    </script>
    <script nonce="${nonce}" src="${mermaidUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</head>
<body>
    <div class="container">
        <div class="toc-container">
            ${this.renderTocContainer(toc)}
        </div>
        <div class="content-container">
            <div class="markdown-body">
                ${html}
            </div>
        </div>
        ${this.debugToolsVisible ? this.renderDebugTools() : ''}
    </div>
</body>
</html>`;
  }

  /**
   * 渲染调试工具
   * @returns 调试工具HTML
   */
  private renderDebugTools(): string {
    return `
      <div class="debug-tools">
        <h3>调试工具</h3>
        <div class="debug-info">
          <p>文档路径: ${this.currentDocument?.fileName || '无'}</p>
          <p>文档语言: ${this.currentDocument?.languageId || '无'}</p>
          <p>文档版本: ${this.currentDocument?.version || '无'}</p>
        </div>
      </div>
    `;
  }

  /**
   * 渲染目录容器
   * @param toc 目录结构
   * @returns 目录HTML
   */
  private renderTocContainer(toc: any[]): string {
    const config = this.configManager.getTocConfig();
    
    return `
      <div class="toc-header">
        <h3>目录</h3>
        <div class="toc-controls">
          <button class="toc-toggle-visibility" title="隐藏/显示目录">
            <span class="toc-visibility-icon">👁️</span>
          </button>
          <button class="toc-collapse-all" title="折叠所有">📁</button>
          <button class="toc-expand-all" title="展开所有">📂</button>
        </div>
      </div>
      <div class="toc-content">
        ${this.tocProvider.renderToc(toc)}
      </div>
    `;
  }

  /**
   * 生成错误页面内容
   * @param error 错误对象
   * @returns 错误页面HTML
   */
  private getErrorContent(error: Error): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>预览错误</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        padding: 2rem;
        color: #333;
      }
      .error-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        border: 1px solid #ff4d4f;
        border-radius: 4px;
        background-color: #fff2f0;
      }
      h1 {
        color: #ff4d4f;
        margin-top: 0;
      }
      pre {
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
      }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>预览生成失败</h1>
        <p>${error.message}</p>
        <pre>${error.stack || ''}</pre>
    </div>
</body>
</html>`;
  }

  /**
   * 生成随机nonce值
   * @returns nonce字符串
   */
  private generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * 处理点击事件
   * @param message 消息对象
   */
  private async handleClick(_message: any): Promise<void> {
    // 处理点击事件的具体逻辑
  }

  /**
   * 处理滚动事件
   * @param message 消息对象
   */
  private handleScroll(_message: any): void {
    // 处理滚动事件的具体逻辑
  }

  /**
   * 处理目录点击事件
   * @param message 消息对象
   */
  private async handleTocClick(message: any): Promise<void> {
    if (!this.currentDocument) return;

    try {
      const position = new vscode.Position(message.line, 0);
      const selection = new vscode.Selection(position, position);
      
      // 查找当前文档的编辑器，避免窗口聚焦
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 直接在现有编辑器中设置光标位置
        targetEditor.selection = selection;
        targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      } else {
        // 使用preserveFocus选项避免聚焦
        const editor = await vscode.window.showTextDocument(
          this.currentDocument,
          { preserveFocus: true }
        );
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      this.logger.error('处理目录点击事件失败' + (error instanceof Error ? (' ' + error.message) : ''));
    }
  }

  /**
   * 处理目录折叠/展开事件
   * @param message 消息对象
   */
  private handleTocToggle(_message: any): void {
    // 处理目录折叠/展开事件的具体逻辑
  }

  /**
   * 处理目录分级展开事件
   * @param message 消息对象
   */
  private handleTocExpandToLevel(message: any): void {
    if (message.level && typeof message.level === 'number') {
      this.logger.debug(`[目录] 展开到第${message.level}级标题`);
      // 这里可以保存用户的展开偏好到配置中
      // 目前主要由前端处理展开逻辑
    }
  }

  /**
   * 处理调试信息请求
   * @param message 消息对象
   */
  private handleDebugInfo(_message: any): void {
    // 处理调试信息请求的具体逻辑
  }

  /**
   * 同步光标位置
   * @param position 光标位置
   */
  public syncCursorPosition(position: vscode.Position): void {
    if (!this.panel) return;
    this.logger.debug(`[光标同步] 编辑器同步到预览: 第${position.line + 1}行`);
    this.panel.webview.postMessage({
      type: 'sync-cursor',
      line: position.line,
    });
  }

  private async syncEditorToLine(line: number): Promise<void> {
    if (!this.currentDocument) {
      this.logger.warn('[同步编辑器] 当前没有文档');
      return;
    }
    
    try {
      // line参数是0基索引
      this.logger.debug(`[同步编辑器] 尝试同步到第${line + 1}行 (0基索引: ${line})`);
      
      const position = new vscode.Position(line, 0);
      const selection = new vscode.Selection(position, position);
      
      // 查找当前文档的编辑器，避免使用showTextDocument导致窗口聚焦
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 直接在现有编辑器中设置光标位置，不会导致窗口聚焦
        targetEditor.selection = selection;
        targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        this.logger.debug(`[同步编辑器] 成功同步到第${line + 1}行 (无聚焦)`);
      } else {
        // 如果找不到可见的编辑器，则使用preserveFocus选项
        const editor = await vscode.window.showTextDocument(
          this.currentDocument, 
          { 
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true // 关键：不聚焦到编辑器
          }
        );
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        this.logger.debug(`[同步编辑器] 成功同步到第${line + 1}行 (preserveFocus)`);
      }
    } catch (error) {
      this.logger.error('同步编辑器光标失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 同步编辑器到指定行（无聚焦版本，用于预览面板滚动同步）
   * @param line 行号（0基索引）
   */
  private async syncEditorToLineWithoutFocus(line: number): Promise<void> {
    if (!this.currentDocument) {
      this.logger.warn('[同步编辑器] 当前没有文档');
      return;
    }
    
    try {
      // line参数是0基索引
      this.logger.debug(`[同步编辑器] 预览滚动同步到第${line + 1}行 (0基索引: ${line})`);
      
      const position = new vscode.Position(line, 0);
      const selection = new vscode.Selection(position, position);
      
      // 只查找当前文档的可见编辑器，不创建新的编辑器
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 只在现有编辑器中设置光标位置，绝对不聚焦
        targetEditor.selection = selection;
        targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        this.logger.debug(`[同步编辑器] 预览滚动同步成功到第${line + 1}行 (无聚焦)`);
      } else {
        // 如果没有可见的编辑器，则不进行同步，避免创建新窗口
        this.logger.debug(`[同步编辑器] 没有找到可见的编辑器，跳过预览滚动同步`);
      }
    } catch (error) {
      this.logger.error('预览滚动同步失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 更新活动文档
   * @param document 文档对象
   */
  public updateActiveDocument(document: vscode.TextDocument): void {
    if (this.currentDocument?.uri.toString() !== document.uri.toString()) {
      this.currentDocument = document;
      this.updateContent();
    }
  }

  /**
   * 检查是否是当前文档
   * @param document 文档对象
   * @returns 是否是当前文档
   */
  public isCurrentDocument(document: vscode.TextDocument): boolean {
    return this.currentDocument?.uri.toString() === document.uri.toString();
  }

  /**
   * 关闭指定文档的预览
   * @param uri 文档URI
   */
  public closePreviewForDocument(uri: vscode.Uri): void {
    if (this.currentDocument?.uri.toString() === uri.toString()) {
      this.panel?.dispose();
      this.panel = undefined;
      this.currentDocument = undefined;
    }
  }

  /**
   * 切换调试工具
   */
  public toggleDebugTools(): void {
    this.debugToolsVisible = !this.debugToolsVisible;
    if (this.panel) {
      this.updateContent();
    }
  }

  /**
   * 配置变更处理
   */
  public onConfigurationChanged(): void {
    if (this.panel) {
      this.updateContent();
    }
  }

  /**
   * 检查面板是否可见
   * @returns 是否可见
   */
  public isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.panel = undefined;
    this.currentDocument = undefined;
    this.webviewReady = false;
  }
} 