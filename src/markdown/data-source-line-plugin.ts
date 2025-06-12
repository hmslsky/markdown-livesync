/**
 * markdown-it 插件：为块级元素注入 data-source-line
 * 
 * 遍历所有块级 token，如果 token 包含 map 信息（源文件行号），
 * 则为其渲染的 HTML 元素添加 data-source-line 属性。
 * 
 * @author hmslsky
 * @version 1.0.0
 */

import type MarkdownIt from 'markdown-it';
import { Logger } from '../utils/logger-util';

export function dataSourceLinePlugin(md: MarkdownIt): void {
  // 保存原始规则
  const originalParagraphOpen = md.renderer.rules.paragraph_open || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalHeadingOpen = md.renderer.rules.heading_open || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalBlockquoteOpen = md.renderer.rules.blockquote_open || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalListItemOpen = md.renderer.rules.list_item_open || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalCodeBlock = md.renderer.rules.code_block || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalFenceOpen = md.renderer.rules.fence || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalTableOpen = md.renderer.rules.table_open || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };
  const originalHrOpen = md.renderer.rules.hr || function(...args) {
    const [tokens, idx, , , self] = args;
    return self.renderToken(tokens, idx, {});
  };

  function addLineAttr(tokens: any[], idx: number, ruleName: string) {
    const token = tokens[idx];
    if (token.map && token.map.length >= 2) {
      const sourceLine = String(token.map[0] + 1);
      token.attrJoin('data-source-line', sourceLine);
      Logger.debug(`[数据源行号] ${ruleName}: 为第${sourceLine}行添加data-source-line`);
    } else {
      Logger.debug(`[数据源行号] ${ruleName}: token没有map信息`);
    }
  }

  // 包装段落
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'paragraph_open');
    return originalParagraphOpen(tokens, idx, options, env, self);
  };

  // 包装标题
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'heading_open');
    return originalHeadingOpen(tokens, idx, options, env, self);
  };

  // 包装引用
  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'blockquote_open');
    return originalBlockquoteOpen(tokens, idx, options, env, self);
  };

  // 包装列表项
  md.renderer.rules.list_item_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'list_item_open');
    return originalListItemOpen(tokens, idx, options, env, self);
  };

  // 包装代码块
  md.renderer.rules.code_block = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'code_block');
    return originalCodeBlock(tokens, idx, options, env, self);
  };

  // 包装围栏代码块
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'fence');
    return originalFenceOpen(tokens, idx, options, env, self);
  };

  // 包装表格
  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'table_open');
    return originalTableOpen(tokens, idx, options, env, self);
  };

  // 包装水平线
  md.renderer.rules.hr = (tokens, idx, options, env, self) => {
    addLineAttr(tokens, idx, 'hr');
    return originalHrOpen(tokens, idx, options, env, self);
  };
} 