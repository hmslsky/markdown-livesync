/**
 * 插件核心服务模块
 * 
 * Extension类是整个插件的核心控制器，采用单例模式管理插件的完整生命周期
 * 负责命令注册、事件监听、资源管理和业务逻辑协调
 * 
 * 核心职责：
 * 1. 生命周期管理：处理插件的激活、运行和停用过程
 * 2. 命令注册：注册所有VSCode命令，包括预览打开、调试工具等
 * 3. 事件监听：监听文档变化、光标移动、滚动等编辑器事件
 * 4. 业务协调：协调各个模块间的交互，如预览面板、配置管理等
 * 5. 资源清理：确保插件停用时正确释放所有资源
 * 
 * 架构设计：
 * - 单例模式：确保全局只有一个Extension实例
 * - 事件驱动：基于VSCode事件API实现响应式架构
 * - 模块化：将不同功能分离到独立的服务模块中
 * - 配置化：支持运行时配置变更和热重载
 * 
 * @author hmslsky
 * @version 1.0.0
 * @since 0.0.1
 */

import * as vscode from 'vscode';
import { MarkdownPreviewPanel } from '../preview/markdown-preview-panel';
import { ConfigurationManager } from '../config/config-manager';
import { Logger } from '../utils/logger-util';

/**
 * 插件核心服务类
 * 
 * 这是插件的主控制器，管理所有核心功能和服务的协调
 * 采用单例模式确保系统中只有一个控制器实例
 * 
 * 设计模式：
 * - 单例模式：确保全局唯一实例
 * - 发布订阅模式：通过VSCode事件系统实现模块间通信
 * - 策略模式：支持不同的预览策略和同步机制
 * 
 * 生命周期：
 * 1. 构造阶段：初始化基础服务引用
 * 2. 激活阶段：注册命令和事件监听器
 * 3. 运行阶段：响应用户操作和编辑器事件
 * 4. 停用阶段：清理资源和取消监听器
 */
export class Extension {
  /** 单例实例引用 */
  private static instance: Extension;
  
  /** VSCode扩展上下文，包含扩展元数据和API访问权限 */
  private context: vscode.ExtensionContext;
  
  /** 配置管理器实例，负责管理所有插件配置 */
  private configManager: ConfigurationManager;
  
  /** 日志记录器实例，用于调试和错误追踪 */
  private logger: Logger;
  
  /** 可释放资源数组，确保停用时正确清理 */
  private disposables: vscode.Disposable[] = [];

