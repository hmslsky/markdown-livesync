import * as vscode from 'vscode';

/**
 * 日志记录工具类
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel | undefined;
  private static isInitialized: boolean = false;

  /**
   * 初始化日志记录器
   */
  public static initialize(): void {
    try {
      if (!this.outputChannel) {
        this.outputChannel = vscode.window.createOutputChannel('Markdown LiveSync');
        this.isInitialized = true;
        console.log('Logger初始化成功');
      }
    } catch (error) {
      console.error('Logger初始化失败:', error);
      this.isInitialized = false;
    }
  }

  /**
   * 记录信息日志
   */
  public static info(message: string): void {
    try {
      this.ensureInitialized();
      const timestamp = new Date().toISOString();
      const logMessage = `[INFO ${timestamp}] ${message}`;
      
      if (this.outputChannel && this.isInitialized) {
        this.outputChannel.appendLine(logMessage);
      }
      console.log(logMessage);
    } catch (error) {
      console.log(`[INFO] ${message} (Logger error: ${error})`);
    }
  }

  /**
   * 记录错误日志
   */
  public static error(message: string, error?: Error): void {
    try {
      this.ensureInitialized();
      const timestamp = new Date().toISOString();
      const logMessage = `[ERROR ${timestamp}] ${message}`;
      
      if (this.outputChannel && this.isInitialized) {
        this.outputChannel.appendLine(logMessage);
        if (error) {
          this.outputChannel.appendLine(`${error.stack || error.message}`);
        }
      }
      
      console.error(logMessage);
      if (error) {
        console.error(error);
      }
    } catch (logError) {
      console.error(`[ERROR] ${message}`, error);
      console.error('Logger自身也发生错误:', logError);
    }
  }

  /**
   * 记录警告日志
   */
  public static warn(message: string): void {
    try {
      this.ensureInitialized();
      const timestamp = new Date().toISOString();
      const logMessage = `[WARN ${timestamp}] ${message}`;
      
      if (this.outputChannel && this.isInitialized) {
        this.outputChannel.appendLine(logMessage);
      }
      console.warn(logMessage);
    } catch (error) {
      console.warn(`[WARN] ${message} (Logger error: ${error})`);
    }
  }

  /**
   * 记录调试日志
   */
  public static debug(message: string): void {
    try {
      // 可以根据配置决定是否记录调试日志
      const config = vscode.workspace.getConfiguration('markdown-livesync');
      const enableDebug = config.get('debug', false);
      
      if (enableDebug) {
        this.ensureInitialized();
        const timestamp = new Date().toISOString();
        const logMessage = `[DEBUG ${timestamp}] ${message}`;
        
        if (this.outputChannel && this.isInitialized) {
          this.outputChannel.appendLine(logMessage);
        }
        console.log(logMessage);
      }
    } catch (error) {
      console.log(`[DEBUG] ${message} (Logger error: ${error})`);
    }
  }

  /**
   * 确保日志记录器已初始化
   */
  private static ensureInitialized(): void {
    if (!this.isInitialized || !this.outputChannel) {
      this.initialize();
    }
  }

  /**
   * 显示日志面板
   */
  public static show(): void {
    try {
      this.ensureInitialized();
      if (this.outputChannel && this.isInitialized) {
        this.outputChannel.show();
      }
    } catch (error) {
      console.error('显示日志面板失败:', error);
    }
  }

  /**
   * 清除日志
   */
  public static clear(): void {
    try {
      this.ensureInitialized();
      if (this.outputChannel && this.isInitialized) {
        this.outputChannel.clear();
      }
    } catch (error) {
      console.error('清除日志失败:', error);
    }
  }

  /**
   * 释放资源
   */
  public static dispose(): void {
    try {
      if (this.outputChannel) {
        this.outputChannel.dispose();
        this.outputChannel = undefined;
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('释放Logger资源失败:', error);
    }
  }
} 