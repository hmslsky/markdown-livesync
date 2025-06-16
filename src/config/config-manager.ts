/**
 * 配置管理器模块
 * 
 * ConfigurationManager是插件的配置中心，采用单例模式管理所有配置项
 * 负责配置的加载、验证、更新和热重载功能
 * 
 * 配置体系：
 * 1. 预览配置：控制预览面板的行为和外观
 * 2. 目录配置：管理目录的显示和交互方式
 * 3. 主题配置：控制预览的主题和自定义颜色
 * 4. Mermaid配置：管理图表功能的相关设置
 * 
 * 配置来源：
 * - VSCode用户设置：workspace configuration
 * - 默认值：内置的合理默认配置
 * - 运行时更新：支持配置热重载
 * 
 * 特性：
 * - 类型安全：所有配置项都有严格的类型定义
 * - 验证机制：确保配置值的有效性
 * - 热重载：配置变更后立即生效
 * - 导入导出：支持配置的备份和迁移
 * 
 * @author hmslsky
 * @version 1.0.2
 * @since 0.0.1
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger-util';

/**
 * 预览配置接口
 * 
 * 控制Markdown预览面板的核心行为和用户体验设置
 * 这些配置直接影响编辑器与预览面板的交互方式
 */
export interface PreviewConfig {
  /** 
   * 是否启用滚动同步功能
   * 
   * 当启用时，编辑器和预览面板会保持滚动位置同步
   * 编辑器滚动时预览会自动滚动到对应位置，反之亦然
   * 
   * 默认值：true
   * 性能影响：轻微，使用防抖机制优化
   */
  syncScroll: boolean;
  
  /** 
   * 默认预览面板显示位置
   * 
   * - 'current': 在当前编辑器窗口中打开预览（替换当前内容）
   * - 'side': 在编辑器侧边打开预览（并排显示，推荐）
   * 
   * 默认值：'side'
   * 使用建议：侧边显示提供最佳的编辑体验
   */
  defaultView: 'current' | 'side';
  
  /** 
   * 滚动时是否高亮当前行
   * 
   * 启用后，当编辑器光标移动或滚动时，预览中对应的内容会高亮显示
   * 有助于用户快速定位当前编辑位置在预览中的对应区域
   * 
   * 默认值：true
   * 性能影响：轻微，通过CSS动画实现
   */
  highlightOnScroll: boolean;
  
  /** 
   * 自动刷新延迟时间（毫秒）
   * 
   * 当文档内容发生变化时，预览面板的刷新延迟时间
   * 较小的值提供更实时的预览，但可能影响性能
   * 较大的值减少CPU使用，但预览更新会有延迟
   * 
   * 默认值：300ms
   * 推荐范围：100-1000ms
   * 性能考虑：建议不小于100ms以避免频繁更新
   */
  refreshDelay: number;
}

/**
 * 目录配置接口
 * 
 * 控制目录（Table of Contents）的显示、行为和交互方式
 * 目录功能帮助用户快速导航大型Markdown文档
 */
export interface TocConfig {
  /** 
   * 是否启用目录功能
   * 
   * 禁用后，预览面板将不显示目录，节省空间
   * 适合阅读短文档或需要最大预览区域的场景
   * 
   * 默认值：true
   * 影响：禁用后目录相关的所有功能都不可用
   */
  enabled: boolean;
  
  /** 
   * 是否显示目录项的折叠/展开按钮
   * 
   * 启用后，每个有子项的目录项都会显示折叠按钮
   * 用户可以折叠或展开不同级别的标题
   * 
   * 默认值：true
   * 用户体验：提供更好的目录结构控制
   */
  showToggleButton: boolean;
  
  /** 
   * 默认折叠级别
   * 
   * 控制目录初始加载时的展开程度
   * - 1: 只显示一级标题
   * - 2: 显示一、二级标题
   * - 3: 显示一、二、三级标题
   * - 以此类推...
   * 
   * 默认值：2
   * 有效范围：1-6
   * 建议：根据文档结构复杂度调整
   */
  defaultCollapseLevel: number;
  
  /** 
   * 是否自动展开当前项
   * 
   * 当编辑器光标移动到某个标题对应的内容时
   * 目录会自动展开并高亮显示该标题项
   * 
   * 默认值：true
   * 用户体验：提供更直观的位置指示
   */
  autoExpandCurrent: boolean;
  
