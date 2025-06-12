/**
 * Markdown处理器
 *
 * 负责将Markdown文本转换为HTML，支持插件扩展
 *
 * @author hmslsky
 * @version 1.0.0
 */

import markdownIt from 'markdown-it';
import { Logger } from '../utils/logger-util';
import { mermaidPlugin } from './mermaid-plugin';
import { dataSourceLinePlugin } from './data-source-line-plugin';

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

    // 应用插件
    (this.md as any).use(mermaidPlugin);
    (this.md as any).use(dataSourceLinePlugin);
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
      Logger.debug(`[Markdown处理] 开始转换，内容长度: ${markdown.length}`);
      
      const html = this.md.render(markdown);
      
      // 检查生成的HTML中是否包含data-source-line属性
      const dataSourceLineMatches = html.match(/data-source-line="[^"]*"/g);
      if (dataSourceLineMatches) {
        Logger.debug(`[Markdown处理] HTML中包含${dataSourceLineMatches.length}个data-source-line属性`);
        dataSourceLineMatches.forEach((match, index) => {
          Logger.debug(`[Markdown处理] data-source-line ${index + 1}: ${match}`);
        });
      } else {
        Logger.warn('[Markdown处理] 警告: 生成的HTML中没有找到data-source-line属性！');
      }
      
      Logger.debug(`[Markdown处理] 转换完成，HTML长度: ${html.length}`);
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