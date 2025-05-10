import * as MarkdownIt from 'markdown-it';
import * as path from 'path';
import * as vscode from 'vscode';

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
    // 这里可以添加更多插件，如表格、任务列表等
  }

  /**
   * 将Markdown文本转换为HTML
   */
  public convertToHtml(markdown: string): string {
    // 获取基本HTML
    let html = this.md.render(markdown);

    // 添加行号标记
    html = this.addLineMarkers(markdown, html);

    return html;
  }

  /**
   * 为HTML添加行号标记
   *
   * 这个函数会在HTML中插入行号标记，以便在预览中可以精确定位到对应的行。
   * 它使用更精确的方法为HTML中的每一行内容添加行号标记，确保每一行都有对应的行号。
   *
   * 改进的工作原理：
   * 1. 将Markdown文本分割成行
   * 2. 为HTML中的每一行内容添加行号标记
   * 3. 使用特殊的行号标记元素，确保每一行都可以被精确定位
   *
   * 这些行号标记将被客户端用于：
   * - 在编辑器光标移动时，精确滚动预览到对应位置
   * - 提供更准确的编辑器与预览之间的同步
   *
   * @param {string} markdown - 原始Markdown文本
   * @param {string} html - 转换后的HTML
   * @returns {string} - 添加了行号标记的HTML
   */
  private addLineMarkers(markdown: string, html: string): string {
    // 将markdown分割成行
    const markdownLines = markdown.split('\n');
    const totalLines = markdownLines.length;

    // 为HTML添加一个包含所有行号的数据属性的包装器
    let result = `<div data-total-lines="${totalLines}" class="markdown-content">`;

    // 添加行号指示器容器
    result += '<div class="line-indicators" style="display:none;">';

    // 为每一行添加行号指示器
    for (let i = 1; i <= totalLines; i++) {
      result += `<div id="line-indicator-${i}" data-line="${i}" class="line-indicator"></div>`;
    }

    result += '</div>';

    // 添加内容，并为每个块级元素添加行号属性
    result += this.addLineNumbersToContent(html, markdownLines);

    // 关闭包装器
    result += '</div>';

    return result;
  }

  /**
   * 为HTML内容添加行号标记
   *
   * @param {string} html - HTML内容
   * @param {string[]} markdownLines - Markdown文本的行数组
   * @returns {string} - 添加了行号标记的HTML
   */
  private addLineNumbersToContent(html: string, markdownLines: string[]): string {
    let result = html;

    // 为常见的块级元素添加data-line属性
    const blockElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'pre', 'blockquote', 'table', 'div', 'li', 'code'];

    // 创建一个映射，用于跟踪Markdown中的元素位置
    // 这个映射将帮助我们确定每个HTML元素对应的Markdown行号
    const elementLineMap = this.analyzeMarkdownStructure(markdownLines);

    // 当前处理的元素索引
    let elementIndex = 0;

    // 第一步：为所有块级元素添加行号属性
    blockElements.forEach(tag => {
      // 使用正则表达式查找没有data-line属性的标签
      const regex = new RegExp(`<${tag}(?![^>]*data-line)[^>]*>`, 'g');

      // 替换匹配的标签，添加data-line属性
      result = result.replace(regex, match => {
        // 获取当前元素的行号信息
        const elementInfo = elementLineMap[elementIndex] || { start: elementIndex + 1, end: elementIndex + 1 };
        elementIndex++;

        // 使用元素的起始行号作为主要行号
        const lineStr = elementInfo.start.toString();
        const endLineStr = elementInfo.end.toString();

        // 添加多个行号相关属性，便于客户端使用不同的查找策略
        // 现在包含起始行号和结束行号，以支持块内换行
        const newTag = `${match.slice(0, -1)} data-line="${lineStr}" data-line-start="${lineStr}" data-line-end="${endLineStr}" id="line-${lineStr}">`;
        return newTag;
      });
    });

    // 第二步：插入行号标记到HTML内容中
    let finalResult = '';
    let currentPos = 0;
    let inTag = false;
    let inScript = false;
    let inStyle = false;
    let inPreCode = false;

    // 初始化行号计数器
    let currentLineNumber = 1;

    // 逐字符处理HTML
    for (let i = 0; i < result.length; i++) {
      const char = result[i];

      // 检测是否在标签内
      if (char === '<') {
        inTag = true;

        // 检查是否进入pre或code标签
        if (result.substring(i, i + 5) === '<pre>' || result.substring(i, i + 6) === '<code>') {
          inPreCode = true;
        }
        // 检查是否退出pre或code标签
        else if (result.substring(i, i + 6) === '</pre>' || result.substring(i, i + 7) === '</code>') {
          inPreCode = false;
        }
        // 检查是否进入script标签
        else if (result.substring(i, i + 8) === '<script>') {
          inScript = true;
        }
        // 检查是否退出script标签
        else if (result.substring(i, i + 9) === '</script>') {
          inScript = false;
        }
        // 检查是否进入style标签
        else if (result.substring(i, i + 7) === '<style>') {
          inStyle = true;
        }
        // 检查是否退出style标签
        else if (result.substring(i, i + 8) === '</style>') {
          inStyle = false;
        }
      } else if (char === '>') {
        inTag = false;
      }
      // 如果是换行符，且不在标签、脚本、样式或预格式化代码内
      else if (char === '\n' && !inTag && !inScript && !inStyle && !inPreCode) {
        // 在换行符前添加行号标记
        const lineStr = currentLineNumber.toString();
        finalResult += result.substring(currentPos, i);
        finalResult += `<span class="line-marker" data-line="${lineStr}" id="line-exact-${lineStr}"></span>\n`;
        currentPos = i + 1;
        currentLineNumber++;
      }
    }

    // 添加剩余的内容
    if (currentPos < result.length) {
      finalResult += result.substring(currentPos);
    }

    // 如果处理失败，返回原始HTML
    if (!finalResult) {
      return result;
    }

    // 第三步：确保每一行都有行号标记
    // 这是一个额外的保障措施，确保即使上面的处理失败，每一行仍然有行号标记
    let enhancedResult = '';
    const htmlLines = finalResult.split('\n');

    for (let i = 0; i < htmlLines.length; i++) {
      const line = htmlLines[i];
      const lineStr = (i + 1).toString();

      // 如果行不包含行号标记，添加一个
      if (!line.includes('line-exact-') && !line.includes('data-line=')) {
        enhancedResult += `<span class="line-marker" data-line="${lineStr}" id="line-exact-${lineStr}"></span>${line}\n`;
      } else {
        enhancedResult += line + '\n';
      }
    }

    return enhancedResult;
  }

  /**
   * 分析Markdown结构，创建元素行号映射
   *
   * 这个方法分析Markdown文本，识别块级元素的位置，并创建一个映射，
   * 将每个块级元素与其在Markdown中的行号范围关联起来。
   * 每一行内容（包括代码块标记和代码块内容）都会被计入行号统计。
   *
   * @param {string[]} markdownLines - Markdown文本的行数组
   * @returns {Array<{start: number, end: number}>} - 元素行号映射数组
   */
  private analyzeMarkdownStructure(markdownLines: string[]): Array<{start: number, end: number}> {
    const elementLineMap: Array<{start: number, end: number}> = [];

    // 跟踪当前处理的行号
    let currentLine = 1;

    // 跟踪当前块的开始行号
    let blockStartLine = 1;

    // 跟踪是否在代码块内
    let inCodeBlock = false;
    let codeBlockStartLine = 0;

    // 跟踪空行计数（用于检测段落边界）
    let emptyLineCount = 0;

    // 处理每一行
    for (let i = 0; i < markdownLines.length; i++) {
      const line = markdownLines[i].trim();
      currentLine = i + 1; // 行号从1开始

      // 检查是否是代码块分隔符
      if (line.startsWith('```')) {
        // 代码块开始标记作为单独的元素
        elementLineMap.push({
          start: currentLine,
          end: currentLine
        });

        if (!inCodeBlock) {
          // 进入代码块
          inCodeBlock = true;
          codeBlockStartLine = currentLine;
        } else {
          // 退出代码块，将整个代码块（包括开始和结束标记）作为一个元素
          elementLineMap.push({
            start: codeBlockStartLine,
            end: currentLine
          });
          inCodeBlock = false;
        }
        continue;
      }

      // 如果在代码块内，将每一行作为单独的元素
      if (inCodeBlock) {
        elementLineMap.push({
          start: currentLine,
          end: currentLine
        });
        continue;
      }

      // 检查是否是标题行
      if (line.startsWith('#')) {
        // 添加标题元素
        elementLineMap.push({
          start: currentLine,
          end: currentLine
        });
        blockStartLine = currentLine + 1; // 下一个块从下一行开始
        emptyLineCount = 0;
        continue;
      }

      // 检查是否是列表项
      if (line.match(/^[\*\-\+]|\d+\.\s/)) {
        // 如果前面有空行，这是一个新列表的开始
        if (emptyLineCount > 0) {
          blockStartLine = currentLine;
        }

        // 添加列表项元素
        elementLineMap.push({
          start: currentLine,
          end: currentLine
        });

        emptyLineCount = 0;
        continue;
      }

      // 检查是否是空行
      if (line === '') {
        // 空行也作为单独的元素
        elementLineMap.push({
          start: currentLine,
          end: currentLine
        });

        emptyLineCount++;

        // 如果有连续两个空行，认为是段落边界
        if (emptyLineCount === 2) {
          // 如果有未处理的块，添加它
          if (currentLine - 2 > blockStartLine) {
            elementLineMap.push({
              start: blockStartLine,
              end: currentLine - 2 // 减2是因为有两个空行
            });
          }

          blockStartLine = currentLine + 1; // 下一个块从空行后开始
        }
        continue;
      }

      // 如果是普通文本行
      emptyLineCount = 0;

      // 如果这是块的第一行，记录开始行号
      if (i === 0 || markdownLines[i-1].trim() === '') {
        blockStartLine = currentLine;
      }

      // 将每一行文本作为单独的元素
      elementLineMap.push({
        start: currentLine,
        end: currentLine
      });

      // 如果是最后一行或下一行是空行，这是块的结束
      if (i === markdownLines.length - 1 || markdownLines[i+1].trim() === '') {
        // 添加整个段落作为一个元素
        if (currentLine > blockStartLine) {
          elementLineMap.push({
            start: blockStartLine,
            end: currentLine
          });
        }
      }
    }

    // 确保至少有一个元素
    if (elementLineMap.length === 0) {
      elementLineMap.push({
        start: 1,
        end: Math.max(1, markdownLines.length)
      });
    }

    return elementLineMap;
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