  /** 
   * 目录面板显示位置
   * 
   * - 'left': 显示在预览内容的左侧（推荐）
   * - 'right': 显示在预览内容的右侧
   * 
   * 默认值：'left'
   * 考虑因素：左侧符合大多数用户的阅读习惯
   */
  position: 'left' | 'right';
  
  /** 
   * 目录面板宽度（像素）
   * 
   * 控制目录面板占用的横向空间
   * 太小会导致长标题被截断，太大会挤压预览区域
   * 
   * 默认值：280px
   * 有效范围：200-600px
   * 建议：根据屏幕分辨率和标题长度调整
   */
  width: number;
}

/**
 * 主题配置接口
 * 
 * 控制预览面板的视觉主题和颜色方案
 * 支持内置主题和完全自定义的颜色配置
 */
export interface ThemeConfig {
  /** 
   * 当前使用的主题
   * 
   * - 'vscode': 跟随VSCode编辑器主题（推荐）
   * - 'light': 固定使用浅色主题
   * - 'dark': 固定使用深色主题
   * 
   * 默认值：'vscode'
   * 建议：使用VSCode主题保持界面一致性
   */
  current: 'vscode' | 'light' | 'dark';
  
  /** 
   * 是否跟随VSCode主题变化
   * 
   * 启用后，当VSCode切换明暗主题时，预览也会自动切换
   * 禁用后，使用current配置的固定主题
   * 
   * 默认值：true
   * 用户体验：提供一致的视觉体验
   */
  followVSCode: boolean;
  
  /** 
   * 自定义主题颜色配置
   * 
   * 允许用户完全自定义预览的颜色方案
   * 分别为浅色和深色模式提供独立的颜色配置
   */
  custom: {
    /** 浅色模式的自定义颜色 */
    light: CustomThemeColors;
    /** 深色模式的自定义颜色 */
    dark: CustomThemeColors;
  };
}

/**
 * 自定义主题颜色配置
 * 
 * 定义预览面板各个视觉元素的颜色
 * 所有颜色值应使用CSS兼容的颜色格式（hex, rgb, rgba等）
 */
export interface CustomThemeColors {
  /** 
   * 主文本颜色
   * 
   * 用于正文内容、段落文字等主要文本
   * 应与背景色形成足够的对比度以确保可读性
   * 
   * 默认值（浅色）：#24292e
   * 默认值（深色）：#e1e4e8
   */
  textColor: string;
  
  /** 
   * 预览区域背景颜色
   * 
   * 预览面板主内容区域的背景色
   * 应与文本颜色搭配，确保良好的阅读体验
   * 
   * 默认值（浅色）：#ffffff
   * 默认值（深色）：#0d1117
   */
  backgroundColor: string;
  
  /** 
   * 边框颜色
   * 
   * 用于分隔线、表格边框、引用块边框等
   * 应比背景色稍深或稍浅，起到分隔作用
   * 
   * 默认值（浅色）：#e1e4e8
   * 默认值（深色）：#30363d
   */
  borderColor: string;
  
  /** 
   * 链接颜色
   * 
   * 用于超链接、引用链接等可点击元素
   * 应有足够的识别度，符合用户对链接颜色的预期
   * 
   * 默认值（浅色）：#0366d6
   * 默认值（深色）：#58a6ff
   */
  linkColor: string;
  
  /** 
   * 代码块背景颜色
   * 
   * 用于行内代码和代码块的背景
   * 应与正文背景有所区别，突出代码内容
   * 
   * 默认值（浅色）：#f6f8fa
   * 默认值（深色）：#161b22
   */
  codeBackground: string;
  
  /** 
   * 侧边栏（目录）背景颜色
   * 
   * 目录面板的背景色
   * 应与主内容区域有轻微区别，形成层次感
   * 
   * 默认值（浅色）：#f6f8fa
   * 默认值（深色）：#161b22
   */
  sidebarBackground: string;
  
  /** 
   * 一级标题颜色
   * 
   * 目录中一级标题（h1）的文字颜色
   * 通常使用较深的颜色，表示重要性
   * 
   * 默认值（浅色）：#24292e
   * 默认值（深色）：#f0f6fc
   */
  tocLevel1Color: string;
  
  /** 
   * 二级标题颜色
   * 
   * 目录中二级标题（h2）的文字颜色
   * 比一级标题稍浅，形成视觉层次
   * 
   * 默认值（浅色）：#586069
   * 默认值（深色）：#e1e4e8
   */
  tocLevel2Color: string;
  
