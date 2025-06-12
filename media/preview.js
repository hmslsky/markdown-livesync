/**
 * Markdown LiveSync 预览脚本
 * 
 * 为VSCode Webview预览面板提供交互功能
 * 包括主题切换、目录导航、滚动同步、响应式布局等
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
  let currentTheme = 'light'; // 默认主题
  let tocFloating = false;
  let tocVisible = false;
  
  // 同步控制变量
  let lastSyncTime = 0;
  let syncDebounceTimeout = null;
  const MIN_SYNC_INTERVAL = 50; // 最小同步间隔50ms
  const SYNC_DEBOUNCE_DELAY = 30; // 防抖延迟30ms

  /**
   * 初始化函数
   */
  function initialize() {
    console.log('Markdown LiveSync 预览脚本初始化');
    
    // 获取配置
    config = window.markdownLiveSyncConfig || {};
    
    // 初始化主题
    initializeTheme();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化Mermaid
    initializeMermaid();
    
    // 初始化目录
    initializeToc();
    
    // 设置IntersectionObserver
    setupIntersectionObserver();
    
    // 初始化响应式布局
    initializeResponsiveLayout();
    
    // 发送就绪消息
    vscode.postMessage({ type: 'ready' });
  }

  /**
   * 初始化主题系统
   */
  function initializeTheme() {
    // 从localStorage获取保存的主题，默认为light主题
    const savedTheme = localStorage.getItem('markdown-livesync-theme') || 'light';
    setTheme(savedTheme);
    
    // 创建主题切换按钮
    createThemeToggleButton();
  }

  /**
   * 创建主题切换按钮
   */
  function createThemeToggleButton() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.textContent = getThemeDisplayName(currentTheme);
    themeToggle.title = '切换主题 (Ctrl+Shift+T)';
    
    themeToggle.addEventListener('click', () => {
      const themes = ['light', 'dark'];
      const currentIndex = themes.indexOf(currentTheme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      setTheme(nextTheme);
    });
    
    document.body.appendChild(themeToggle);
  }

  /**
   * 设置主题
   */
  function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('markdown-livesync-theme', theme);
    
    // 切换GitHub样式表
    const lightTheme = document.getElementById('github-light-theme');
    const darkTheme = document.getElementById('github-dark-theme');
    
    if (theme === 'light') {
      lightTheme.disabled = false;
      darkTheme.disabled = true;
    } else {
      lightTheme.disabled = true;
      darkTheme.disabled = false;
    }
    
    // 更新按钮文本
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = getThemeDisplayName(theme);
    }
    
    console.log(`[主题] 切换到${getThemeDisplayName(theme)}主题`);
  }

  /**
   * 获取主题显示名称
   */
  function getThemeDisplayName(theme) {
    const names = {
      'light': '🌞 浅色',
      'dark': '🌙 深色'
    };
    return names[theme] || theme;
  }

  /**
   * 初始化响应式布局
   */
  function initializeResponsiveLayout() {
    checkResponsiveLayout();
    window.addEventListener('resize', checkResponsiveLayout);
  }

  /**
   * 检查响应式布局
   */
  function checkResponsiveLayout() {
    const tocContainer = document.querySelector('.toc-container');
    if (!tocContainer) return;
    
    const shouldFloat = window.innerWidth <= 900;
    
    if (shouldFloat && !tocFloating) {
      // 启用浮动模式
      tocFloating = true;
      tocContainer.classList.add('floating');
      
      // 添加触发器点击事件
      tocContainer.addEventListener('click', handleTocFloatingTrigger);
      
      console.log('[响应式] 启用目录浮动模式');
    } else if (!shouldFloat && tocFloating) {
      // 禁用浮动模式
      tocFloating = false;
      tocVisible = false;
      tocContainer.classList.remove('floating', 'visible');
      tocContainer.removeEventListener('click', handleTocFloatingTrigger);
      
      console.log('[响应式] 禁用目录浮动模式');
    }
  }

  /**
   * 处理浮动目录触发器点击
   */
  function handleTocFloatingTrigger(event) {
    // 只有点击触发器区域时才处理
    if (event.target.closest('.toc-container').classList.contains('floating')) {
      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX;
      
      // 检查是否点击了右侧触发器区域
      if (clickX >= rect.right - 30) {
        event.preventDefault();
        event.stopPropagation();
        toggleTocVisibility();
      }
    }
  }

  /**
   * 切换目录可见性
   */
  function toggleTocVisibility() {
    const tocContainer = document.querySelector('.toc-container');
    if (!tocContainer) return;
    
    if (tocFloating) {
      // 浮动模式：显示/隐藏浮动目录
      tocVisible = !tocVisible;
      
      if (tocVisible) {
        tocContainer.classList.add('visible');
        console.log('[响应式] 显示浮动目录');
      } else {
        tocContainer.classList.remove('visible');
        console.log('[响应式] 隐藏浮动目录');
      }
    } else {
      // 普通模式：折叠/展开目录面板
      const isHidden = tocContainer.classList.contains('hidden');
      
      if (isHidden) {
        tocContainer.classList.remove('hidden');
        console.log('[目录] 显示目录面板');
        
        // 更新图标
        const icon = tocContainer.querySelector('.toc-visibility-icon');
        if (icon) icon.textContent = '👁️';
      } else {
        tocContainer.classList.add('hidden');
        console.log('[目录] 隐藏目录面板');
        
        // 更新图标
        const icon = tocContainer.querySelector('.toc-visibility-icon');
        if (icon) icon.textContent = '👁️‍🗨️';
      }
    }
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
   * 设置IntersectionObserver
   */
  function setupIntersectionObserver() {
    console.log('[滚动同步] 设置IntersectionObserver');
    
    // 检查页面中有多少个data-source-line元素
    const elements = document.querySelectorAll('[data-source-line]');
    console.log(`[滚动同步] 发现${elements.length}个带有data-source-line的元素:`);
    elements.forEach((el, index) => {
      console.log(`[滚动同步] 元素${index + 1}: ${el.tagName} data-source-line="${el.dataset.sourceLine}"`);
    });
    
    if (elements.length === 0) {
      console.warn('[滚动同步] 警告: 没有找到任何带有data-source-line属性的元素！');
      return;
    }
    
    // 优化观察器配置，提高响应性
    const options = { 
      root: null, 
      rootMargin: '-10% 0px -10% 0px', // 调整边距，更精确地检测可见元素
      threshold: [0, 0.1, 0.5] // 多个阈值，提高检测精度
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
      if (isScrolling) {
        console.log('[滚动同步] 跳过IntersectionObserver回调 - 正在滚动中');
        return;
      }
      
      // 防抖处理，避免频繁触发
      const now = Date.now();
      if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        return;
      }
      
      // 清除之前的防抖定时器
      if (syncDebounceTimeout) {
        clearTimeout(syncDebounceTimeout);
      }
      
      // 使用防抖延迟处理
      syncDebounceTimeout = setTimeout(() => {
        let topVisibleElement = null;
        let minTop = Infinity;
        
        console.log(`[滚动同步] IntersectionObserver回调 - ${entries.length}个条目`);
        
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const sourceLine = entry.target.dataset.sourceLine;
            console.log(`[滚动同步] 可见元素: ${entry.target.tagName} line=${sourceLine} top=${rect.top.toFixed(2)}`);
            
            // 选择最接近视口顶部的元素
            if (rect.top >= -50 && rect.top < minTop) { // 允许一定的负值容差
              minTop = rect.top;
              topVisibleElement = entry.target;
            }
          }
        });
        
        if (topVisibleElement) {
          const line = parseInt(topVisibleElement.dataset.sourceLine, 10);
          if (!isNaN(line) && line !== currentLine) {
            console.log(`[滚动同步] 预览同步到编辑器: 从第${currentLine}行 -> 第${line}行`);
            currentLine = line;
            lastSyncTime = Date.now();
            
            // 更新目录高亮
            updateTocHighlight(line);
            
            // 发送同步消息到编辑器
            vscode.postMessage({ 
              type: 'sync-cursor', 
              line: line - 1 // 转换为0基索引
            });
          }
        } else {
          console.log('[滚动同步] 没有找到可见的顶部元素');
        }
      }, SYNC_DEBOUNCE_DELAY);
    }, options);

    elements.forEach((el, index) => {
      observer.observe(el);
      console.log(`[滚动同步] 开始观察元素${index + 1}: ${el.tagName} line=${el.dataset.sourceLine}`);
    });
  }

  /**
   * 处理滚动事件
   */
  function handleScroll() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // 可以在这里处理其他滚动逻辑，但光标同步已由IntersectionObserver负责
    }, 100);
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
    if (target.classList.contains('toc-toggle') || target.classList.contains('toc-toggle-icon')) {
      event.preventDefault();
      const toggleButton = target.classList.contains('toc-toggle') ? target : target.parentElement;
      const itemId = toggleButton.dataset.id;
      if (itemId) {
        toggleTocItem(itemId);
      }
      return;
    }
    
    // 处理目录控制按钮
    if (target.classList.contains('toc-toggle-visibility')) {
      event.preventDefault();
      toggleTocVisibility();
      return;
    }
    
    if (target.classList.contains('toc-collapse-all')) {
      event.preventDefault();
      collapseAllTocItems();
      return;
    }
    
    if (target.classList.contains('toc-expand-all')) {
      event.preventDefault();
      expandAllTocItems();
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
    
    // 如果是浮动目录外的点击，隐藏目录
    if (tocFloating && tocVisible && !target.closest('.toc-container')) {
      toggleTocVisibility();
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
    
    // Escape 退出全屏或隐藏浮动目录
    if (event.key === 'Escape') {
      if (tocFloating && tocVisible) {
        toggleTocVisibility();
      } else {
        exitFullscreen();
      }
    }
    
    // 快捷键切换主题
    if (event.ctrlKey && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        themeToggle.click();
      }
    }
  }

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    // 重新检查响应式布局
    checkResponsiveLayout();
    
    // 重新计算Mermaid图表大小
    const mermaidElements = document.querySelectorAll('.mermaid');
    mermaidElements.forEach(element => {
      if (window.mermaid && window.mermaid.render) {
        // 重新渲染Mermaid图表
      }
    });
  }

  /**
   * 处理VSCode消息
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
    console.log(`[光标同步] 编辑器同步到预览: 第${line + 1}行`);
    
    if (!config.preview?.syncScroll) {
      console.log('[光标同步] 跳过同步 - syncScroll配置已禁用');
      return;
    }
    
    const element = findClosestElement(line);
    if (element) {
      console.log(`[光标同步] 找到目标元素: ${element.tagName} data-source-line="${element.dataset.sourceLine}"`);
      
      // 设置滚动标志，防止反向同步
      isScrolling = true;
      
      // 使用instant滚动减少延迟，但保持居中对齐
      element.scrollIntoView({
        behavior: 'instant', // 改为instant减少延迟
        block: 'center',
      });
      
      // 更新目录高亮
      updateTocHighlight(line + 1);
      
      // 减少滚动锁定时间
      setTimeout(() => { 
        isScrolling = false; 
        console.log('[光标同步] 滚动完成，重新启用预览到编辑器同步');
      }, 100); // 从500ms减少到100ms
    } else {
      console.warn(`[光标同步] 警告: 找不到第${line + 1}行对应的元素`);
    }
  }

  function findClosestElement(line) {
    const elements = document.querySelectorAll('[data-source-line]');
    console.log(`[光标同步] 搜索第${line + 1}行的最近元素，共有${elements.length}个候选元素`);
    
    let closestElement = null;
    let minDiff = Infinity;
    
    elements.forEach((el, index) => {
      const elLine = parseInt(el.dataset.sourceLine, 10);
      if (!isNaN(elLine) && elLine <= line + 1) { // 转换为1基索引进行比较
        const diff = (line + 1) - elLine;
        console.log(`[光标同步] 候选元素${index + 1}: ${el.tagName} line=${elLine} diff=${diff}`);
        if (diff < minDiff) {
          minDiff = diff;
          closestElement = el;
        }
      }
    });
    
    if (closestElement) {
      console.log(`[光标同步] 选中最近元素: ${closestElement.tagName} line=${closestElement.dataset.sourceLine} diff=${minDiff}`);
    } else {
      console.warn(`[光标同步] 警告: 找不到第${line + 1}行或之前的任何元素`);
    }
    
    return closestElement;
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
        background-color: var(--list-active-background);
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
    
    // 初始化智能展开控制
    initializeSmartTocControls();
  }

  /**
   * 设置目录事件监听器
   */
  function setupTocEventListeners() {
    // 注意：这里不再使用querySelector，因为事件委托已在handleClick中处理
    console.log('[目录] 目录事件监听器已通过事件委托设置');
  }

  /**
   * 初始化目录状态
   */
  function initializeTocState() {
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    console.log(`[目录] 初始化${tocItems.length}个目录项的状态`);
    
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

  /**
   * 切换目录项展开/折叠
   */
  function toggleTocItem(id) {
    console.log(`[目录] 切换目录项: ${id}`);
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
  }

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
      
      console.log(`[目录] 展开目录项: ${id}`);
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
      
      console.log(`[目录] 折叠目录项: ${id}`);
    }
  }

  /**
   * 折叠所有目录项
   */
  function collapseAllTocItems() {
    console.log('[目录] 折叠所有目录项');
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      collapseTocItem(item.dataset.id);
    });
  }

  /**
   * 展开所有目录项
   */
  function expandAllTocItems() {
    console.log('[目录] 展开所有目录项');
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      expandTocItem(item.dataset.id);
    });
  }

  /**
   * 初始化智能目录控制
   */
  function initializeSmartTocControls() {
    const tocHeader = document.querySelector('.toc-header');
    if (!tocHeader) return;
    
    // 分析文档中的标题层级
    const availableLevels = analyzeTocLevels();
    
    // 创建智能控制按钮
    createSmartTocControls(tocHeader, availableLevels);
  }

  /**
   * 分析目录中的标题层级
   */
  function analyzeTocLevels() {
    const tocItems = document.querySelectorAll('.toc-item[data-level]');
    const levels = new Set();
    
    tocItems.forEach(item => {
      const level = parseInt(item.dataset.level);
      if (level >= 1 && level <= 6) {
        levels.add(level);
      }
    });
    
    const sortedLevels = Array.from(levels).sort((a, b) => a - b);
    console.log('[目录] 检测到的标题层级:', sortedLevels);
    
    return sortedLevels;
  }

  /**
   * 创建智能目录控制按钮
   */
  function createSmartTocControls(tocHeader, availableLevels) {
    // 查找现有的控制区域
    let controlsContainer = tocHeader.querySelector('.toc-controls');
    
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'toc-controls';
      tocHeader.appendChild(controlsContainer);
    }
    
    // 清除现有的分级控制按钮
    const existingLevelButtons = controlsContainer.querySelectorAll('.toc-level-control');
    existingLevelButtons.forEach(btn => btn.remove());
    
    // 创建分级展开按钮
    if (availableLevels.length > 1) {
      const levelControlsContainer = document.createElement('div');
      levelControlsContainer.className = 'toc-level-controls';
      levelControlsContainer.style.cssText = `
        display: flex;
        gap: 2px;
        margin-left: 8px;
      `;
      
      availableLevels.forEach(level => {
        const button = document.createElement('button');
        button.className = 'toc-level-control';
        button.dataset.level = level.toString();
        button.textContent = level.toString();
        button.title = `展开到${level}级标题`;
        button.style.cssText = `
          background: var(--button-background);
          border: 1px solid var(--border-color);
          color: var(--button-foreground);
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          min-width: 20px;
          transition: all 0.2s ease;
        `;
        
        button.addEventListener('click', (e) => {
          e.preventDefault();
          expandToLevel(level);
        });
        
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = 'var(--button-hover-background)';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.backgroundColor = 'var(--button-background)';
        });
        
        levelControlsContainer.appendChild(button);
      });
      
      // 插入到现有控制按钮之前
      const firstButton = controlsContainer.querySelector('button');
      if (firstButton) {
        controlsContainer.insertBefore(levelControlsContainer, firstButton);
      } else {
        controlsContainer.appendChild(levelControlsContainer);
      }
    }
  }

  /**
   * 展开到指定层级
   */
  function expandToLevel(targetLevel) {
    console.log(`[目录] 展开到${targetLevel}级标题`);
    
    const tocItems = document.querySelectorAll('.toc-item[data-level]');
    
    tocItems.forEach(item => {
      const itemLevel = parseInt(item.dataset.level);
      const itemId = item.dataset.id;
      
      if (itemLevel <= targetLevel) {
        expandTocItem(itemId);
      } else {
        collapseTocItem(itemId);
      }
    });
    
    // 发送消息到后端保存状态
    vscode.postMessage({
      type: 'toc-expand-to-level',
      level: targetLevel
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
      
      // 确保活动项可见，使用instant滚动减少延迟
      activeItem.scrollIntoView({
        behavior: 'instant', // 改为instant减少延迟
        block: 'nearest'
      });
      
      console.log(`[目录] 高亮目录项: line=${line}`);
    }
  }

  /**
   * 处理目录点击
   */
  function handleTocClick(line) {
    console.log(`[目录] 点击目录项: 第${line}行`);
    vscode.postMessage({ 
      type: 'toc-click', 
      line: line - 1 // 转换为0基索引
    });
    
    // 如果是浮动目录，点击后隐藏
    if (tocFloating && tocVisible) {
      setTimeout(() => {
        toggleTocVisibility();
      }, 300);
    }
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
   * 进入全屏
   */
  function enterFullscreen(element) {
    element.classList.add('fullscreen');
    
    // 添加全屏样式
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;
      background: var(--background-color);
    `;
  }

  /**
   * 退出全屏
   */
  function exitFullscreen() {
    const fullscreenElement = document.querySelector('.fullscreen');
    if (fullscreenElement) {
      fullscreenElement.classList.remove('fullscreen');
      fullscreenElement.style.cssText = '';
    }
  }

  /**
   * 应用配置
   */
  function applyConfig() {
    console.log('[配置] 应用新配置:', config);
    
    // 重新初始化目录状态
    if (config.toc) {
      initializeTocState();
    }
    
    // 重新设置滚动同步
    if (config.preview) {
      setupIntersectionObserver();
    }
  }

  /**
   * 更新调试信息
   */
  function updateDebugInfo(data) {
    const debugInfo = document.querySelector('.debug-info');
    if (debugInfo && data) {
      debugInfo.innerHTML = Object.entries(data)
        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
        .join('');
    }
  }

  /**
   * 更新预览内容
   */
  function updatePreviewContent(html, toc) {
    console.log('[内容更新] 更新预览内容');
    
    // 更新HTML内容
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer && html) {
      contentContainer.innerHTML = html;
    }
    
    // 更新目录
    const tocContent = document.querySelector('.toc-content');
    if (tocContent && toc) {
      tocContent.innerHTML = toc;
      initializeTocState();
      initializeSmartTocControls(); // 重新初始化智能控制
    }
    
    // 重新初始化
    initializeMermaid();
    setupIntersectionObserver();
  }

  // 当DOM加载完成时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // 导出全局函数供HTML使用（向后兼容）
  window.handleTocClick = function(event, line) {
    event.preventDefault();
    handleTocClick(line);
  };

  window.toggleTocItem = function(id) {
    toggleTocItem(id);
  };

})();
