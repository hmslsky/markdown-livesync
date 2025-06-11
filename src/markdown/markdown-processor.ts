/**
 * Markdown处理器
 *
 * 负责将Markdown文本转换为HTML，支持插件扩展
 *
 * @author hmslsky
 * @version 1.0.0
 */

import * as markdownIt from 'markdown-it';
import { Logger } from '../utils/logger-util';
import { mermaidPlugin } from './mermaid-plugin';
import { lineNumberPlugin } from './line-number-plugin';

/**
 * Markdown处理器类
 */
export class MarkdownProcessor {
  private static instance: MarkdownProcessor;
  private md: markdownIt;

  /**
   * 私有构造函数
   */
  private constructor() {
    this.md = new markdownIt({
      html: true,
      linkify: true,
      typographer: true
    });

    // 注册插件
    (this.md as any).use(mermaidPlugin);
    (this.md as any).use(lineNumberPlugin);
  }

  /**
   * 获取处理器实例（单例模式）
   * @returns MarkdownProcessor实例
   */
  public static getInstance(): MarkdownProcessor {
    if (!MarkdownProcessor.instance) {
      MarkdownProcessor.instance = new MarkdownProcessor();
    }
    return MarkdownProcessor.instance;
  }

  /**
   * 将Markdown文本转换为HTML
   * @param markdown Markdown文本
   * @returns HTML字符串
   */
  public convertToHtml(markdown: string): string {
    try {
      const html = this.md.render(markdown);
      return html;
    } catch (error) {
      Logger.error('Markdown转换失败: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取markdown-it实例
   * @returns markdown-it实例
   */
  public getMarkdownIt(): markdownIt {
    return this.md;
  }
} 