  /** 
   * 三级标题颜色
   * 
   * 目录中三级标题（h3）的文字颜色
   * 最浅的标题颜色，形成完整的层次体系
   * 
   * 默认值（浅色）：#6a737d
   * 默认值（深色）：#8b949e
   */
  tocLevel3Color: string;
}

/**
 * Mermaid图表配置接口
 * 
 * 控制Mermaid图表功能的各项设置
 * Mermaid支持流程图、序列图、甘特图等多种图表类型
 */
export interface MermaidConfig {
  /** 
   * 是否启用Mermaid图表功能
   * 
   * 禁用后，Markdown中的mermaid代码块将显示为普通代码
   * 启用后，会自动渲染为交互式图表
   * 
   * 默认值：true
   * 性能影响：Mermaid库较大，禁用可减少加载时间
   */
  enabled: boolean;
  
  /** 
   * Mermaid图表主题
   * 
   * - 'default': 默认主题（浅色背景）
   * - 'dark': 深色主题（深色背景）
   * - 'forest': 森林主题（绿色调）
   * - 'neutral': 中性主题（灰色调）
   * 
   * 默认值：'default'
   * 建议：根据整体主题风格选择合适的图表主题
   */
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  
  /** 
   * 是否启用图表缩放控制
   * 
   * 启用后，用户可以通过鼠标滚轮或触摸手势缩放图表
   * 对于复杂的大型图表很有用
   * 
   * 默认值：true
   * 用户体验：提供更好的图表查看体验
   */
  enableZoom: boolean;
  
  /** 
   * 是否启用图表全屏功能
   * 
   * 启用后，图表会显示全屏按钮，用户可以全屏查看图表
   * 特别适合查看复杂的大型图表
   * 
   * 默认值：true
   * 用户体验：提供更好的图表阅读体验
   */
  enableFullscreen: boolean;
}

/**
 * 完整配置接口
 * 
 * 包含插件所有配置项的根接口
 * 这是配置管理器处理的完整配置结构
 */
export interface MarkdownLiveSyncConfig {
  /** 预览相关配置 */
  preview: PreviewConfig;
  
  /** 目录相关配置 */
  toc: TocConfig;
  
  /** 主题相关配置 */
  theme: ThemeConfig;
  
  /** Mermaid图表相关配置 */
  mermaid: MermaidConfig;
}

/**
 * 配置管理器类
 * 
 * 采用单例模式管理插件的所有配置项，提供配置的CRUD操作
 * 
 * 设计特点：
 * - 单例模式：确保全局配置的一致性
 * - 类型安全：严格的TypeScript类型检查
 * - 热重载：支持配置变更后立即生效
 * - 验证机制：确保配置值的有效性和安全性
 * - 导入导出：支持配置的备份、迁移和共享
 * 
 * 配置来源优先级：
 * 1. 用户设置（workspace configuration）
 * 2. 默认值（内置合理默认）
 * 
 * 配置变更流程：
 * 1. 检测配置变更事件
 * 2. 重新加载配置数据
 * 3. 验证配置有效性
 * 4. 通知相关组件更新
 */
export class ConfigurationManager {
  /** 单例实例引用 */
  private static instance: ConfigurationManager;
  
  /** 日志记录器实例 */
  private logger: typeof Logger;
  
  /** 当前加载的配置对象 */
  private config: MarkdownLiveSyncConfig;

  /**
   * 私有构造函数
   * 
   * 单例模式实现，初始化配置管理器并加载初始配置
   */
  private constructor() {
    this.logger = Logger;
    this.config = this.loadConfiguration();
  }

