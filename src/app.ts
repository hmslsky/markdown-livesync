/**
 * Markdown LiveSync 插件入口
 *
 * 重构后的新版本，使用VSCode内置预览面板替代浏览器预览
 *
 * @author hmslsky
 * @version 1.0.1
 */

import * as vscode from 'vscode';
import { Extension } from './core/extension-service';
import { ConfigurationManager } from './config/config-manager';
import { Logger } from './utils/logger-util';

// 全局插件实例
let extension: Extension | undefined;

/**
 * 插件激活函数
 * @param context VSCode扩展上下文
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('开始激活 Markdown LiveSync 插件...');
  
  try {
    // 初始化日志器
    const logger = Logger;
    
    // 显示日志输出面板，便于调试
    logger.show();
    
    console.log('初始化配置管理器...');
    // 初始化配置管理器
    const configManager = ConfigurationManager.getInstance();

    logger.info('Markdown LiveSync 插件开始激活...');
    console.log('创建Extension实例...');

    // 创建并激活插件实例
    extension = Extension.getInstance(context);
    
    console.log('调用Extension.activate()...');
    await extension.activate();

    logger.info('Markdown LiveSync 插件激活成功');
    console.log('Markdown LiveSync 插件激活成功！');
    
    // 验证命令是否注册成功
    const commands = await vscode.commands.getCommands();
    const livesynCommands = commands.filter(cmd => cmd.startsWith('markdown-livesync.'));
    console.log('已注册的命令:', livesynCommands);
    logger.info(`已注册命令: ${livesynCommands.join(', ')}`);
    
  } catch (error) {
    const errorMessage = `Markdown LiveSync 插件激活失败: ${(error as Error).message}`;
    console.error(errorMessage, error);
    
    // 确保有日志记录
    try {
      Logger.error('插件激活失败', error as Error);
      Logger.show();
    } catch (logError) {
      console.error('日志记录也失败了:', logError);
    }
    
    vscode.window.showErrorMessage(errorMessage);
    
    // 重新抛出错误，这样VS Code会知道激活失败
    throw error;
  }
}

/**
 * 插件停用函数
 */
export function deactivate() {
  try {
    const logger = Logger;
    logger.info('Markdown LiveSync 插件开始停用...');

    if (extension) {
      extension.deactivate();
      extension = undefined;
    }

    logger.info('Markdown LiveSync 插件停用完成');
    logger.dispose();
  } catch (error) {
    console.error('Markdown LiveSync 插件停用时发生错误:', error);
  }
} 