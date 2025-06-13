/**
 * Markdown预览面板模块
 * 
 * MarkdownPreviewPanel是插件的核心预览组件，基于VSCode WebView API实现
 * 负责管理预览面板的生命周期、内容渲染和双向同步功能
 * 
 * 核心功能：
 * 1. WebView面板管理：创建、显示、隐藏和销毁预览面板
 * 2. 内容渲染：将Markdown转换为HTML并在WebView中显示
 * 3. 双向同步：编辑器与预览面板的光标和滚动位置同步
 * 4. 目录管理：自动生成目录并支持导航
 * 5. 主题支持：支持多种预览主题和自定义样式
 * 6. 调试工具：提供开发者调试和问题排查功能
 * 
 * 同步机制原理：
 * 编辑器 → 预览：通过行号映射和postMessage通信
 * 预览 → 编辑器：通过IntersectionObserver监听和VSCode API
 * 
 * WebView通信协议：
 * - 'ready': WebView加载完成通知
 * - 'update-content': 更新预览内容
 * - 'sync-cursor': 同步光标位置
 * - 'click': 处理点击事件
 * - 'scroll': 处理滚动事件  
 * - 'toc-click': 目录点击导航
 * 
 * @author hmslsky
 * @version 1.0.2
 * @since 0.0.1
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
 * 采用单例模式管理VSCode WebView预览面板，提供完整的Markdown预览功能
 * 
 * 设计特点：
 * - 单例模式：确保全局只有一个预览面板实例
 * - 异步加载：支持大文档的异步渲染和加载
 * - 状态管理：维护面板状态和文档关联关系
 * - 事件驱动：基于WebView消息机制实现前后端通信
 * - 资源管理：自动管理WebView资源和生命周期
 * 
 * 同步机制详解：
 * 1. 行号标记：使用data-source-line属性标记HTML元素对应的Markdown行号
 * 2. 光标同步：监听编辑器光标变化，通过行号匹配同步到预览位置
 * 3. 滚动同步：使用IntersectionObserver检测可视区域变化
 * 4. 防抖优化：避免频繁同步操作，提升性能和用户体验
 */
export class MarkdownPreviewPanel {
  /** 单例实例引用 */
  private static instance: MarkdownPreviewPanel;
  
  /** VSCode WebView面板实例，承载预览内容 */
  private panel: vscode.WebviewPanel | undefined;
  
  /** 当前正在预览的Markdown文档 */
  private currentDocument: vscode.TextDocument | undefined;
  
  /** Markdown处理器实例，负责内容转换 */
  private markdownProcessor: MarkdownProcessor;
  
  /** 目录提供器实例，负责目录生成和管理 */
  private tocProvider: TocProvider;
  
  /** 配置管理器实例，提供配置访问 */
  private configManager: ConfigurationManager;
  
  /** 日志记录器实例 */
  private logger: typeof Logger;
  
  /** 可释放资源数组，确保正确清理 */
  private disposables: vscode.Disposable[] = [];
  
  /** 调试工具显示状态 */
  private debugToolsVisible: boolean = false;
  
  /** WebView就绪状态标志，防止重复内容更新 */
  private webviewReady: boolean = false;

  /**
   * 私有构造函数
   * 
   * 单例模式实现，初始化所有依赖的服务实例
   * 不在构造函数中创建WebView，采用懒加载策略
   */
  private constructor() {
    this.markdownProcessor = MarkdownProcessor.getInstance();
    this.tocProvider = new TocProvider();
    this.configManager = ConfigurationManager.getInstance();
    this.logger = Logger;
  }

