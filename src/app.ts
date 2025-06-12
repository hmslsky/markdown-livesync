/**
 * Markdown LiveSync 插件入口
 * 
 * 这是插件的主入口文件，负责处理VSCode扩展的激活和停用生命周期
 * 该插件提供Markdown文档的实时预览功能，支持双向光标同步、目录导航等特性
 * 
 * 功能特性：
 * - 实时预览Markdown文档
 * - 编辑器与预览面板的双向光标同步  
 * - 自动生成目录并支持导航
 * - 支持Mermaid图表渲染
 * - 可配置的主题和布局
 * 
 * 架构说明：
 * 采用单例模式管理核心服务，通过事件驱动机制实现实时同步
 * 使用VSCode WebView API提供预览功能，替代传统的浏览器预览方式
 * 
 * @author hmslsky
 * @version 1.0.2
 * @since 0.0.1
 */

import * as vscode from 'vscode';
import { Extension } from './core/extension-service';
import { ConfigurationManager } from './config/config-manager';
import { Logger } from './utils/logger-util';

// 全局插件实例，采用模块级单例模式
let extension: Extension | undefined;

/**
 * 插件激活函数
 * 
 * VSCode扩展激活的入口点，当插件被激活时由VSCode自动调用
 * 负责初始化所有核心服务、注册命令和事件监听器
 * 
 * 激活流程：
 * 1. 初始化日志系统，便于调试和问题排查
 * 2. 创建配置管理器实例，加载用户配置
 * 3. 初始化核心扩展服务
 * 4. 注册VSCode命令和事件监听器
 * 5. 验证命令注册状态
 * 
 * @param context VSCode扩展上下文，包含扩展的元数据和生命周期管理
 * @returns Promise<void> 异步激活完成标志
 * @throws {Error} 当激活过程中发生错误时抛出异常
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('开始激活 Markdown LiveSync 插件...');
  
  try {
    // 步骤1: 初始化日志器
    // Logger采用单例模式，确保全局日志记录的一致性
    const logger = Logger;
    
    // 显示日志输出面板，便于开发者调试和用户问题排查
    logger.show();
    
    console.log('初始化配置管理器...');
    
    // 步骤2: 初始化配置管理器
    // ConfigurationManager负责管理所有插件配置项，包括预览设置、目录配置、主题选项等
    const configManager = ConfigurationManager.getInstance();

    logger.info('Markdown LiveSync 插件开始激活...');
    console.log('创建Extension实例...');

    // 步骤3: 创建并激活插件核心服务实例
    // Extension类是插件的核心控制器，管理所有业务逻辑
    extension = Extension.getInstance(context);
    
    console.log('调用Extension.activate()...');
    
    // 步骤4: 激活核心服务
    // 这一步会注册所有命令、事件监听器和配置监听器
    await extension.activate();

    logger.info('Markdown LiveSync 插件激活成功');
    console.log('Markdown LiveSync 插件激活成功！');
    
    // 步骤5: 验证命令注册状态
    // 确保所有插件命令都已正确注册到VSCode中
    const commands = await vscode.commands.getCommands();
    const livesynCommands = commands.filter(cmd => cmd.startsWith('markdown-livesync.'));
    console.log('已注册的命令:', livesynCommands);
    logger.info(`已注册命令: ${livesynCommands.join(', ')}`);
    
  } catch (error) {
    // 错误处理：记录详细错误信息并向用户展示友好的错误消息
    const errorMessage = `Markdown LiveSync 插件激活失败: ${(error as Error).message}`;
    console.error(errorMessage, error);
    
    // 确保错误信息被记录到日志中，即使日志系统可能也有问题
    try {
      Logger.error('插件激活失败', error as Error);
      Logger.show();
    } catch (logError) {
      console.error('日志记录也失败了:', logError);
    }
    
    // 向用户显示错误消息
    vscode.window.showErrorMessage(errorMessage);
    
    // 重新抛出错误，让VSCode知道激活失败
    // 这样VSCode会将插件标记为激活失败状态
    throw error;
  }
}

/**
 * 插件停用函数
 * 
 * VSCode扩展停用时的清理函数，当插件被禁用或VSCode关闭时调用
 * 负责释放所有资源、清理事件监听器和关闭活动面板
 * 
 * 停用流程：
 * 1. 记录停用开始日志
 * 2. 调用核心服务的停用方法
 * 3. 清理插件实例引用
 * 4. 释放日志系统资源
 * 
 * @returns void
 */
export function deactivate(): void {
  try {
    const logger = Logger;
    logger.info('Markdown LiveSync 插件开始停用...');

    // 清理核心服务实例
    if (extension) {
      // 调用核心服务的停用方法，清理所有资源
      extension.deactivate();
      // 清理全局引用，避免内存泄漏
      extension = undefined;
    }

    logger.info('Markdown LiveSync 插件停用完成');
    
    // 释放日志系统资源
    logger.dispose();
  } catch (error) {
    // 即使在停用过程中出错，也要确保清理工作尽可能完成
    console.error('Markdown LiveSync 插件停用时发生错误:', error);
  }
} 