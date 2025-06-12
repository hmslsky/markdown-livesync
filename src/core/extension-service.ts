/**
 * 插件核心模块
 * 
 * 负责插件的生命周期管理、命令注册和事件处理
 * 这是重构后的新架构入口点，替代了原有的浏览器集成方式
 * 
 * @author hmslsky
 * @version 1.0.0
 */

import * as vscode from 'vscode';
import { MarkdownPreviewPanel } from '../preview/markdown-preview-panel';
import { ConfigurationManager } from '../config/config-manager';
import { Logger } from '../utils/logger-util';

/**
 * 插件核心类
 * 
 * 管理插件的整个生命周期，包括激活、命令注册、事件监听和资源清理
 */
export class Extension {
  private static instance: Extension;
  private context: vscode.ExtensionContext;
  private configManager: ConfigurationManager;
  private logger: Logger;
  private disposables: vscode.Disposable[] = [];

  /**
   * 构造函数
   * @param context VSCode扩展上下文
   */
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.configManager = ConfigurationManager.getInstance();
    this.logger = Logger;
  }

  /**
   * 获取插件实例（单例模式）
   * @param context VSCode扩展上下文
   * @returns Extension实例
   */
  public static getInstance(context?: vscode.ExtensionContext): Extension {
    if (!Extension.instance && context) {
      Extension.instance = new Extension(context);
    }
    return Extension.instance;
  }

  /**
   * 激活插件
   * 
   * 注册所有命令、事件监听器和配置监听器
   */
  public async activate(): Promise<void> {
    Logger.info('Markdown LiveSync 插件正在激活...');
    console.log('Extension.activate() 开始执行...');

    try {
      console.log('开始注册命令...');
      // 注册命令
      this.registerCommands();
      console.log('命令注册完成');

      console.log('开始注册事件监听器...');
      // 注册事件监听器
      this.registerEventListeners();
      console.log('事件监听器注册完成');

      console.log('开始注册配置监听器...');
      // 注册配置变更监听器
      this.registerConfigurationListeners();
      console.log('配置监听器注册完成');

      Logger.info('Markdown LiveSync 插件激活成功');
      console.log('Extension.activate() 执行完成');
    } catch (error) {
      const errorMsg = '插件激活失败: ' + (error instanceof Error ? error.message : String(error));
      Logger.error(errorMsg);
      console.error('Extension.activate() 失败:', error);
      throw error;
    }
  }

  /**
   * 注册所有命令
   */
  private registerCommands(): void {
    console.log('registerCommands() 开始执行...');
    
    try {
      console.log('注册 openPreview 命令...');
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

      console.log('注册 openPreviewToSide 命令...');
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

      console.log('注册 toggleDebugTools 命令...');
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

      console.log('将命令添加到订阅列表...');
      // 添加到订阅列表
      this.disposables.push(
        openPreviewCommand,
        openPreviewToSideCommand,
        toggleDebugToolsCommand
      );

      console.log('将命令添加到上下文订阅...');
      this.context.subscriptions.push(...this.disposables);
      
      Logger.info('命令注册完成');
      console.log('registerCommands() 执行完成');
    } catch (error) {
      const errorMsg = '命令注册失败: ' + (error instanceof Error ? error.message : String(error));
      Logger.error(errorMsg);
      console.error('registerCommands() 失败:', error);
      throw error;
    }
  }

  /**
   * 注册事件监听器
   */
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

    // 防抖变量
    let syncTimeout: NodeJS.Timeout | undefined;
    let lastSyncTime = 0;
    const SYNC_DEBOUNCE_DELAY = 50; // 50ms防抖
    const MIN_SYNC_INTERVAL = 100; // 最小同步间隔100ms

    // 监听光标位置变更事件（优先级高，立即同步）
    const onSelectionChange = vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isCurrentDocument(event.textEditor.document)) {
          const position = event.selections[0].active;
          Logger.debug(`[光标监听] 编辑器光标变化: 第${position.line + 1}行 第${position.character + 1}列`);
          
          // 立即同步光标位置，无论预览面板是否可见
          const now = Date.now();
          if (now - lastSyncTime > MIN_SYNC_INTERVAL) {
            lastSyncTime = now;
            panel.syncCursorPosition(position);
          }
        }
      }
    });

    // 监听可见范围变更事件（滚动，使用防抖）
    const onVisibleRangeChange = vscode.window.onDidChangeTextEditorVisibleRanges(event => {
      if (event.textEditor.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isCurrentDocument(event.textEditor.document)) {
          // 清除之前的防抖定时器
          if (syncTimeout) {
            clearTimeout(syncTimeout);
          }
          
          // 使用防抖避免频繁触发
          syncTimeout = setTimeout(() => {
            const firstVisibleLine = event.visibleRanges[0];
            if (firstVisibleLine) {
              const middleLine = Math.floor((firstVisibleLine.start.line + firstVisibleLine.end.line) / 2);
              const position = new vscode.Position(middleLine, 0);
              Logger.debug(`[滚动监听] 编辑器滚动: 可见范围第${middleLine + 1}行`);
              
              const now = Date.now();
              if (now - lastSyncTime > MIN_SYNC_INTERVAL) {
                lastSyncTime = now;
                panel.syncCursorPosition(position);
              }
            }
          }, SYNC_DEBOUNCE_DELAY);
        }
      }
    });

    this.disposables.push(
      onDocumentClose,
      onActiveEditorChange,
      onDocumentChange,
      onSelectionChange,
      onVisibleRangeChange
    );

    Logger.info('事件监听器注册完成');
  }

  /**
   * 注册配置变更监听器
   */
  private registerConfigurationListeners(): void {
    const onConfigChange = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('markdown-livesync')) {
        this.configManager.reloadConfiguration();
        
        // 通知预览面板配置已更改
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isVisible()) {
          panel.onConfigurationChanged();
        }
      }
    });

    this.disposables.push(onConfigChange);
    Logger.info('配置监听器注册完成');
  }

  /**
   * 打开预览
   */
  private async openPreview(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个Markdown文件');
      return;
    }

    try {
      const panel = MarkdownPreviewPanel.getInstance();
      await panel.show(activeEditor.document, vscode.ViewColumn.Active);
      Logger.info('预览已打开');
    } catch (error) {
      Logger.error('打开预览失败: ' + (error instanceof Error ? error.message : String(error)));
      vscode.window.showErrorMessage('打开预览失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 在侧边打开预览
   */
  private async openPreviewToSide(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个Markdown文件');
      return;
    }

    try {
      const panel = MarkdownPreviewPanel.getInstance();
      await panel.show(activeEditor.document, vscode.ViewColumn.Beside);
      Logger.info('侧边预览已打开');
    } catch (error) {
      Logger.error('打开侧边预览失败: ' + (error instanceof Error ? error.message : String(error)));
      vscode.window.showErrorMessage('打开侧边预览失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 切换调试工具
   */
  private toggleDebugTools(): void {
    const panel = MarkdownPreviewPanel.getInstance();
    if (panel.isVisible()) {
      panel.toggleDebugTools();
    }
  }

  /**
   * 停用插件
   */
  public deactivate(): void {
    Logger.info('Markdown LiveSync 插件正在停用...');

    // 清理所有资源
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];

    Logger.info('Markdown LiveSync 插件已停用');
  }

  /**
   * 获取扩展上下文
   */
  public getContext(): vscode.ExtensionContext {
    return this.context;
  }
} 