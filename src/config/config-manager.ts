/**
 * 配置管理器
 * 
 * 负责管理插件的所有配置项，提供类型安全的配置访问接口
 * 支持配置验证、默认值处理和配置变更监听
 * 
 * @author hmslsky
 * @version 1.0.0
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger-util';

/**
 * 预览配置接口
 */
export interface PreviewConfig {
  /** 默认显示位置 */
  defaultView: 'side' | 'window';
  /** 是否显示目录 */
  showToc: boolean;
  /** 是否同步滚动 */
  syncScroll: boolean;
  /** 滚动时是否高亮 */
  highlightOnScroll: boolean;
}

/**
 * 目录配置接口
 */
export interface TocConfig {
  /** 默认折叠级别 */
  defaultCollapseLevel: number;
  /** 是否显示折叠按钮 */
  showToggleButton: boolean;
  /** 是否高亮当前项 */
  highlightCurrentItem: boolean;
  /** 是否记住折叠状态 */
  rememberCollapseState: boolean;
}

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 字体大小 */
  fontSize: number;
  /** 字体族 */
  fontFamily: string;
  /** 行高 */
  lineHeight: number;
}

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  /** 分块大小 */
  chunkSize: number;
  /** 缓存大小 */
  cacheSize: number;
  /** 是否启用懒加载 */
  lazyLoad: boolean;
}

/**
 * 完整配置接口
 */
export interface MarkdownLiveSyncConfig {
  /** 预览配置 */
  preview: PreviewConfig;
  /** 目录配置 */
  toc: TocConfig;
  /** 主题配置 */
  theme: ThemeConfig;
  /** 性能配置 */
  performance: PerformanceConfig;
  /** 是否启用调试 */
  debug: boolean;
}

/**
 * 配置管理器类
 * 
 * 提供类型安全的配置访问和管理功能
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private logger: typeof Logger;
  private config: MarkdownLiveSyncConfig;

  /**
   * 私有构造函数
   */
  private constructor() {
    this.logger = Logger;
    this.config = this.loadConfiguration();
  }

  /**
   * 获取配置管理器实例（单例模式）
   * @returns ConfigurationManager实例
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * 加载配置
   * @returns 完整的配置对象
   */
  private loadConfiguration(): MarkdownLiveSyncConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('markdown-livesync');

    // 加载预览配置
    const previewConfig = workspaceConfig.get<Partial<PreviewConfig>>('preview', {});
    const preview: PreviewConfig = {
      defaultView: previewConfig.defaultView || 'side',
      showToc: previewConfig.showToc !== undefined ? previewConfig.showToc : true,
      syncScroll: previewConfig.syncScroll !== undefined ? previewConfig.syncScroll : true,
      highlightOnScroll: previewConfig.highlightOnScroll !== undefined ? previewConfig.highlightOnScroll : false
    };

    // 加载目录配置
    const tocConfig = workspaceConfig.get<Partial<TocConfig>>('toc', {});
    const toc: TocConfig = {
      defaultCollapseLevel: tocConfig.defaultCollapseLevel || 2,
      showToggleButton: tocConfig.showToggleButton !== undefined ? tocConfig.showToggleButton : true,
      highlightCurrentItem: tocConfig.highlightCurrentItem !== undefined ? tocConfig.highlightCurrentItem : true,
      rememberCollapseState: tocConfig.rememberCollapseState !== undefined ? tocConfig.rememberCollapseState : true
    };

    // 加载主题配置
    const themeConfig = workspaceConfig.get<Partial<ThemeConfig>>('theme', {});
    const theme: ThemeConfig = {
      fontSize: themeConfig.fontSize || 14,
      fontFamily: themeConfig.fontFamily || '',
      lineHeight: themeConfig.lineHeight || 1.6
    };

    // 加载性能配置
    const performanceConfig = workspaceConfig.get<Partial<PerformanceConfig>>('performance', {});
    const performance: PerformanceConfig = {
      chunkSize: performanceConfig.chunkSize || 1000,
      cacheSize: performanceConfig.cacheSize || 100,
      lazyLoad: performanceConfig.lazyLoad !== undefined ? performanceConfig.lazyLoad : true
    };

    // 加载调试配置
    const debug = workspaceConfig.get<boolean>('debug', false);

    return {
      preview,
      toc,
      theme,
      performance,
      debug
    };
  }

  /**
   * 重新加载配置
   */
  public reloadConfiguration(): void {
    const oldConfig = this.config;
    this.config = this.loadConfiguration();
    
    this.logger.info('配置已重新加载');
    
    // 记录配置变更
    if (this.config.debug !== oldConfig.debug) {
      this.logger.info(`调试模式已${this.config.debug ? '启用' : '禁用'}`);
    }
  }

  /**
   * 获取完整配置
   * @returns 完整的配置对象
   */
  public getConfig(): MarkdownLiveSyncConfig {
    return { ...this.config };
  }

  /**
   * 获取预览配置
   * @returns 预览配置
   */
  public getPreviewConfig(): PreviewConfig {
    return { ...this.config.preview };
  }

  /**
   * 获取目录配置
   * @returns 目录配置
   */
  public getTocConfig(): TocConfig {
    return { ...this.config.toc };
  }

  /**
   * 获取主题配置
   * @returns 主题配置
   */
  public getThemeConfig(): ThemeConfig {
    return { ...this.config.theme };
  }

  /**
   * 获取性能配置
   * @returns 性能配置
   */
  public getPerformanceConfig(): PerformanceConfig {
    return { ...this.config.performance };
  }

  /**
   * 是否启用调试模式
   * @returns 调试模式状态
   */
  public isDebugEnabled(): boolean {
    return this.config.debug;
  }

  /**
   * 验证配置值
   * @param config 要验证的配置
   * @returns 验证结果
   */
  public validateConfig(config: Partial<MarkdownLiveSyncConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证预览配置
    if (config.preview) {
      if (config.preview.defaultView && !['side', 'window'].includes(config.preview.defaultView)) {
        errors.push('preview.defaultView 必须是 "side" 或 "window"');
      }
    }

    // 验证目录配置
    if (config.toc) {
      if (config.toc.defaultCollapseLevel !== undefined) {
        if (!Number.isInteger(config.toc.defaultCollapseLevel) || config.toc.defaultCollapseLevel < 1 || config.toc.defaultCollapseLevel > 6) {
          errors.push('toc.defaultCollapseLevel 必须是 1-6 之间的整数');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 