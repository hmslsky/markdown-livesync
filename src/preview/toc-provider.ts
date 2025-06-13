/**
 * 目录提供者
 * 
 * 负责从Markdown文档中提取标题信息并生成目录结构
 * 支持目录折叠、展开和导航功能
 * 
 * @author hmslsky
 * @version 1.0.0
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../config/config-manager';
import { Logger } from '../utils/logger-util';

/**
 * 目录项接口
 */
export interface TocItem {
  /** 标题级别 (1-6) */
  level: number;
  /** 标题文本 */
  text: string;
  /** 行号 */
  line: number;
  /** 子项 */
  children: TocItem[];
  /** 是否展开 */
  isExpanded?: boolean;
  /** 唯一标识符 */
  id: string;
  /** 锚点链接 */
  anchor: string;
}

/**
 * 目录提供者类
 * 
 * 从Markdown文档中提取标题并生成层次化的目录结构
 */
export class TocProvider {
  private configManager: ConfigurationManager;
  private logger: typeof Logger;
  private collapseStates: Map<string, boolean> = new Map();

  /**
   * 构造函数
   */
  constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.logger = Logger;
    this.logger.info('TocProvider初始化完成');
  }

  /**
   * 生成目录结构
   * @param document Markdown文档
   * @returns 目录项数组
   */
  public generateToc(document: vscode.TextDocument): TocItem[] {
    this.logger.debug('开始生成目录');
    
    try {
      // 检查配置
      const config = this.configManager.getTocConfig();
      if (!config.enabled) {
        this.logger.warn('目录功能已禁用');
        return [];
      }

      const toc: TocItem[] = [];
      const lines = document.getText().split('\n');
      
      // 增强的标题匹配正则表达式
      const headerRegex = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;
      
      // 代码块状态跟踪
      let inCodeBlock = false;
      let inIndentedCodeBlock = false;  // 缩进代码块状态
      let consecutiveEmptyLines = 0;   // 连续空行计数
      let previousLineIsList = false;  // 前一行是否是列表项
      let codeBlockFence = '';  // 代码块分隔符
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // 检查是否是空行
        if (trimmedLine === '') {
          consecutiveEmptyLines++;
          previousLineIsList = false;
          continue;
        }
        
        // 检查是否是列表项
        const isListItem = /^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line);
        
        // 检查缩进代码块的结束
        if (inIndentedCodeBlock && consecutiveEmptyLines >= 1 && !line.startsWith('    ') && !line.startsWith('\t') && !isListItem) {
          inIndentedCodeBlock = false;
          this.logger.debug(`缩进代码块结束于第 ${i + 1} 行`);
        }
        
        // 重置空行计数
        consecutiveEmptyLines = 0;
        
        // 检查围栏代码块
        if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
          if (!inCodeBlock) {
            // 开始新的代码块
            codeBlockFence = trimmedLine.slice(0, 3);
            inCodeBlock = true;
            this.logger.debug(`代码块开始于第 ${i + 1} 行，使用 ${codeBlockFence} 作为分隔符`);
          } else if (trimmedLine.startsWith(codeBlockFence)) {
            // 结束当前代码块
            inCodeBlock = false;
            this.logger.debug(`代码块结束于第 ${i + 1} 行`);
          }
          previousLineIsList = false;
          continue;
        }
        
        // 检查缩进代码块的开始
        if (!inCodeBlock && !inIndentedCodeBlock && (line.startsWith('    ') || line.startsWith('\t')) && !isListItem && !previousLineIsList) {
          inIndentedCodeBlock = true;
          this.logger.debug(`缩进代码块开始于第 ${i + 1} 行`);
        }
        
        // 如果在代码块内，跳过
        if (inCodeBlock || inIndentedCodeBlock) {
          previousLineIsList = isListItem;
          continue;
        }
        
        // 匹配标题
        const match = line.match(headerRegex);
        if (match) {
          const level = match[1].length;
          const text = match[2].trim();
          const id = this.generateId(text, i);
          const anchor = this.slugify(text);
          
          // 检查是否应该展开
          const isExpanded = this.shouldExpand(level, config.defaultCollapseLevel, id);
          
          const tocItem: TocItem = {
            level,
            text,
            line: i + 1, // 行号从1开始
            children: [],
            isExpanded,
            id,
            anchor
          };
          
          toc.push(tocItem);
          this.logger.debug(`找到标题: ${text} (级别 ${level}) 在第 ${i + 1} 行`);
        }
        
        previousLineIsList = isListItem;
      }
      
      // 构建层次结构
      const hierarchicalToc = this.buildTocTree(toc);
      
      this.logger.info(`目录生成完成，共 ${toc.length} 个标题`);
      return hierarchicalToc;
      
    } catch (error) {
      this.logger.error('生成目录失败', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * 构建目录树结构
   * @param items 扁平的目录项数组
   * @returns 层次化的目录项数组
   */
  private buildTocTree(items: TocItem[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: TocItem[] = [];
    
    for (const item of items) {
      // 弹出栈中级别大于等于当前项级别的项
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }
      
      // 如果栈为空，添加到根级别
      if (stack.length === 0) {
        root.push(item);
      } else {
        // 添加到栈顶项的子项中
        stack[stack.length - 1].children.push(item);
      }
      
      // 将当前项推入栈
      stack.push(item);
    }
    
    return root;
  }

  /**
   * 渲染目录HTML
   * @param toc 目录结构
   * @returns 目录HTML字符串
   */
  public renderToc(toc: TocItem[]): string {
    if (!toc || toc.length === 0) {
      return '<div class="toc-empty">没有找到标题</div>';
    }
    
    this.logger.debug(`开始渲染目录，共 ${toc.length} 个标题`);
    return this.renderTocItems(toc, 0);
  }

  /**
   * 渲染目录项
   * @param items 目录项数组
   * @param level 当前级别
   * @returns HTML字符串
   */
  private renderTocItems(items: TocItem[], level: number): string {
    if (!items || items.length === 0) {
      return '';
    }

    const config = this.configManager.getTocConfig();
    
    const html = items.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = item.isExpanded;
      
      // 生成折叠按钮
      const toggleButton = hasChildren && config.showToggleButton ? `
        <button class="toc-toggle ${isExpanded ? 'expanded' : 'collapsed'}" 
                data-id="${item.id}"
                data-level="${item.level}"
                title="${isExpanded ? '折叠' : '展开'}">
          <span class="toc-toggle-icon">▶</span>
        </button>
      ` : '<span class="toc-toggle-spacer"></span>';

      // 生成标题链接
      const link = `
        <a href="#${item.anchor}" 
           class="toc-link level-${item.level}" 
           data-line="${item.line}"
           data-id="${item.id}"
           title="跳转到第 ${item.line} 行">
          ${this.escapeHtml(item.text)}
        </a>
      `;

      // 生成子项
      const childrenHtml = hasChildren ? `
        <div class="toc-children ${isExpanded ? 'expanded' : 'collapsed'}">
          ${this.renderTocItems(item.children, level + 1)}
        </div>
      ` : '';

      return `
        <div class="toc-item level-${level} ${hasChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : 'collapsed'}" 
             data-id="${item.id}" 
             data-level="${item.level}">
          <div class="toc-item-header">
            ${toggleButton}
            ${link}
          </div>
          ${childrenHtml}
        </div>
      `;
    }).join('');

    return html;
  }

  /**
   * 生成唯一标识符
   * @param text 标题文本
   * @param lineIndex 行号
   * @returns 唯一标识符
   */
  private generateId(text: string, lineIndex: number): string {
    const base = this.slugify(text);
    return `${base}-${lineIndex}`;
  }

  /**
   * 生成URL友好的锚点
   * @param text 文本
   * @returns 锚点字符串
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * 转义HTML特殊字符
   * @param text 文本
   * @returns 转义后的文本
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 判断是否应该展开
   * @param level 标题级别
   * @param defaultCollapseLevel 默认折叠级别
   * @param id 目录项ID
   * @returns 是否展开
   */
  private shouldExpand(level: number, defaultCollapseLevel: number, id: string): boolean {
    // 检查是否有保存的折叠状态
    const savedState = this.getCollapseState(id);
    if (savedState !== undefined) {
      return savedState;
    }

    // 根据默认折叠级别决定
    return level <= defaultCollapseLevel;
  }

  /**
   * 设置折叠状态
   * @param id 目录项ID
   * @param isExpanded 是否展开
   */
  public setCollapseState(id: string, isExpanded: boolean): void {
    this.collapseStates.set(id, isExpanded);
  }

  /**
   * 获取折叠状态
   * @param id 目录项ID
   * @returns 是否展开
   */
  public getCollapseState(id: string): boolean | undefined {
    return this.collapseStates.get(id);
  }

  /**
   * 清除所有折叠状态
   */
  public clearCollapseStates(): void {
    this.collapseStates.clear();
  }

  /**
   * 展开所有目录项
   * @param toc 目录结构
   */
  public expandAll(toc: TocItem[]): void {
    const expandRecursive = (items: TocItem[]) => {
      for (const item of items) {
        item.isExpanded = true;
        this.setCollapseState(item.id, true);
        if (item.children.length > 0) {
          expandRecursive(item.children);
        }
      }
    };

    expandRecursive(toc);
  }

  /**
   * 折叠所有目录项
   * @param toc 目录结构
   */
  public collapseAll(toc: TocItem[]): void {
    const collapseRecursive = (items: TocItem[]) => {
      for (const item of items) {
        item.isExpanded = false;
        this.setCollapseState(item.id, false);
        if (item.children.length > 0) {
          collapseRecursive(item.children);
        }
      }
    };

    collapseRecursive(toc);
  }

  /**
   * 根据行号查找目录项
   * @param toc 目录结构
   * @param line 行号
   * @returns 目录项
   */
  public findTocItemByLine(toc: TocItem[], line: number): TocItem | undefined {
    const findRecursive = (items: TocItem[]): TocItem | undefined => {
      for (const item of items) {
        if (item.line === line) {
          return item;
        }
        if (item.children.length > 0) {
          const found = findRecursive(item.children);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    return findRecursive(toc);
  }

  /**
   * 获取目录统计信息
   * @param toc 目录结构
   * @returns 统计信息
   */
  public getTocStats(toc: TocItem[]): { total: number; byLevel: Record<number, number> } {
    const stats = { total: 0, byLevel: {} as Record<number, number> };

    const countRecursive = (items: TocItem[]) => {
      for (const item of items) {
        stats.total++;
        stats.byLevel[item.level] = (stats.byLevel[item.level] || 0) + 1;
        if (item.children.length > 0) {
          countRecursive(item.children);
        }
      }
    };

    countRecursive(toc);
    return stats;
  }
} 