/**
 * MarkdownIt 行号插件
 *
 * 这个插件在 Markdown 解析过程中为生成的 HTML 元素添加行号信息。
 * 它跟踪 Markdown 源文本中的行号，并将其添加到对应的 HTML 元素上。
 * 当检测到ID冲突时，先出现的元素ID会添加"-p"后缀，后出现的元素保持正常ID，防止相同ID干扰定位。
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

  // 用于跟踪已使用的ID和对应的token，处理ID冲突
  const idToTokenMap = new Map<string, any>();

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
            // 获取行号作为ID
            const idValue = lineNumber.toString();

            // 检查ID是否已被使用
            if (idToTokenMap.has(idValue)) {
              // 如果ID已被使用，为先前的元素添加"-p"后缀
              const previousToken = idToTokenMap.get(idValue);

              // 查找先前token的id属性并修改
              for (let i = 0; i < previousToken.attrs.length; i++) {
                if (previousToken.attrs[i][0] === 'id' && previousToken.attrs[i][1] === idValue) {
                  previousToken.attrs[i][1] = `${idValue}-p`;
                  break;
                }
              }
            }

            // 添加ID并记录当前token
            token.attrs.push(['id', idValue]);
            idToTokenMap.set(idValue, token);
          }
        }

        // 调用原始规则
        return originalRule(tokens, idx, options, env, self);
      };
    }
  });

  // 添加一个后处理器，确保所有块级元素都有行号
  md.core.ruler.push('add_line_numbers', (state: any) => {
    // 每次处理新文档时重置ID映射
    idToTokenMap.clear();

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
          // 获取行号作为ID
          const idValue = lineNumber.toString();

          // 检查ID是否已被使用
          if (idToTokenMap.has(idValue)) {
            // 如果ID已被使用，为先前的元素添加"-p"后缀
            const previousToken = idToTokenMap.get(idValue);

            // 查找先前token的id属性并修改
            for (let i = 0; i < previousToken.attrs.length; i++) {
              if (previousToken.attrs[i][0] === 'id' && previousToken.attrs[i][1] === idValue) {
                previousToken.attrs[i][1] = `${idValue}-p`;
                break;
              }
            }
          }

          // 添加ID并记录当前token
          token.attrs.push(['id', idValue]);
          idToTokenMap.set(idValue, token);
        }
      }
    }

    return true;
  });
} 