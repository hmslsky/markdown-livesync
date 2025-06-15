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
 * VSCode扩展激活时的入口函数，当插件首次加载或满足激活条件时调用
 * 负责初始化插件的核心服务、注册命令和设置事件监听器
 * 
 * 激活流程：
 * 1. 创建日志系统，提供调试和错误追踪能力
 * 2. 初始化配置管理器，加载用户和默认配置
 * 3. 创建Extension核心服务实例
 * 4. 调用Extension.activate()完成插件初始化
 * 5. 设置全局错误处理，确保插件稳定运行
 * 
 * @param context VSCode扩展上下文，包含扩展运行环境和API访问权限
 * @returns void
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 步骤1: 初始化日志系统
    // 创建专用的输出通道，用于调试和错误追踪
    Logger.initialize();

    // 步骤2: 初始化配置管理器
    // ConfigurationManager负责管理所有插件配置项，包括预览设置、目录配置、主题选项等
    const configManager = ConfigurationManager.getInstance();

    // 步骤3: 创建Extension核心服务实例
    // Extension是插件的主控制器，管理所有核心功能
    extension = Extension.getInstance(context);

    // 步骤4: 激活Extension服务
    // 注册命令、事件监听器，启动插件的所有功能
    await extension.activate();

    // 步骤5: 记录激活成功
    Logger.info('Markdown LiveSync 插件激活成功！');
    
    // 步骤6: 输出已注册的命令列表（用于调试）
    const livesynCommands = await vscode.commands.getCommands(true);
    const markdownCommands = livesynCommands.filter(cmd => cmd.startsWith('markdown-livesync'));
    Logger.debug('已注册的命令: ' + markdownCommands.join(', '));

  } catch (error) {
    // 激活失败的错误处理
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error('Markdown LiveSync 插件激活失败: ' + errorMessage);
    
    // 向用户显示错误信息
    vscode.window.showErrorMessage(
      `Markdown LiveSync 插件激活失败: ${errorMessage}`
    );
    
    // 重新抛出错误，让VSCode知道插件激活失败
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