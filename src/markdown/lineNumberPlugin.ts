/**
 * MarkdownIt 行号插件
 *
 * 这个插件在 Markdown 解析过程中为生成的 HTML 元素添加行号信息。
 * 它跟踪 Markdown 源文本中的行号，并将其添加到对应的 HTML 元素上。
 */

import MarkdownIt = require('markdown-it');

/**
 * 为 MarkdownIt 添加行号插件
 *
 * @param md MarkdownIt 实例
 */
export function lineNumberPlugin(md: MarkdownIt): void {
  // 保存原始的 renderer 规则
  const originalRules = { ...md.renderer.rules };

  // 遍历所有规则类型
  Object.keys(originalRules).forEach(type => {
    const originalRule = originalRules[type];

    if (originalRule) {
      // 替换规则
      md.renderer.rules[type] = (tokens: any[], idx: number, options: any, env: any, self: any) => {
        const token = tokens[idx];

        // 获取 token 的行号
        if (token.map && token.nesting === 1) {
          const lineNumber = token.map[0] + 1;

          // 为开始标签添加 ID 属性
          if (!token.attrs) {
            token.attrs = [];
          }

          // 检查是否已经有 id 属性
          let hasId = false;
          for (let i = 0; i < token.attrs.length; i++) {
            if (token.attrs[i][0] === 'id') {
              hasId = true;
              break;
            }
          }

          // 如果没有 id 属性，添加一个
          if (!hasId) {
            token.attrs.push(['id', lineNumber.toString()]);
          }
        }

        // 调用原始规则
        return originalRule(tokens, idx, options, env, self);
      };
    }
  });

  // 添加一个后处理器，确保所有块级元素都有行号
  md.core.ruler.push('add_line_numbers', (state: any) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // 只处理开始标签
      if (token.nesting === 1 && token.map) {
        const lineNumber = token.map[0] + 1;

        // 确保 token 有 attrs 数组
        if (!token.attrs) {
          token.attrs = [];
        }

        // 检查是否已经有 id 属性
        let hasId = false;
        for (let j = 0; j < token.attrs.length; j++) {
          if (token.attrs[j][0] === 'id') {
            hasId = true;
            break;
          }
        }

        // 如果没有 id 属性，添加一个
        if (!hasId) {
          token.attrs.push(['id', lineNumber.toString()]);
        }
      }
    }

    return true;
  });
}
