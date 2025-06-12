/**
 * 配置管理器
 * 
 * 负责管理插件的所有配置项，包括预览、目录、主题等设置
 * 支持配置变更监听和实时更新
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
  /** 是否启用滚动同步 */
  syncScroll: boolean;
  /** 默认视图位置 */
  defaultView: 'current' | 'side';
  /** 是否在滚动时高亮 */
  highlightOnScroll: boolean;
  /** 自动刷新延迟（毫秒） */
  refreshDelay: number;
}

/**
 * 目录配置接口
 */
export interface TocConfig {
  /** 是否显示目录 */
  enabled: boolean;
  /** 是否显示折叠按钮 */
  showToggleButton: boolean;
  /** 默认折叠级别 */
  defaultCollapseLevel: number;
  /** 是否自动展开当前项 */
  autoExpandCurrent: boolean;
  /** 目录位置 */
  position: 'left' | 'right';
  /** 目录宽度 */
  width: number;
}

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 当前主题 */
  current: 'vscode' | 'light' | 'dark';
  /** 是否跟随VSCode主题 */
  followVSCode: boolean;
  /** 自定义主题配置 */
  custom: {
    light: CustomThemeColors;
    dark: CustomThemeColors;
  };
}

/**
 * 自定义主题颜色配置
 */
export interface CustomThemeColors {
  /** 文本颜色 */
  textColor: string;
  /** 背景颜色 */
  backgroundColor: string;
  /** 边框颜色 */
  borderColor: string;
  /** 链接颜色 */
  linkColor: string;
  /** 代码背景颜色 */
  codeBackground: string;
  /** 侧边栏背景颜色 */
  sidebarBackground: string;
  /** 一级标题颜色 */
  tocLevel1Color: string;
  /** 二级标题颜色 */
  tocLevel2Color: string;
  /** 三级标题颜色 */
  tocLevel3Color: string;
}

/**
 * Mermaid配置接口
 */
export interface MermaidConfig {
  /** 是否启用Mermaid */
  enabled: boolean;
  /** 主题 */
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  /** 是否启用缩放控制 */
  enableZoom: boolean;
  /** 是否启用全屏 */
  enableFullscreen: boolean;
}

/**
 * 完整配置接口
 */
export interface MarkdownLiveSyncConfig {
  preview: PreviewConfig;
  toc: TocConfig;
  theme: ThemeConfig;
  mermaid: MermaidConfig;
}