  /**
   * 私有构造函数
   * 
   * 单例模式的关键实现，防止外部直接实例化
   * 初始化所有必要的服务引用和基础配置
   * 
   * @param context VSCode扩展上下文，提供扩展运行环境
   */
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.configManager = ConfigurationManager.getInstance();
    this.logger = Logger;
  }

  /**
   * 获取插件实例
   * 
   * 单例模式的访问点，确保全局只有一个Extension实例
   * 首次调用时创建实例，后续调用返回同一实例
   * 
   * @param context VSCode扩展上下文（仅首次调用时需要）
   * @returns Extension实例
   * @throws {Error} 当context为undefined且实例未创建时
   */
  public static getInstance(context?: vscode.ExtensionContext): Extension {
    if (!Extension.instance && context) {
      Extension.instance = new Extension(context);
    }
    return Extension.instance;
  }

  /**
   * 激活插件核心服务
   * 
   * 插件激活的核心流程，负责初始化所有功能模块
   * 按顺序执行初始化任务，确保依赖关系正确建立
   * 
   * 激活步骤：
   * 1. 注册VSCode命令（预览、调试等）
   * 2. 设置文档和编辑器事件监听器
   * 3. 监听配置变更，支持热重载
   * 
   * @throws {Error} 当任何初始化步骤失败时抛出错误
   */
  public async activate(): Promise<void> {
    Logger.info('Markdown LiveSync 插件正在激活...');

    try {
      // 步骤1: 注册所有VSCode命令
      // 包括预览打开、侧边预览、调试工具等用户可调用的命令
      this.registerCommands();

      // 步骤2: 注册编辑器事件监听器
      // 监听文档变化、光标移动、滚动等事件以实现实时同步
      this.registerEventListeners();

      // 步骤3: 注册配置变更监听器
      // 支持用户配置的热重载，无需重启插件
      this.registerConfigurationListeners();

      Logger.info('Markdown LiveSync 插件激活成功');
    } catch (error) {
      Logger.error('Markdown LiveSync 插件激活失败', error as Error);
      throw error;
    }
  }

  /**
   * 注册VSCode命令
   * 
   * 将插件提供的功能注册为VSCode命令，用户可通过命令面板或快捷键调用
   * 所有命令都会被添加到disposables数组中，确保停用时正确清理
   * 
   * 注册的命令：
   * 1. markdown-livesync.openPreview - 在当前窗口打开预览
   * 2. markdown-livesync.openPreviewToSide - 在侧边打开预览
   * 3. markdown-livesync.toggleDebugTools - 切换调试工具显示
   * 
   * 错误处理：
   * 每个命令都包装在try-catch中，避免单个命令错误影响其他功能
   */
  private registerCommands(): void {
    try {
      // 注册主预览命令
      // 在当前编辑器窗口中打开Markdown预览面板
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

      // 注册侧边预览命令
      // 在编辑器侧边打开Markdown预览面板，便于并排查看
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

      // 注册调试工具切换命令
      // 显示或隐藏调试工具面板，帮助开发者调试和排查问题
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

      // 添加到资源清理列表
      this.disposables.push(
        openPreviewCommand,
        openPreviewToSideCommand,
        toggleDebugToolsCommand
      );

      // 注册到VSCode上下文中，确保插件停用时自动清理
      this.context.subscriptions.push(...this.disposables);
      
      Logger.info('命令注册完成');
    } catch (error) {
      const errorMsg = '命令注册失败: ' + (error instanceof Error ? error.message : String(error));
      Logger.error(errorMsg);
      throw error;
    }
  }

  /**
   * 注册编辑器事件监听器
   * 
   * 设置各种编辑器事件的监听器，实现编辑器与预览面板的实时同步
   * 采用防抖机制优化性能，避免频繁的同步操作
   * 
   * 监听的事件：
   * 1. 文档关闭 - 自动关闭对应的预览面板
   * 2. 活动编辑器变更 - 切换预览面板显示的文档
   * 3. 文档内容变更 - 实时更新预览内容
   * 4. 光标位置变更 - 同步光标位置到预览面板
   * 5. 可见范围变更 - 同步滚动位置
   * 
   * 性能优化：
   * - 使用防抖机制减少频繁操作
   * - 设置最小同步间隔避免性能问题
   * - 只在Markdown文档中启用同步功能
   */
  private registerEventListeners(): void {
    // 监听文档关闭事件
    // 当Markdown文档被关闭时，自动关闭对应的预览面板
    const onDocumentClose = vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.languageId === 'markdown') {
        MarkdownPreviewPanel.getInstance().closePreviewForDocument(doc.uri);
      }
    });

    // 监听活动编辑器变更事件
    // 当用户切换到不同的编辑器标签时，更新预览面板显示的内容
    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isVisible()) {
          panel.updateActiveDocument(editor.document);
        }
      }
    });

    // 监听文档内容变更事件
    // 当Markdown文档内容发生变化时，实时更新预览内容
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isVisible() && panel.isCurrentDocument(event.document)) {
          panel.updateContent();
        }
      }
    });

    // 防抖和节流变量
    // 防止过于频繁的同步操作，提升性能和用户体验
    let syncTimeout: NodeJS.Timeout | undefined;
    let lastSyncTime = 0;
    const SYNC_DEBOUNCE_DELAY = 50; // 50ms防抖延迟
    const MIN_SYNC_INTERVAL = 100; // 最小同步间隔100ms

    // 监听光标位置变更事件（高优先级，立即同步）
    // 当用户移动光标时，立即同步到预览面板，实现精确的光标跟踪
    const onSelectionChange = vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isCurrentDocument(event.textEditor.document)) {
          // 检查是否正在从预览同步到编辑器，避免双向同步循环
          if (panel.isSyncingFromPreviewToEditor()) {
            Logger.debug('[光标监听] 跳过同步 - 正在从预览同步到编辑器');
            return;
          }
          
          const position = event.selections[0].active;
          Logger.debug(`[光标监听] 编辑器光标变化: 第${position.line + 1}行 第${position.character + 1}列`);
          
          // 立即同步光标位置，无论预览面板是否可见
          // 这确保了当用户稍后打开预览时能看到正确的位置
          const now = Date.now();
          if (now - lastSyncTime > MIN_SYNC_INTERVAL) {
            lastSyncTime = now;
            panel.syncCursorPosition(position);
          }
        }
      }
    });

    // 监听可见范围变更事件（滚动事件，使用防抖）
    // 当用户滚动编辑器时，同步滚动位置到预览面板
    const onVisibleRangeChange = vscode.window.onDidChangeTextEditorVisibleRanges(event => {
      if (event.textEditor.document.languageId === 'markdown') {
        const panel = MarkdownPreviewPanel.getInstance();
        if (panel.isCurrentDocument(event.textEditor.document)) {
          // 检查是否正在从预览同步到编辑器，避免双向同步循环
          if (panel.isSyncingFromPreviewToEditor()) {
            Logger.debug('[滚动监听] 跳过同步 - 正在从预览同步到编辑器');
            return;
          }
          
          // 清除之前的防抖定时器
          if (syncTimeout) {
            clearTimeout(syncTimeout);
          }
          
          // 使用防抖避免频繁触发
          // 滚动是连续性操作，防抖可以显著减少不必要的同步调用
          syncTimeout = setTimeout(() => {
            const firstVisibleLine = event.visibleRanges[0];
            if (firstVisibleLine) {
              // 计算可见范围的中间行作为同步目标
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

    // 将所有事件监听器添加到资源清理列表
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
   * 
   * 监听插件配置的变更，实现配置的热重载功能
   * 当用户修改配置时，无需重启插件即可应用新配置
   * 
   * 配置变更处理流程：
   * 1. 检测配置变更事件
   * 2. 重新加载配置管理器
   * 3. 通知预览面板应用新配置
   * 4. 记录配置变更日志
   */
  private registerConfigurationListeners(): void {
    const onConfigChange = vscode.workspace.onDidChangeConfiguration(event => {
      // 仅处理插件相关的配置变更
      if (event.affectsConfiguration('markdown-livesync')) {
        // 重新加载配置管理器中的配置
        this.configManager.reloadConfiguration();
        
        // 通知预览面板配置已更改
        // 预览面板会根据新配置调整显示效果和行为
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
   * 打开Markdown预览
   * 
   * 在当前窗口中打开Markdown预览面板
   * 验证当前编辑器是否为Markdown文档，然后创建或显示预览面板
   * 
   * 操作流程：
   * 1. 验证当前活动编辑器
   * 2. 检查文档类型是否为Markdown
   * 3. 获取预览面板实例
   * 4. 显示预览面板
   * 
   * @throws {Error} 当没有活动编辑器或文档类型不正确时
   */
  private async openPreview(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    
    // 验证是否有活动的Markdown编辑器
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个Markdown文件');
      return;
    }

    try {
      // 获取预览面板实例并显示
      const panel = MarkdownPreviewPanel.getInstance();
      await panel.show(activeEditor.document, vscode.ViewColumn.Active);
      Logger.info('预览已打开');
    } catch (error) {
      Logger.error('打开预览失败: ' + (error instanceof Error ? error.message : String(error)));
      vscode.window.showErrorMessage('打开预览失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 在侧边打开Markdown预览
   * 
   * 在编辑器侧边打开Markdown预览面板，方便用户并排查看编辑器和预览
   * 这是最常用的预览模式，提供最佳的编辑体验
   * 
   * @throws {Error} 当没有活动编辑器或文档类型不正确时
   */
  private async openPreviewToSide(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    
    // 验证是否有活动的Markdown编辑器
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('请先打开一个Markdown文件');
      return;
    }

    try {
      // 获取预览面板实例并在侧边显示
      const panel = MarkdownPreviewPanel.getInstance();
      await panel.show(activeEditor.document, vscode.ViewColumn.Beside);
      Logger.info('侧边预览已打开');
    } catch (error) {
      Logger.error('打开侧边预览失败: ' + (error instanceof Error ? error.message : String(error)));
      vscode.window.showErrorMessage('打开侧边预览失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 切换调试工具显示状态
   * 
   * 显示或隐藏调试工具面板，帮助开发者调试插件问题
   * 调试工具提供实时的状态信息和性能数据
   */
  private toggleDebugTools(): void {
    const panel = MarkdownPreviewPanel.getInstance();
    if (panel.isVisible()) {
      panel.toggleDebugTools();
    }
  }

  /**
   * 停用插件
   * 
   * 清理所有插件资源，确保没有内存泄漏
   * 包括取消事件监听器、关闭面板、清理定时器等
   * 
   * 清理流程：
   * 1. 记录停用开始日志
   * 2. 逐个释放所有disposable资源
   * 3. 清空资源数组
   * 4. 记录停用完成日志
   */
  public deactivate(): void {
    Logger.info('Markdown LiveSync 插件正在停用...');

    // 清理所有可释放的资源
    // 包括命令注册、事件监听器、定时器等
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];

    Logger.info('Markdown LiveSync 插件已停用');
  }

  /**
   * 获取VSCode扩展上下文
   * 
   * 提供对VSCode扩展上下文的访问，供其他模块使用
   * 上下文包含扩展的元数据、存储路径、订阅管理等重要信息
   * 
   * @returns vscode.ExtensionContext VSCode扩展上下文对象
   */
  public getContext(): vscode.ExtensionContext {
    return this.context;
  }
} 