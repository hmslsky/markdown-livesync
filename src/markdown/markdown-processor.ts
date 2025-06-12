/**
 * Markdown处理器模块
 *
 * MarkdownProcessor是插件的内容转换核心，基于markdown-it库实现
 * 负责将Markdown文本转换为HTML，支持多种扩展插件
 * 
 * 核心功能：
 * 1. Markdown到HTML的转换：使用markdown-it引擎进行基础转换
 * 2. 插件系统：支持Mermaid图表、行号标记等扩展功能
 * 3. 配置管理：支持typographer、linkify等高级特性
 * 4. 同步支持：通过data-source-line属性支持编辑器同步
 * 
 * 插件架构：
 * - mermaidPlugin：支持Mermaid图表渲染
 * - dataSourceLinePlugin：为HTML元素添加行号标记，支持双向同步
 * 
 * markdown-it配置：
 * - html: true - 允许HTML标签
 * - linkify: true - 自动转换URL为链接
 * - typographer: true - 启用排版优化（引号、省略号等）
 * 
 * @author hmslsky
 * @version 1.0.2
 * @since 0.0.1
 */

import markdownIt from 'markdown-it';
import { Logger } from '../utils/logger-util';
import { mermaidPlugin } from './mermaid-plugin';
import { dataSourceLinePlugin } from './data-source-line-plugin';

/**
 * Markdown处理器类
 * 
 * 采用单例模式管理markdown-it实例，确保全局配置一致性
 * 
 * 设计特点：
 * - 单例模式：确保全局只有一个处理器实例，避免重复初始化
 * - 插件化：支持动态加载和配置各种markdown-it插件
 * - 性能优化：复用markdown-it实例，避免重复创建和配置
 * - 调试支持：集成详细的日志记录，便于问题排查
 * 
 * 转换流程：
 * 1. 接收Markdown源码
 * 2. 通过markdown-it引擎解析
 * 3. 应用已注册的插件（Mermaid、行号标记等）
 * 4. 生成带有扩展功能的HTML
 * 5. 返回包含同步标记的最终HTML
 */
export class MarkdownProcessor {
  /** 单例实例引用 */
  private static instance: MarkdownProcessor;
  
  /** markdown-it解析器实例，核心转换引擎 */
  private md: markdownIt;

  /**
   * 私有构造函数
   * 
   * 单例模式实现，初始化markdown-it实例并配置插件
   * 
   * 初始化流程：
   * 1. 创建markdown-it实例并配置基础选项
   * 2. 注册Mermaid图表插件
   * 3. 注册行号标记插件（用于同步功能）
   */
  private constructor() {
    // 创建markdown-it实例并配置基础选项
    this.md = new markdownIt({
      html: true,           // 允许HTML标签，支持富文本内容
      linkify: true,        // 自动将URL转换为链接
      typographer: true     // 启用排版优化，如智能引号、省略号等
    });

    // 应用Mermaid图表插件
    // 支持在Markdown中嵌入流程图、序列图等各种图表
    (this.md as any).use(mermaidPlugin);
    
    // 应用行号标记插件
    // 为HTML元素添加data-source-line属性，实现编辑器与预览的双向同步
    (this.md as any).use(dataSourceLinePlugin);
  }

  /**
   * 获取处理器实例
   * 
   * 单例模式的访问点，确保全局只有一个MarkdownProcessor实例
   * 
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
   * 
   * 这是处理器的核心方法，将Markdown源码转换为带有扩展功能的HTML
   * 
   * 转换过程：
   * 1. 记录转换开始和内容长度
   * 2. 调用markdown-it的render方法进行转换
   * 3. 验证生成的HTML中是否包含同步标记
   * 4. 记录转换结果和性能数据
   * 
   * 同步标记验证：
   * 检查生成的HTML中是否包含data-source-line属性，
   * 这些属性是实现编辑器与预览双向同步的关键
   * 
   * @param markdown Markdown源码文本
   * @returns 转换后的HTML字符串，包含同步标记和扩展功能
   * @throws {Error} 当转换过程中发生错误时抛出异常
   */
  public convertToHtml(markdown: string): string {
    try {
      Logger.debug(`[Markdown处理] 开始转换，内容长度: ${markdown.length}`);
      
      // 执行Markdown到HTML的转换
      const html = this.md.render(markdown);
      
      // 验证同步标记的存在性
      // data-source-line属性是双向同步功能的核心
      const dataSourceLineMatches = html.match(/data-source-line="[^"]*"/g);
      if (dataSourceLineMatches) {
        Logger.debug(`[Markdown处理] HTML中包含${dataSourceLineMatches.length}个data-source-line属性`);
        // 记录每个同步标记的详细信息（调试用）
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
   * 
   * 提供对底层markdown-it实例的直接访问，供高级用户使用
   * 可以用于：
   * 1. 动态添加新的插件
   * 2. 修改渲染规则
   * 3. 访问解析器的内部状态
   * 4. 执行自定义的渲染操作
   * 
   * 注意：直接修改实例可能会影响全局的转换行为
   * 
   * @returns markdown-it解析器实例
   */
  public getMarkdownIt(): markdownIt {
    return this.md;
  }
} 