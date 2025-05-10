import * as MarkdownIt from 'markdown-it';
import * as path from 'path';
import * as vscode from 'vscode';
import { lineNumberPlugin } from './lineNumberPlugin';

// 定义目录项接口
export interface TocItem {
  level: number;
  text: string;
  slug?: string; // 现在是可选的
}

/**
 * Markdown处理类，负责Markdown到HTML的转换
 */
export class MarkdownProcessor {
  private md: MarkdownIt;

  constructor() {
    // 初始化Markdown-it实例，配置各种插件
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: (str: string, lang: string) => {
        // 代码高亮处理
        return `<pre class="hljs"><code class="${lang}">${this.md.utils.escapeHtml(str)}</code></pre>`;
      }
    });

    // 可以在这里添加更多的Markdown-it插件
    this.configurePlugins();
  }

  /**
   * 配置Markdown-it插件
   */
  private configurePlugins(): void {
    // 添加行号插件，在解析过程中直接添加行号信息
    lineNumberPlugin(this.md);

    // 这里可以添加更多插件，如表格、任务列表等
  }

  /**
   * 将Markdown文本转换为HTML
   *
   * 使用自定义的行号插件，在解析过程中直接添加行号信息，
   * 然后添加必要的包装器和行号指示器。
   */
  public convertToHtml(markdown: string): string {
    // 获取基本HTML，行号插件会在解析过程中直接添加行号信息
    let html = this.md.render(markdown);

    // 将markdown分割成行，用于添加行号指示器
    const markdownLines = markdown.split('\n');
    const totalLines = markdownLines.length;

    // 为HTML添加包装器
    let result = `<div class="markdown-content">`;

    // 添加行号指示器容器
    result += '<div class="line-indicators" style="display:none;">';

    // 为每一行添加行号指示器，ID直接等于行号
    for (let i = 1; i <= totalLines; i++) {
      result += `<div id="indicator-${i}" class="line-indicator"></div>`;
    }

    result += '</div>';

    // 添加内容
    result += html;

    // 关闭包装器
    result += '</div>';

    return result;
  }





  /**
   * 生成目录结构
   *
   * 这个函数解析Markdown文本，提取所有标题并生成目录结构。
   * 它会忽略代码块中的内容，只处理真正的标题。
   *
   * @param {string} markdown - Markdown文本
   * @returns {TocItem[]} - 目录项数组
   */
  public generateToc(markdown: string): TocItem[] {
    const toc: TocItem[] = [];
    const lines = markdown.split('\n');

    // 正则表达式匹配标题行
    const headerRegex = /^(#{1,6})\s+(.+)$/;

    // 跟踪是否在代码块内
    let inCodeBlock = false;
    // 跟踪是否在缩进代码块内
    let inIndentedCodeBlock = false;
    // 跟踪连续空行数量（用于检测缩进代码块的结束）
    let consecutiveEmptyLines = 0;
    // 跟踪前一行是否是列表项
    let previousLineIsList = false;

    // 逐行处理Markdown
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检查是否是空行
      if (trimmedLine === '') {
        consecutiveEmptyLines++;
        // 如果有连续两个空行，认为缩进代码块结束
        if (consecutiveEmptyLines >= 2) {
          inIndentedCodeBlock = false;
        }
        continue;
      } else {
        consecutiveEmptyLines = 0;
      }

      // 检查是否是围栏式代码块的开始或结束
      const fencedCodeBlockMatch = line.match(/^(\s*)(`{3,}|~{3,})(\w*)/);

      if (fencedCodeBlockMatch) {
        // 切换代码块状态
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // 检查是否是缩进式代码块的开始
      if (!inCodeBlock && !inIndentedCodeBlock && line.startsWith('    ') && !previousLineIsList) {
        inIndentedCodeBlock = true;
        continue;
      }

      // 检查是否是列表项
      previousLineIsList = /^\s*[\*\-\+]|\d+\.\s/.test(line);

      // 如果在任何类型的代码块内，跳过此行
      if (inCodeBlock || inIndentedCodeBlock) {
        continue;
      }

      // 匹配标题行
      const match = line.match(headerRegex);
      if (match) {
        const level = match[1].length; // 标题级别 (# = 1, ## = 2, 等)
        const text = match[2].trim();

        // 检查是否是HTML注释中的标题
        const isInHtmlComment = this.isLineInHtmlComment(lines, i);

        // 只有不在HTML注释中的标题才添加到目录
        if (!isInHtmlComment) {
          // 不再使用slug，只使用level和text
          toc.push({ level, text });
        }
      }
    }

    return toc;
  }

  /**
   * 检查行是否在HTML注释中
   *
   * @param {string[]} lines - 所有行
   * @param {number} lineIndex - 当前行索引
   * @returns {boolean} - 是否在HTML注释中
   */
  private isLineInHtmlComment(lines: string[], lineIndex: number): boolean {
    // 向上查找HTML注释开始标记
    let commentStartFound = false;
    for (let i = lineIndex; i >= 0; i--) {
      if (lines[i].includes('<!--')) {
        commentStartFound = true;
        break;
      }
      if (lines[i].includes('-->')) {
        // 找到了结束标记，但没有找到开始标记，所以不在注释中
        return false;
      }
    }

    // 如果找到了开始标记，向下查找结束标记
    if (commentStartFound) {
      // 检查当前行是否包含结束标记
      if (lines[lineIndex].includes('-->')) {
        return false;
      }

      // 向下查找结束标记
      for (let i = lineIndex + 1; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          return true;
        }
      }
    }

    return commentStartFound;
  }



  /**
   * 处理文档中的图片路径，转换为绝对路径
   */
  public resolveImagePaths(html: string, documentUri: vscode.Uri): string {
    const documentDir = path.dirname(documentUri.fsPath);

    // 使用正则表达式替换相对图片路径
    return html.replace(
      /<img\s+src="([^"]+)"/g,
      (match, imgPath) => {
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:')) {
          // 已经是绝对路径或数据URI，不需要处理
          return match;
        }

        // 转换为绝对路径
        const absolutePath = path.resolve(documentDir, imgPath);
        return `<img src="file://${absolutePath}"`;
      }
    );
  }
}
