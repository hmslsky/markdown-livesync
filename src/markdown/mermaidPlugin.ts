/**
 * MarkdownIt Mermaid插件
 *
 * 这个插件识别Markdown中的Mermaid代码块，并将其转换为特殊的HTML结构，
 * 以便在前端使用Mermaid.js进行渲染。
 */

import MarkdownIt = require('markdown-it');

/**
 * 检测Mermaid图表类型和方向
 */
function detectChartType(code: string): { type: string; direction: string } {
  const trimmedCode = code.trim().toLowerCase();
  let type = 'unknown';
  let direction = 'horizontal';

  if (trimmedCode.startsWith('graph') || trimmedCode.startsWith('flowchart')) {
    type = 'flowchart';
    // 检测方向
    if (trimmedCode.includes('td') || trimmedCode.includes('bt')) {
      direction = 'vertical';
    }
  } else if (trimmedCode.startsWith('sequencediagram')) {
    type = 'sequence';
  } else if (trimmedCode.startsWith('gantt')) {
    type = 'gantt';
  } else if (trimmedCode.startsWith('classDiagram')) {
    type = 'class';
  } else if (trimmedCode.startsWith('stateDiagram')) {
    type = 'state';
  } else if (trimmedCode.startsWith('pie')) {
    type = 'pie';
  } else if (trimmedCode.startsWith('journey')) {
    type = 'journey';
  } else if (trimmedCode.startsWith('gitgraph')) {
    type = 'gitgraph';
  } else if (trimmedCode.startsWith('erDiagram')) {
    type = 'er';
  }

  return { type, direction };
}

/**
 * 分析图表复杂度
 */
function analyzeChartComplexity(code: string, chartType: string, direction: string): string {
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  const nodeCount = countNodes(code, chartType);
  const connectionCount = countConnections(code, chartType);

  // 对于纵向图表，使用更严格的复杂度判断
  if (direction === 'vertical') {
    if (nodeCount <= 3 && connectionCount <= 2) {
      return 'simple';
    } else if (nodeCount <= 6 && connectionCount <= 8) {
      return 'medium';
    } else {
      return 'complex';
    }
  }

  // 对于其他图表类型，使用原有的判断逻辑
  if (nodeCount <= 3 && connectionCount <= 3) {
    return 'simple';
  } else if (nodeCount <= 8 && connectionCount <= 10) {
    return 'medium';
  } else {
    return 'complex';
  }
}

/**
 * 计算节点数量
 */
function countNodes(code: string, chartType: string): number {
  switch (chartType) {
    case 'flowchart':
      // 匹配节点定义，如 A[文本] 或 A(文本) 或 A{文本}
      const flowchartNodes = code.match(/\b[A-Za-z0-9_]+[\[\(\{]/g);
      return flowchartNodes ? flowchartNodes.length : 0;

    case 'sequence':
      // 匹配参与者定义
      const participants = code.match(/participant\s+\w+/g);
      return participants ? participants.length : 2; // 至少2个参与者

    case 'class':
      // 匹配类定义
      const classes = code.match(/class\s+\w+/g);
      return classes ? classes.length : 0;

    default:
      // 对于其他类型，简单计算行数作为复杂度指标
      return code.split('\n').filter(line => line.trim().length > 0).length;
  }
}

/**
 * 计算连接数量
 */
function countConnections(code: string, chartType: string): number {
  switch (chartType) {
    case 'flowchart':
      // 匹配箭头连接，如 --> 或 --- 或 ->>
      const flowchartConnections = code.match(/[-=]+[>]+|[-=]+\|/g);
      return flowchartConnections ? flowchartConnections.length : 0;

    case 'sequence':
      // 匹配序列图中的消息
      const messages = code.match(/->>|-->>|->>|->>/g);
      return messages ? messages.length : 0;

    default:
      return 0;
  }
}

/**
 * 为 MarkdownIt 添加Mermaid插件
 *
 * @param md MarkdownIt 实例
 */
export function mermaidPlugin(md: MarkdownIt): void {
  // 保存原始的fence规则
  const originalFence = md.renderer.rules.fence;

  // 重写fence规则以处理Mermaid代码块
  md.renderer.rules.fence = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const langName = info.split(/\s+/g)[0];

    // 检查是否是Mermaid代码块
    if (langName === 'mermaid') {
      // 生成唯一的ID
      const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 获取Mermaid代码内容
      const mermaidCode = token.content.trim();

      // 分析Mermaid代码以确定图表类型、方向和复杂度
      const { type: chartType, direction } = detectChartType(mermaidCode);
      const complexity = analyzeChartComplexity(mermaidCode, chartType, direction);

      // 创建特殊的HTML结构用于Mermaid渲染
      const html = `<div class="mermaid-container" data-line="${token.map ? token.map[0] + 1 : 1}" data-chart-type="${chartType}" data-complexity="${complexity}" data-direction="${direction}">
  <div class="mermaid-controls">
    <button class="mermaid-zoom-in" title="放大">🔍+</button>
    <button class="mermaid-zoom-out" title="缩小">🔍-</button>
    <button class="mermaid-reset" title="重置">↻</button>
    <button class="mermaid-fullscreen" title="全屏">⛶</button>
  </div>
  <div class="mermaid-wrapper">
    <div id="${mermaidId}" class="mermaid" data-mermaid="${encodeURIComponent(mermaidCode)}" data-chart-type="${chartType}" data-complexity="${complexity}" data-direction="${direction}">
      ${md.utils.escapeHtml(mermaidCode)}
    </div>
  </div>
</div>`;

      return html;
    }

    // 如果不是Mermaid代码块，使用原始规则
    if (originalFence) {
      return originalFence(tokens, idx, options, env, self);
    }

    // 如果没有原始规则，使用默认处理
    return self.renderToken(tokens, idx, options);
  };
}
