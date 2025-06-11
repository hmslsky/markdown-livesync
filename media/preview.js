/**
 * Markdown LiveSync 预览脚本
 * 
 * 为VSCode Webview预览面板提供交互功能
 * 包括目录导航、滚动同步、Mermaid图表渲染等
 * 
 * @author hmslsky
 * @version 1.0.0
 */

(function() {
  'use strict';

  // 获取VSCode API
  const vscode = acquireVsCodeApi();
  
  // 全局变量
  let config = {};
  let currentLine = 1;
  let isScrolling = false;
  let scrollTimeout = null;

  /**
   * 初始化函数
   */
  function initialize() {
    console.log('Markdown LiveSync 预览脚本初始化');
    
    // 获取配置
    config = window.markdownLiveSyncConfig || {};
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化Mermaid
    initializeMermaid();
    
    // 初始化目录
    initializeToc();
    
    // 发送就绪消息
    vscode.postMessage({ type: 'ready' });
  }

  /**
   * 设置事件监听器
   */
  function setupEventListeners() {
    // 滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 点击事件
    document.addEventListener('click', handleClick);
    
    // 键盘事件
    document.addEventListener('keydown', handleKeydown);
    
    // 窗口大小变化事件
    window.addEventListener('resize', handleResize);
    
    // VSCode消息监听
    window.addEventListener('message', handleVSCodeMessage);
  }

  /**
   * 处理滚动事件
   */
  function handleScroll() {
    if (isScrolling || !config.preview?.syncScroll) {
      return;
    }

    // 防抖处理
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // 查找当前可见的行
      const visibleLine = findVisibleLine(scrollTop);
      
      if (visibleLine !== currentLine) {
        currentLine = visibleLine;
        
        // 发送滚动消息到VSCode
        vscode.postMessage({
          type: 'scroll',
          line: currentLine,
          scrollTop: scrollTop
        });
        
        // 新增：同步光标到后端
        console.log(`[光标同步] 预览同步到编辑器: 第${currentLine}行`);
        vscode.postMessage({ type: 'sync-cursor', line: currentLine });
        
        // 更新目录高亮
        updateTocHighlight(currentLine);
      }
    }, 100);
  }

  /**
   * 查找当前可见的行
   */
  function findVisibleLine(scrollTop) {
    const indicators = document.querySelectorAll('.line-indicator');
    let visibleLine = 1;
    
    for (let i = 0; i < indicators.length; i++) {
      const indicator = indicators[i];
      const rect = indicator.getBoundingClientRect();
      
      if (rect.top <= window.innerHeight / 2) {
        const match = indicator.id.match(/indicator-(\d+)/);
        if (match) {
          visibleLine = parseInt(match[1]);
        }
      } else {
        break;
      }
    }
    
    return visibleLine;
  }

  /**
   * 处理点击事件
   */
  function handleClick(event) {
    const target = event.target;
    
    // 处理目录点击
    if (target.classList.contains('toc-link')) {
      event.preventDefault();
      const line = parseInt(target.dataset.line);
      if (line) {
        handleTocClick(line);
      }
      return;
    }
    
    // 处理目录折叠按钮点击
    if (target.classList.contains('toc-toggle') || target.parentElement.classList.contains('toc-toggle')) {
      event.preventDefault();
      const button = target.classList.contains('toc-toggle') ? target : target.parentElement;
      toggleTocItem(button.dataset.id);
      return;
    }
    
    // 处理Mermaid控制按钮
    if (target.classList.contains('mermaid-zoom-in')) {
      event.preventDefault();
      zoomMermaid(target, 1.2);
      return;
    }
    
    if (target.classList.contains('mermaid-zoom-out')) {
      event.preventDefault();
      zoomMermaid(target, 0.8);
      return;
    }
    
    if (target.classList.contains('mermaid-reset')) {
      event.preventDefault();
      resetMermaid(target);
      return;
    }
    
    if (target.classList.contains('mermaid-fullscreen')) {
      event.preventDefault();
      toggleMermaidFullscreen(target);
      return;
    }
    
    // 处理普通链接点击
    if (target.tagName === 'A' && target.href) {
      const href = target.href;
      if (href.startsWith('#')) {
        // 内部锚点链接
        event.preventDefault();
        scrollToAnchor(href.substring(1));
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        // 外部链接
        event.preventDefault();
        vscode.postMessage({
          type: 'open-external',
          url: href
        });
      }
    }
  }

  /**
   * 处理键盘事件
   */
  function handleKeydown(event) {
    // Ctrl+F 搜索
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      // 可以实现搜索功能
    }
    
    // Escape 退出全屏
    if (event.key === 'Escape') {
      exitFullscreen();
    }
  }

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    // 重新计算Mermaid图表大小
    const mermaidElements = document.querySelectorAll('.mermaid');
    mermaidElements.forEach(element => {
      if (window.mermaid && window.mermaid.render) {
        // 重新渲染Mermaid图表
        try {
          const graphDefinition = decodeURIComponent(element.dataset.mermaid);
          window.mermaid.render(`mermaid-${Date.now()}`, graphDefinition, (svgCode) => {
            element.innerHTML = svgCode;
          });
        } catch (error) {
          console.error('重新渲染Mermaid图表失败:', error);
        }
      }
    });
  }

  /**
   * 处理来自VSCode的消息
   */
  function handleVSCodeMessage(event) {
    const message = event.data;
    switch (message.type) {
      case 'sync-cursor':
        console.log(`[光标同步] 编辑器同步到预览: 第${message.line + 1}行`);
        syncToCursor(message.line);
        break;
      case 'update-content':
        updatePreviewContent(message.html, message.toc);
        break;
      case 'update-config':
        config = message.config;
        applyConfig();
        break;
      case 'debug-response':
        updateDebugInfo(message.data);
        break;
      default:
        console.log('未知的VSCode消息类型:', message.type);
    }
  }

  /**
   * 同步到光标位置
   */
  function syncToCursor(line) {
    if (!config.preview?.syncScroll) {
      return;
    }
    
    isScrolling = true;
    scrollToLine(line);
    
    setTimeout(() => {
      isScrolling = false;
    }, 500);
  }

  /**
   * 滚动到指定行
   */
  function scrollToLine(line) {
    const indicator = document.getElementById(`indicator-${line}`);
    if (indicator) {
      const rect = indicator.getBoundingClientRect();
      const scrollTop = window.pageYOffset + rect.top - window.innerHeight / 2;
      
      window.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
      
      // 高亮效果
      if (config.preview?.highlightOnScroll) {
        highlightLine(line);
      }
    }
  }

  /**
   * 滚动到锚点
   */
  function scrollToAnchor(anchor) {
    const element = document.getElementById(anchor) || document.querySelector(`[name="${anchor}"]`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  /**
   * 高亮指定行
   */
  function highlightLine(line) {
    // 移除之前的高亮
    const previousHighlight = document.querySelector('.line-highlight');
    if (previousHighlight) {
      previousHighlight.remove();
    }
    
    // 添加新的高亮
    const indicator = document.getElementById(`indicator-${line}`);
    if (indicator) {
      const highlight = document.createElement('div');
      highlight.className = 'line-highlight';
      highlight.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--vscode-editor-selectionBackground);
        opacity: 0.8;
        z-index: 1000;
        animation: fadeOut 2s ease-out forwards;
      `;
      
      const rect = indicator.getBoundingClientRect();
      highlight.style.top = (window.pageYOffset + rect.top) + 'px';
      
      document.body.appendChild(highlight);
    }
  }

  /**
   * 初始化Mermaid
   */
  function initializeMermaid() {
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: false
        }
      });
      
      // 渲染所有Mermaid图表
      renderMermaidDiagrams();
    }
  }

  /**
   * 渲染Mermaid图表
   */
  function renderMermaidDiagrams() {
    const mermaidElements = document.querySelectorAll('.mermaid[data-mermaid]');
    
    mermaidElements.forEach((element, index) => {
      try {
        const graphDefinition = decodeURIComponent(element.dataset.mermaid);
        const id = `mermaid-${Date.now()}-${index}`;
        
        if (window.mermaid && window.mermaid.render) {
          window.mermaid.render(id, graphDefinition, (svgCode) => {
            element.innerHTML = svgCode;
            element.removeAttribute('data-mermaid');
          });
        }
      } catch (error) {
        console.error('渲染Mermaid图表失败:', error);
        element.innerHTML = `<div class="mermaid-error">图表渲染失败: ${error.message}</div>`;
      }
    });
  }

  /**
   * 初始化目录
   */
  function initializeToc() {
    // 设置目录事件监听器
    setupTocEventListeners();
    
    // 初始化目录状态
    initializeTocState();
  }

  /**
   * 设置目录事件监听器
   */
  function setupTocEventListeners() {
    // 全部折叠按钮
    const collapseAllBtn = document.querySelector('.toc-collapse-all');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        collapseAllTocItems();
      });
    }
    
    // 全部展开按钮
    const expandAllBtn = document.querySelector('.toc-expand-all');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        expandAllTocItems();
      });
    }
  }

  /**
   * 初始化目录状态
   */
  function initializeTocState() {
    const tocItems = document.querySelectorAll('.toc-item');
    tocItems.forEach(item => {
      const level = parseInt(item.dataset.level);
      const defaultCollapseLevel = config.toc?.defaultCollapseLevel || 2;
      
      if (level <= defaultCollapseLevel) {
        expandTocItem(item.dataset.id);
      } else {
        collapseTocItem(item.dataset.id);
      }
    });
  }

  // 全局函数，供HTML中的onclick调用
  window.handleTocClick = function(event, line) {
    event.preventDefault();
    vscode.postMessage({
      type: 'toc-click',
      line: line
    });
    // 新增：同步光标到后端
    console.log(`[光标同步] 预览同步到编辑器: 第${line}行`);
    vscode.postMessage({ type: 'sync-cursor', line });
  };

  window.toggleTocItem = function(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
      const isExpanded = item.classList.contains('expanded');
      if (isExpanded) {
        collapseTocItem(id);
      } else {
        expandTocItem(id);
      }
      
      // 发送状态变更消息
      vscode.postMessage({
        type: 'toc-toggle',
        id: id,
        isExpanded: !isExpanded
      });
    }
  };

  /**
   * 展开目录项
   */
  function expandTocItem(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.classList.add('expanded');
      item.classList.remove('collapsed');
      
      const toggle = item.querySelector('.toc-toggle');
      if (toggle) {
        toggle.classList.add('expanded');
        toggle.classList.remove('collapsed');
      }
      
      const children = item.querySelector('.toc-children');
      if (children) {
        children.classList.add('expanded');
        children.classList.remove('collapsed');
      }
    }
  }

  /**
   * 折叠目录项
   */
  function collapseTocItem(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.classList.add('collapsed');
      item.classList.remove('expanded');
      
      const toggle = item.querySelector('.toc-toggle');
      if (toggle) {
        toggle.classList.add('collapsed');
        toggle.classList.remove('expanded');
      }
      
      const children = item.querySelector('.toc-children');
      if (children) {
        children.classList.add('collapsed');
        children.classList.remove('expanded');
      }
    }
  }

  /**
   * 折叠所有目录项
   */
  function collapseAllTocItems() {
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      collapseTocItem(item.dataset.id);
    });
  }

  /**
   * 展开所有目录项
   */
  function expandAllTocItems() {
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      expandTocItem(item.dataset.id);
    });
  }

  /**
   * 更新目录高亮
   */
  function updateTocHighlight(line) {
    // 移除之前的高亮
    const previousActive = document.querySelector('.toc-item.active');
    if (previousActive) {
      previousActive.classList.remove('active');
    }
    
    // 查找对应的目录项
    const tocLinks = document.querySelectorAll('.toc-link[data-line]');
    let activeItem = null;
    
    for (let i = tocLinks.length - 1; i >= 0; i--) {
      const link = tocLinks[i];
      const linkLine = parseInt(link.dataset.line);
      
      if (linkLine <= line) {
        activeItem = link.closest('.toc-item');
        break;
      }
    }
    
    if (activeItem) {
      activeItem.classList.add('active');
      
      // 确保活动项可见
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }

  /**
   * 处理目录点击
   */
  function handleTocClick(line) {
    vscode.postMessage({ type: 'toc-click', line });
    // 新增：同步光标到后端
    console.log(`[光标同步] 预览同步到编辑器: 第${line}行`);
    vscode.postMessage({ type: 'sync-cursor', line });
  }

  /**
   * Mermaid图表缩放
   */
  function zoomMermaid(button, scale) {
    const container = button.closest('.mermaid-container');
    const mermaid = container.querySelector('.mermaid');
    
    if (mermaid) {
      const currentScale = parseFloat(mermaid.dataset.scale || '1');
      const newScale = currentScale * scale;
      
      mermaid.style.transform = `scale(${newScale})`;
      mermaid.dataset.scale = newScale.toString();
    }
  }

  /**
   * 重置Mermaid图表
   */
  function resetMermaid(button) {
    const container = button.closest('.mermaid-container');
    const mermaid = container.querySelector('.mermaid');
    
    if (mermaid) {
      mermaid.style.transform = 'scale(1)';
      mermaid.dataset.scale = '1';
    }
  }

  /**
   * 切换Mermaid全屏
   */
  function toggleMermaidFullscreen(button) {
    const container = button.closest('.mermaid-container');
    
    if (container.classList.contains('fullscreen')) {
      exitFullscreen();
    } else {
      enterFullscreen(container);
    }
  }

  /**
   * 进入全屏模式
   */
  function enterFullscreen(element) {
    element.classList.add('fullscreen');
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;
      background: var(--vscode-editor-background);
    `;
    
    document.body.style.overflow = 'hidden';
  }

  /**
   * 退出全屏模式
   */
  function exitFullscreen() {
    const fullscreenElement = document.querySelector('.fullscreen');
    if (fullscreenElement) {
      fullscreenElement.classList.remove('fullscreen');
      fullscreenElement.style.cssText = '';
      document.body.style.overflow = '';
    }
  }

  /**
   * 应用配置
   */
  function applyConfig() {
    // 应用主题配置
    if (config.theme) {
      document.documentElement.style.setProperty('--font-size', config.theme.fontSize + 'px');
      if (config.theme.fontFamily) {
        document.documentElement.style.setProperty('--font-family', config.theme.fontFamily);
      }
      document.documentElement.style.setProperty('--line-height', config.theme.lineHeight);
    }
    
    // 应用目录配置
    if (config.toc && !config.toc.showToggleButton) {
      const toggleButtons = document.querySelectorAll('.toc-toggle');
      toggleButtons.forEach(button => {
        button.style.display = 'none';
      });
    }
  }

  /**
   * 更新调试信息
   */
  function updateDebugInfo(data) {
    const debugInfo = document.querySelector('.debug-info');
    if (debugInfo) {
      debugInfo.innerHTML = `
        <p>文档: ${data.document || '无'}</p>
        <p>行数: ${data.lineCount || 0}</p>
        <p>当前行: ${currentLine}</p>
        <p>配置: ${JSON.stringify(data.config, null, 2)}</p>
      `;
    }
  }

  function updatePreviewContent(html, toc) {
    // 更新内容区域
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
      contentContainer.innerHTML = html;
    }
    // 更新目录区域
    const tocContent = document.querySelector('.toc-content');
    if (tocContent && typeof window.renderTocHtml === 'function') {
      tocContent.innerHTML = window.renderTocHtml(toc);
    }
    // 重新初始化目录和Mermaid
    initializeToc();
    initializeMermaid();
  }

  // 添加CSS动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      0% { opacity: 0.8; }
      100% { opacity: 0; }
    }
    
    .mermaid-error {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
