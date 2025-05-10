import * as vscode from 'vscode';

/**
 * 日志记录工具类
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;

  /**
   * 初始化日志记录器
   */
  public static initialize(): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Markdown LiveSync');
    }
  }

  /**
   * 记录信息日志
   */
  public static info(message: string): void {
    this.ensureInitialized();
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[INFO ${timestamp}] ${message}`);
  }

  /**
   * 记录错误日志
   */
  public static error(message: string, error?: Error): void {
    this.ensureInitialized();
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[ERROR ${timestamp}] ${message}`);

    if (error) {
      this.outputChannel.appendLine(`${error.stack || error.message}`);
    }
  }

  /**
   * 记录警告日志
   */
  public static warn(message: string): void {
    this.ensureInitialized();
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[WARN ${timestamp}] ${message}`);
  }

  /**
   * 记录调试日志
   */
  public static debug(message: string): void {
    // 可以根据配置决定是否记录调试日志
    const config = vscode.workspace.getConfiguration('markdown-livesync');
    const enableDebug = config.get<boolean>('debug', false);

    if (enableDebug) {
      this.ensureInitialized();
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[DEBUG ${timestamp}] ${message}`);
    }
  }

  /**
   * 确保日志记录器已初始化
   */
  private static ensureInitialized(): void {
    if (!this.outputChannel) {
      this.initialize();
    }
  }

  /**
   * 显示日志面板
   */
  public static show(): void {
    this.ensureInitialized();
    this.outputChannel.show();
  }

  /**
   * 清除日志
   */
  public static clear(): void {
    this.ensureInitialized();
    this.outputChannel.clear();
  }

  /**
   * 释放资源
   */
  public static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }
  }
}