  /**
   * 获取预览面板实例
   * 
   * 单例模式的访问点，确保全局只有一个预览面板实例
   * 
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
   * 
   * 创建或显示Markdown预览面板，这是预览功能的主入口
   * 
   * 显示流程：
   * 1. 检查并创建WebView面板
   * 2. 设置当前预览文档
   * 3. 渲染Markdown内容
   * 4. 显示面板到指定位置
   * 
   * @param document 要预览的Markdown文档
   * @param viewColumn 面板显示位置（当前窗口或侧边）
   * @throws {Error} 当面板创建或内容渲染失败时抛出错误
   */
  public async show(document: vscode.TextDocument, viewColumn?: vscode.ViewColumn): Promise<void> {
    this.logger.info(`显示预览面板: ${path.basename(document.fileName)}`);
    
    try {
      // 步骤1: 确保面板存在
      if (!this.panel) {
        await this.createPanel(viewColumn);
      }

      // 步骤2: 更新当前预览文档
      this.currentDocument = document;

      // 步骤3: 渲染并更新内容
      await this.updateContent();

      // 步骤4: 显示面板到指定位置
      this.panel!.reveal(viewColumn);

    } catch (error) {
      this.logger.error('显示预览面板失败' + (error instanceof Error ? (' ' + error.message) : ''));
      throw error;
    }
  }