  /**
   * 获取配置管理器实例
   * 
   * 单例模式的访问点，确保全局只有一个配置管理器实例
   * 
   * @returns ConfigurationManager实例
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * 从VSCode配置中加载配置项
   * 
   * 读取用户在VSCode设置中的配置，结合默认值生成完整配置对象
   * 
   * 配置读取策略：
   * 1. 从workspace configuration获取用户配置
   * 2. 对于未设置的项使用默认值
   * 3. 构建类型安全的配置对象
   * 
   * @returns 完整的配置对象
   */
  private loadConfiguration(): MarkdownLiveSyncConfig {
    const config = vscode.workspace.getConfiguration('markdownLiveSync');
    
    return {
      // 预览配置加载
      preview: {
        syncScroll: config.get('preview.syncScroll', true),
        defaultView: config.get('preview.defaultView', 'side'),
        highlightOnScroll: config.get('preview.highlightOnScroll', true),
        refreshDelay: config.get('preview.refreshDelay', 300)
      },
      
      // 目录配置加载
      toc: {
        enabled: config.get('toc.enabled', true),
        showToggleButton: config.get('toc.showToggleButton', true),
        defaultCollapseLevel: config.get('toc.defaultCollapseLevel', 1),
        autoExpandCurrent: config.get('toc.autoExpandCurrent', true),
        position: config.get('toc.position', 'right'),
        width: config.get('toc.width', 280)
      },
      
      // 主题配置加载
      theme: {
        current: config.get('theme.current', 'light'),
        followVSCode: config.get('theme.followVSCode', false),
        custom: {
          // 浅色主题自定义颜色
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
          // 深色主题自定义颜色
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
      
      // Mermaid配置加载
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
   * 
   * 当VSCode配置发生变更时调用，重新读取最新的配置值
   * 通常由配置变更监听器触发
   */
  public reloadConfiguration(): void {
    this.config = this.loadConfiguration();
    this.logger.debug('配置已重新加载');
  }

  /**
   * 获取完整配置对象
   * 
   * 返回当前加载的完整配置，供其他模块使用
   * 
   * @returns 完整的配置对象
   */
  public getConfig(): MarkdownLiveSyncConfig {
    return this.config;
  }

  /**
   * 获取预览相关配置
   * 
   * 返回预览功能的专用配置对象
   * 
   * @returns 预览配置对象
   */
  public getPreviewConfig(): PreviewConfig {
    return this.config.preview;
  }

  /**
   * 获取目录相关配置
   * 
   * 返回目录功能的专用配置对象
   * 
   * @returns 目录配置对象
   */
  public getTocConfig(): TocConfig {
    return this.config.toc;
  }

  /**
   * 获取主题相关配置
   * 
   * 返回主题和颜色的专用配置对象
   * 
   * @returns 主题配置对象
   */
  public getThemeConfig(): ThemeConfig {
    return this.config.theme;
  }

  /**
   * 获取Mermaid相关配置
   * 
   * 返回Mermaid图表功能的专用配置对象
   * 
   * @returns Mermaid配置对象
   */
  public getMermaidConfig(): MermaidConfig {
    return this.config.mermaid;
  }

  /**
   * 更新指定配置项
   * 
   * 动态更新单个配置项的值，并持久化到VSCode设置中
   * 
   * 更新流程：
   * 1. 验证配置键和值的有效性
   * 2. 更新VSCode用户设置
   * 3. 重新加载配置缓存
   * 4. 记录更新日志
   * 
   * @param section 配置节名称（如'preview', 'toc'等）
   * @param key 配置键名称（如'syncScroll', 'enabled'等）
   * @param value 新的配置值
   * @throws {Error} 当配置更新失败时抛出错误
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
   * 
   * 将指定配置节或所有配置重置为默认值
   * 
   * 重置策略：
   * 1. 如果指定section，只重置该节的配置
   * 2. 如果不指定section，重置所有配置
   * 3. 通过设置为undefined来触发默认值
   * 
   * @param section 要重置的配置节，不指定则重置所有配置
   * @throws {Error} 当重置操作失败时抛出错误
   */
  public async resetConfig(section?: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('markdownLiveSync');
      
      if (section) {
        // 重置指定配置节
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
   * 获取默认配置对象
   * 
   * 返回所有配置项的默认值，用于重置操作和初始化
   * 
   * @returns 包含所有默认值的配置对象
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
        current: 'light',
        followVSCode: false,
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
   * 验证配置对象的有效性
   * 
   * 检查配置对象是否符合类型定义和值约束
   * 
   * 验证规则：
   * 1. 类型检查：确保所有值符合接口定义
   * 2. 范围检查：确保数值在有效范围内
   * 3. 枚举检查：确保枚举值在允许的选项中
   * 
   * @param config 要验证的配置对象（可以是部分配置）
   * @returns 配置是否有效
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
   * 导出当前配置为JSON字符串
   * 
   * 将当前的配置对象序列化为JSON格式
   * 可用于配置备份、分享或迁移
   * 
   * @returns 格式化的配置JSON字符串
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 从JSON字符串导入配置
   * 
   * 解析配置JSON并应用到VSCode设置中
   * 
   * 导入流程：
   * 1. 解析JSON字符串
   * 2. 验证配置格式和有效性
   * 3. 逐项更新VSCode配置
   * 4. 重新加载配置缓存
   * 
   * @param configJson 配置JSON字符串
   * @throws {Error} 当JSON格式无效或配置验证失败时抛出错误
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