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
    this.logger.debug('收到Webview消息');
    switch (message.type) {
      case 'ready':
        if (!this.webviewReady) {
          this.webviewReady = true;
          await this.updateContent();
        }
        break;
      case 'click':
        await this.handleClick(message);
        break;
      case 'scroll':
        this.logger.debug(`[光标同步] 预览同步到编辑器: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        this.handleScroll(message);
        break;
      case 'toc-click':
        this.logger.debug(`[光标同步] 预览同步到编辑器: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        await this.handleTocClick(message);
        break;
      case 'sync-cursor':
        this.logger.debug(`[光标同步] 预览同步到编辑器: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        break;
      case 'toc-toggle':
        this.handleTocToggle(message);
        break;
      case 'debug-info':
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
    <link rel="stylesheet" href="${styleUri}">
    <script nonce="${nonce}" src="${mermaidUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</head>
<body>
    <div class="container">
        <div class="toc-container">
            ${this.renderTocContainer(toc)}
        </div>
        <div class="content-container">
            ${html}
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
        ${config.showToggleButton ? '<button class="toc-toggle">折叠/展开</button>' : ''}
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
      
      const editor = await vscode.window.showTextDocument(this.currentDocument);
      editor.selection = selection;
      editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
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
      character: position.character
    });
  }

  private async syncEditorToLine(line: number): Promise<void> {
    if (!this.currentDocument) return;
    try {
      const position = new vscode.Position(line, 0);
      const selection = new vscode.Selection(position, position);
      const editor = await vscode.window.showTextDocument(this.currentDocument);
      editor.selection = selection;
      editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      this.logger.error('同步编辑器光标失败: ' + (error instanceof Error ? error.message : String(error)));
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