  /**
   * 创建WebView面板
   * 
   * 创建新的VSCode WebView面板并配置基本属性
   * 
   * 配置说明：
   * - enableScripts: 允许JavaScript执行，支持Mermaid和交互功能
   * - retainContextWhenHidden: 保持WebView状态，提升性能
   * - localResourceRoots: 限制资源访问范围，确保安全性
   * 
   * @param viewColumn 面板显示位置
   */
  private async createPanel(viewColumn?: vscode.ViewColumn): Promise<void> {
    const config = this.configManager.getPreviewConfig();
    // 根据配置或参数确定显示位置
    const column = viewColumn || (config.defaultView === 'side' ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);

    // 创建WebView面板
    this.panel = vscode.window.createWebviewPanel(
      'markdownPreview',
      'Markdown预览',
      column,
      {
        // 允许执行JavaScript脚本
        enableScripts: true,
        // 面板隐藏时保持上下文，避免重新加载
        retainContextWhenHidden: true,
        // 限制本地资源访问路径，确保安全性
        localResourceRoots: [
          vscode.Uri.file(path.join(__dirname, '..', '..', 'media')),
          vscode.Uri.file(path.join(__dirname, '..', '..', 'node_modules'))
        ]
      }
    );

    // 设置面板图标（支持明暗主题）
    this.panel.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, '..', '..', 'images', 'icon-light.svg')),
      dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'images', 'icon-dark.svg'))
    };

    // 设置事件监听器
    this.setupEventListeners();

    this.logger.info('Webview面板已创建');
  }

  /**
   * 设置WebView事件监听器
   * 
   * 配置面板生命周期事件和WebView消息处理
   * 
   * 监听的事件：
   * 1. onDidDispose: 面板关闭时的清理操作
   * 2. onDidChangeViewState: 面板可见性变化
   * 3. onDidReceiveMessage: WebView发送的消息处理
   */
  private setupEventListeners(): void {
    if (!this.panel) return;

    // 监听面板关闭事件
    this.panel.onDidDispose(() => {
      this.logger.info('预览面板已关闭');
      this.dispose();
    }, null, this.disposables);

    // 监听面板可见性变化事件
    this.panel.onDidChangeViewState(e => {
      this.logger.debug(`面板可见性变化: ${e.webviewPanel.visible}`);
    }, null, this.disposables);

    // 监听WebView消息
    this.panel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * 处理来自WebView的消息
   * 
   * WebView通信的核心处理函数，实现前后端交互
   * 采用消息类型分发机制，支持扩展新的消息类型
   * 
   * 支持的消息类型：
   * - ready: WebView加载完成
   * - click: 预览内容点击事件
   * - scroll: 预览滚动事件
   * - toc-click: 目录点击导航
   * - sync-cursor: 预览到编辑器的光标同步
   * - toc-toggle: 目录折叠/展开
   * - toc-expand-to-level: 目录分级展开
   * - debug-info: 调试信息请求
   * 
   * @param message WebView发送的消息对象
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    this.logger.debug(`收到Webview消息: ${message.type}`);
    
    switch (message.type) {
      case 'ready':
        // WebView就绪通知
        // 确保只在首次就绪时更新内容，避免重复渲染
        this.logger.debug('[Webview] 预览面板就绪');
        if (!this.webviewReady) {
          this.webviewReady = true;
          await this.updateContent();
        }
        break;
        
      case 'click':
        // 处理预览内容点击事件
        this.logger.debug('[Webview] 处理点击事件');
        await this.handleClick(message);
        break;
        
      case 'scroll':
        // 处理预览滚动事件，实现预览到编辑器的同步
        this.logger.debug(`[Webview] 处理滚动事件: 第${message.line + 1}行`);
        await this.syncEditorToLine(message.line);
        this.handleScroll(message);
        break;
        
      case 'toc-click':
        // 处理目录点击事件，实现目录导航
        this.logger.debug(`[Webview] 处理目录点击: 第${message.line + 1}行`);
        await this.handleTocClick(message);
        break;
        
      case 'sync-cursor':
        // 处理预览到编辑器的光标同步
        this.logger.debug(`[Webview] 预览同步到编辑器: 第${message.line + 1}行`);
        await this.syncEditorToLineWithoutFocus(message.line);
        break;
        
      case 'toc-toggle':
        // 处理目录项的折叠/展开
        this.logger.debug('[Webview] 处理目录折叠/展开');
        this.handleTocToggle(message);
        break;
        
      case 'toc-expand-to-level':
        // 处理目录的分级展开
        this.logger.debug(`[Webview] 处理目录分级展开: 第${message.level}级`);
        this.handleTocExpandToLevel(message);
        break;
        
      case 'debug-info':
        // 处理调试信息请求
        this.logger.debug('[Webview] 处理调试信息请求');
        this.handleDebugInfo(message);
        break;
        
      default:
        this.logger.warn(`未知的消息类型: ${message.type}`);
    }
  }

  /**
   * 更新预览内容
   * 
   * 将Markdown文档转换为HTML并更新到WebView中
   * 支持增量更新和全量更新两种模式
   * 
   * 更新策略：
   * 1. 首次加载：设置完整的HTML内容
   * 2. 增量更新：只发送内容数据，由前端更新
   * 
   * 内容生成流程：
   * 1. 获取Markdown文档内容
   * 2. 通过MarkdownProcessor转换为HTML
   * 3. 通过TocProvider生成目录结构
   * 4. 更新WebView内容或发送更新消息
   */
  public async updateContent(): Promise<void> {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    try {
      // 获取Markdown源码
      const content = this.currentDocument.getText();
      
      // 转换为HTML（包含行号标记）
      const html = this.markdownProcessor.convertToHtml(content);
      
      // 生成目录结构
      const toc = this.tocProvider.generateToc(this.currentDocument);

      if (!this.webviewReady) {
        // 首次加载：设置完整的WebView HTML内容
        const webviewHtml = this.getWebviewContent(html, toc);
        this.panel.webview.html = webviewHtml;
        this.panel.title = `Markdown Preview: ${path.basename(this.currentDocument.fileName)}`;
      } else {
        // 增量更新：发送内容更新消息到前端
        this.panel.webview.postMessage({ type: 'update-content', html, toc: this.tocProvider.renderToc(toc) });
      }
      
      this.logger.debug('预览内容已更新');
    } catch (error) {
      this.logger.error('更新预览内容失败' + (error instanceof Error ? (' ' + error.message) : ''));
      // 显示错误页面
      this.panel.webview.html = this.getErrorContent(error as Error);
    }
  }

  /**
   * 生成WebView HTML内容
   * 
   * 构建完整的HTML页面，包含样式、脚本和内容
   * 
   * HTML结构：
   * 1. 头部：CSS样式和安全策略
   * 2. 配置：传递插件配置到前端
   * 3. 脚本：Mermaid和预览交互脚本
   * 4. 内容：目录和Markdown内容
   * 5. 调试：可选的调试工具面板
   * 
   * 安全考虑：
   * - 使用CSP限制资源加载
   * - 使用nonce确保脚本安全
   * - 限制外部资源访问
   * 
   * @param html 转换后的Markdown HTML内容
   * @param toc 目录结构数据
   * @returns 完整的WebView HTML内容
   */
  private getWebviewContent(html: string, toc: any[]): string {
    const config = this.configManager.getConfig();
    const nonce = this.generateNonce();

    // 获取资源URI（确保安全访问）
    const styleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'preview.css'))
    );
    
    const tocStyleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'toc.css'))
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
    <!-- GitHub官方Markdown样式 - 通过JavaScript控制 -->
    <link rel="stylesheet" href="${githubLightUri}" id="github-light-theme">
    <link rel="stylesheet" href="${githubDarkUri}" id="github-dark-theme" disabled>
    <!-- 自定义布局和目录样式 -->
    <link rel="stylesheet" href="${styleUri}">
    <link rel="stylesheet" href="${tocStyleUri}">
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
   * 渲染调试工具面板
   * 
   * 生成调试工具的HTML内容，显示当前文档信息
   * 
   * @returns 调试工具HTML字符串
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
   * 
   * 生成目录的HTML结构，包含控制按钮和目录内容
   * 
   * @param toc 目录结构数据
   * @returns 目录容器HTML字符串
   */
  private renderTocContainer(toc: any[]): string {
    const config = this.configManager.getTocConfig();
    
    return `
      <div class="toc-header">
        <h3>TOC</h3>
        <div class="toc-controls">
          <button class="toc-toggle-visibility" title="隐藏/显示目录">
            <span class="toc-visibility-icon">👁️</span>
          </button>
          <button class="toc-collapse-all" title="折叠所有">-</button>
          <button class="toc-expand-all" title="展开所有">+</button>
        </div>
      </div>
      <div class="toc-content">
        ${this.tocProvider.renderToc(toc)}
      </div>
    `;
  }

  /**
   * 生成错误页面内容
   * 
   * 当内容渲染失败时显示友好的错误页面
   * 
   * @param error 错误对象
   * @returns 错误页面HTML内容
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
   * 
   * 为CSP生成随机nonce，确保脚本执行安全
   * 
   * @returns 32位随机nonce字符串
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
   * 处理预览内容点击事件
   * 
   * 预留的点击事件处理方法，可扩展实现点击跳转等功能
   * 
   * @param _message 点击事件消息对象
   */
  private async handleClick(_message: any): Promise<void> {
    // 处理点击事件的具体逻辑
    // 可以实现点击跳转到编辑器对应位置等功能
  }

  /**
   * 处理预览滚动事件
   * 
   * 预留的滚动事件处理方法，可扩展实现滚动状态管理
   * 
   * @param _message 滚动事件消息对象
   */
  private handleScroll(_message: any): void {
    // 处理滚动事件的具体逻辑
    // 可以实现滚动位置记忆等功能
  }

  /**
   * 处理目录点击事件
   * 
   * 实现目录导航功能，点击目录项跳转到对应的编辑器位置
   * 
   * 跳转策略：
   * 1. 如果是静默模式，只同步编辑器位置，不抢夺焦点
   * 2. 查找当前文档的可见编辑器
   * 3. 优先在现有编辑器中设置光标
   * 4. 如无可见编辑器则创建新的编辑器
   * 5. 使用preserveFocus避免抢夺焦点
   * 
   * @param message 目录点击消息，包含目标行号和静默标志
   */
  private async handleTocClick(message: any): Promise<void> {
    if (!this.currentDocument) return;

    try {
      const position = new vscode.Position(message.line, 0);
      const selection = new vscode.Selection(position, position);
      const isSilent = message.silent === true;
      
      // 查找当前文档的编辑器
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 直接在现有编辑器中设置光标位置
        targetEditor.selection = selection;
        
        if (isSilent) {
          // 静默模式：只滚动到位置，不抢夺焦点
          targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
          this.logger.debug(`静默同步编辑器到第 ${message.line + 1} 行`);
        } else {
          // 普通模式：滚动并可能抢夺焦点
          targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
          this.logger.debug(`跳转到编辑器第 ${message.line + 1} 行`);
        }
      } else {
        // 使用preserveFocus选项避免聚焦
        const editor = await vscode.window.showTextDocument(
          this.currentDocument,
          { 
            preserveFocus: isSilent, // 静默模式下保持焦点
            preview: false
          }
        );
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        
        this.logger.debug(`${isSilent ? '静默' : ''}打开编辑器并跳转到第 ${message.line + 1} 行`);
      }
    } catch (error) {
      this.logger.error('处理目录点击事件失败' + (error instanceof Error ? (' ' + error.message) : ''));
    }
  }

  /**
   * 处理目录折叠/展开事件
   * 
   * 预留的目录状态管理方法
   * 
   * @param _message 目录状态变更消息
   */
  private handleTocToggle(_message: any): void {
    // 处理目录折叠/展开事件的具体逻辑
    // 可以实现目录状态的持久化存储
  }

  /**
   * 处理目录分级展开事件
   * 
   * 处理目录的分级展开功能，支持展开到指定级别
   * 
   * @param message 分级展开消息，包含目标展开级别
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
   * 
   * 预留的调试信息处理方法
   * 
   * @param _message 调试信息请求消息
   */
  private handleDebugInfo(_message: any): void {
    // 处理调试信息请求的具体逻辑
    // 可以返回插件状态、性能数据等调试信息
  }

  /**
   * 同步光标位置到预览面板
   * 
   * 编辑器到预览的同步核心方法
   * 
   * 同步机制：
   * 1. 将编辑器光标位置（行号）发送到WebView
   * 2. WebView根据data-source-line属性找到对应HTML元素
   * 3. 执行滚动到可视区域的操作
   * 
   * @param position 编辑器光标位置
   */
  public syncCursorPosition(position: vscode.Position): void {
    if (!this.panel) return;
    
    // 无论预览面板是否可见都进行同步，确保实时性
    this.logger.debug(`[光标同步] 编辑器同步到预览: 第${position.line + 1}行`);
    this.panel.webview.postMessage({
      type: 'sync-cursor',
      line: position.line,
    });
  }

  /**
   * 同步编辑器到指定行（带焦点）
   * 
   * 预览到编辑器的同步方法，会抢夺编辑器焦点
   * 适用于用户主动操作（如目录点击）的场景
   * 
   * @param line 目标行号（0基索引）
   */
  private async syncEditorToLine(line: number): Promise<void> {
    if (!this.currentDocument) {
      this.logger.warn('[同步编辑器] 当前没有文档');
      return;
    }
    
    try {
      this.logger.debug(`[同步编辑器] 尝试同步到第${line + 1}行 (0基索引: ${line})`);
      
      const position = new vscode.Position(line, 0);
      const selection = new vscode.Selection(position, position);
      
      // 查找对应的编辑器
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 在现有编辑器中设置光标并聚焦
        targetEditor.selection = selection;
        targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        // 显示编辑器（抢夺焦点）
        await vscode.window.showTextDocument(this.currentDocument, { selection });
      } else {
        // 打开新的编辑器
        const editor = await vscode.window.showTextDocument(this.currentDocument);
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
      
      this.logger.debug(`[同步编辑器] 成功同步到第${line + 1}行`);
    } catch (error) {
      this.logger.error('[同步编辑器] 同步失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 同步编辑器到指定行（不抢夺焦点）
   * 
   * 预览到编辑器的同步方法，不会抢夺编辑器焦点
   * 适用于自动同步场景，避免干扰用户操作
   * 
   * @param line 目标行号（0基索引）
   */
  private async syncEditorToLineWithoutFocus(line: number): Promise<void> {
    if (!this.currentDocument) {
      this.logger.warn('[同步编辑器] 当前没有文档');
      return;
    }
    
    try {
      this.logger.debug(`[同步编辑器无焦点] 尝试同步到第${line + 1}行`);
      
      const position = new vscode.Position(line, 0);
      const selection = new vscode.Selection(position, position);
      
      // 查找对应的编辑器
      const editors = vscode.window.visibleTextEditors;
      const targetEditor = editors.find(editor => 
        editor.document.uri.toString() === this.currentDocument!.uri.toString()
      );
      
      if (targetEditor) {
        // 在现有编辑器中设置光标但不聚焦
        targetEditor.selection = selection;
        targetEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
      
      this.logger.debug(`[同步编辑器无焦点] 成功同步到第${line + 1}行`);
    } catch (error) {
      this.logger.error('[同步编辑器无焦点] 同步失败: ' + (error instanceof Error ? error.message : String(error)));
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