/**
 * 配置管理器类
 * 
 * 单例模式管理所有配置项
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
   * @returns 配置对象
   */
  private loadConfiguration(): MarkdownLiveSyncConfig {
    const config = vscode.workspace.getConfiguration('markdownLiveSync');
    
    return {
      preview: {
        syncScroll: config.get('preview.syncScroll', true),
        defaultView: config.get('preview.defaultView', 'side'),
        highlightOnScroll: config.get('preview.highlightOnScroll', true),
        refreshDelay: config.get('preview.refreshDelay', 300)
      },
      toc: {
        enabled: config.get('toc.enabled', true),
        showToggleButton: config.get('toc.showToggleButton', true),
        defaultCollapseLevel: config.get('toc.defaultCollapseLevel', 2),
        autoExpandCurrent: config.get('toc.autoExpandCurrent', true),
        position: config.get('toc.position', 'left'),
        width: config.get('toc.width', 280)
      },
      theme: {
        current: config.get('theme.current', 'vscode'),
        followVSCode: config.get('theme.followVSCode', true),
        custom: {
          light: {
            textColor: config.get('theme.custom.light.textColor', '#24292e'),
            backgroundColor: config.get('theme.custom.light.backgroundColor', '#ffffff'),
            borderColor: config.get('theme.custom.light.borderColor', '#e1e4e8'),
            linkColor: config.get('theme.custom.light.linkColor', '#0366d6'),
            codeBackground: config.get('theme.custom.light.codeBackground', '#f6f8fa'),
            sidebarBackground: config.get('theme.custom.light.sidebarBackground', '#f6f8fa'),
            tocLevel1Color: config.get('theme.custom.light.tocLevel1Color', '#24292e'),
            tocLevel2Color: config.get('theme.custom.light.tocLevel2Color', '#586069'),
            tocLevel3Color: config.get('theme.custom.light.tocLevel3Color', '#6a737d')
          },
          dark: {
            textColor: config.get('theme.custom.dark.textColor', '#e1e4e8'),
            backgroundColor: config.get('theme.custom.dark.backgroundColor', '#0d1117'),
            borderColor: config.get('theme.custom.dark.borderColor', '#30363d'),
            linkColor: config.get('theme.custom.dark.linkColor', '#58a6ff'),
            codeBackground: config.get('theme.custom.dark.codeBackground', '#161b22'),
            sidebarBackground: config.get('theme.custom.dark.sidebarBackground', '#161b22'),
            tocLevel1Color: config.get('theme.custom.dark.tocLevel1Color', '#f0f6fc'),
            tocLevel2Color: config.get('theme.custom.dark.tocLevel2Color', '#e1e4e8'),
            tocLevel3Color: config.get('theme.custom.dark.tocLevel3Color', '#8b949e')
          }
        }
      },
      mermaid: {
        enabled: config.get('mermaid.enabled', true),
        theme: config.get('mermaid.theme', 'default'),
        enableZoom: config.get('mermaid.enableZoom', true),
        enableFullscreen: config.get('mermaid.enableFullscreen', true)
      }
    };
  }

  /**
   * 重新加载配置
   */
  public reloadConfiguration(): void {
    this.config = this.loadConfiguration();
    this.logger.debug('配置已重新加载');
  }

  /**
   * 获取完整配置
   * @returns 配置对象
   */
  public getConfig(): MarkdownLiveSyncConfig {
    return this.config;
  }

  /**
   * 获取预览配置
   * @returns 预览配置
   */
  public getPreviewConfig(): PreviewConfig {
    return this.config.preview;
  }

  /**
   * 获取目录配置
   * @returns 目录配置
   */
  public getTocConfig(): TocConfig {
    return this.config.toc;
  }

  /**
   * 获取主题配置
   * @returns 主题配置
   */
  public getThemeConfig(): ThemeConfig {
    return this.config.theme;
  }

  /**
   * 获取Mermaid配置
   * @returns Mermaid配置
   */
  public getMermaidConfig(): MermaidConfig {
    return this.config.mermaid;
  }

  /**
   * 更新配置
   * @param section 配置节
   * @param key 配置键
   * @param value 配置值
   */
  public async updateConfig(section: string, key: string, value: any): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('markdownLiveSync');
      await config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Global);
      this.reloadConfiguration();
      this.logger.info(`配置已更新: ${section}.${key} = ${value}`);
    } catch (error) {
      this.logger.error('更新配置失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 重置配置到默认值
   * @param section 要重置的配置节，如果不指定则重置所有
   */
  public async resetConfig(section?: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('markdownLiveSync');
      
      if (section) {
        // 重置指定节
        const keys = Object.keys(this.getDefaultConfig()[section as keyof MarkdownLiveSyncConfig]);
        for (const key of keys) {
          await config.update(`${section}.${key}`, undefined, vscode.ConfigurationTarget.Global);
        }
        this.logger.info(`配置节 ${section} 已重置`);
      } else {
        // 重置所有配置
        const sections = ['preview', 'toc', 'theme', 'mermaid'];
        for (const sec of sections) {
          const keys = Object.keys(this.getDefaultConfig()[sec as keyof MarkdownLiveSyncConfig]);
          for (const key of keys) {
            await config.update(`${sec}.${key}`, undefined, vscode.ConfigurationTarget.Global);
          }
        }
        this.logger.info('所有配置已重置');
      }
      
      this.reloadConfiguration();
    } catch (error) {
      this.logger.error('重置配置失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取默认配置
   * @returns 默认配置对象
   */
  private getDefaultConfig(): MarkdownLiveSyncConfig {
    return {
      preview: {
        syncScroll: true,
        defaultView: 'side',
        highlightOnScroll: true,
        refreshDelay: 300
      },
      toc: {
        enabled: true,
        showToggleButton: true,
        defaultCollapseLevel: 2,
        autoExpandCurrent: true,
        position: 'left',
        width: 280
      },
      theme: {
        current: 'vscode',
        followVSCode: true,
        custom: {
          light: {
            textColor: '#24292e',
            backgroundColor: '#ffffff',
            borderColor: '#e1e4e8',
            linkColor: '#0366d6',
            codeBackground: '#f6f8fa',
            sidebarBackground: '#f6f8fa',
            tocLevel1Color: '#24292e',
            tocLevel2Color: '#586069',
            tocLevel3Color: '#6a737d'
          },
          dark: {
            textColor: '#e1e4e8',
            backgroundColor: '#0d1117',
            borderColor: '#30363d',
            linkColor: '#58a6ff',
            codeBackground: '#161b22',
            sidebarBackground: '#161b22',
            tocLevel1Color: '#f0f6fc',
            tocLevel2Color: '#e1e4e8',
            tocLevel3Color: '#8b949e'
          }
        }
      },
      mermaid: {
        enabled: true,
        theme: 'default',
        enableZoom: true,
        enableFullscreen: true
      }
    };
  }

  /**
   * 验证配置
   * @param config 要验证的配置
   * @returns 是否有效
   */
  public validateConfig(config: Partial<MarkdownLiveSyncConfig>): boolean {
    try {
      // 验证预览配置
      if (config.preview) {
        const preview = config.preview;
        if (typeof preview.syncScroll !== 'boolean' ||
            !['current', 'side'].includes(preview.defaultView) ||
            typeof preview.highlightOnScroll !== 'boolean' ||
            typeof preview.refreshDelay !== 'number' || preview.refreshDelay < 0) {
          return false;
        }
      }

      // 验证目录配置
      if (config.toc) {
        const toc = config.toc;
        if (typeof toc.enabled !== 'boolean' ||
            typeof toc.showToggleButton !== 'boolean' ||
            typeof toc.defaultCollapseLevel !== 'number' || toc.defaultCollapseLevel < 1 || toc.defaultCollapseLevel > 6 ||
            typeof toc.autoExpandCurrent !== 'boolean' ||
            !['left', 'right'].includes(toc.position) ||
            typeof toc.width !== 'number' || toc.width < 200 || toc.width > 600) {
          return false;
        }
      }

      // 验证主题配置
      if (config.theme) {
        const theme = config.theme;
        if (!['vscode', 'light', 'dark'].includes(theme.current) ||
            typeof theme.followVSCode !== 'boolean') {
          return false;
        }
      }

      // 验证Mermaid配置
      if (config.mermaid) {
        const mermaid = config.mermaid;
        if (typeof mermaid.enabled !== 'boolean' ||
            !['default', 'dark', 'forest', 'neutral'].includes(mermaid.theme) ||
            typeof mermaid.enableZoom !== 'boolean' ||
            typeof mermaid.enableFullscreen !== 'boolean') {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('配置验证失败: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * 导出配置
   * @returns 配置JSON字符串
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 导入配置
   * @param configJson 配置JSON字符串
   */
  public async importConfig(configJson: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configJson) as Partial<MarkdownLiveSyncConfig>;
      
      if (!this.validateConfig(importedConfig)) {
        throw new Error('配置格式无效');
      }

      const config = vscode.workspace.getConfiguration('markdownLiveSync');
      
      // 更新所有配置项
      for (const [section, sectionConfig] of Object.entries(importedConfig)) {
        if (sectionConfig && typeof sectionConfig === 'object') {
          for (const [key, value] of Object.entries(sectionConfig)) {
            await config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Global);
          }
        }
      }

      this.reloadConfiguration();
      this.logger.info('配置导入成功');
    } catch (error) {
      this.logger.error('导入配置失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }
} 