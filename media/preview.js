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
  let currentLine = 1;              // 当前行号
  let isScrolling = false;          // 是否正在滚动
  let scrollTimeout = null;         // 滚动超时定时器
  let currentTheme = 'vscode';      // 默认主题
  let tocFloating = false;          // 目录是否浮动
  let tocVisible = false;           // 目录是否可见
  
  // 同步控制变量
  let lastSyncTime = 0;             // 上次同步时间
  let syncDebounceTimeout = null;  // 同步防抖定时器
  const MIN_SYNC_INTERVAL = 50;    // 最小同步间隔50ms
  const SYNC_DEBOUNCE_DELAY = 30;  // 防抖延迟30ms

  /**
   * 初始化函数
   */
  function initialize() {
    console.log('Markdown LiveSync 预览脚本初始化');
    
    // 获取配置
    config = window.markdownLiveSyncConfig || {};
    
    // 初始化主题
    initializeThemeAndToc();
    
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
    
    // 初始化代码块增强功能
    initializeCodeBlocks();
    
    // 发送就绪消息
    vscode.postMessage({ type: 'ready' });
  }

  /**
   * 初始化主题系统
   * 包括主题切换、主题目录头部控制按钮、系统主题变化监听等
   */
  function initializeThemeAndToc() {
    console.log('[主题] 开始初始化主题系统');
    
    // 等待DOM和样式表完全加载
    const waitForStylesheets = () => {
      return new Promise((resolve) => {
        const lightTheme = document.getElementById('github-light-theme');
        const darkTheme = document.getElementById('github-dark-theme');
        
        if (!lightTheme || !darkTheme) {
          console.log('[主题] 样式表尚未加载，等待中...');
          setTimeout(() => waitForStylesheets().then(resolve), 50);
          return;
        }
        
        // 检查样式表是否已加载
        const checkLoaded = () => {
          const lightLoaded = lightTheme.sheet !== null;
          const darkLoaded = darkTheme.sheet !== null;
          
          console.log(`[主题] 样式表加载状态 - Light: ${lightLoaded}, Dark: ${darkLoaded}`);
          
          if (lightLoaded && darkLoaded) {
            resolve();
          } else {
            // 添加加载事件监听器
            if (!lightLoaded) {
              lightTheme.addEventListener('load', checkLoaded, { once: true });
            }
            if (!darkLoaded) {
              darkTheme.addEventListener('load', checkLoaded, { once: true });
            }
            // 添加超时保护
            setTimeout(resolve, 2000);
          }
        };
        
        checkLoaded();
      });
    };
    
    waitForStylesheets().then(() => {
      console.log('[主题] 样式表加载完成，开始初始化主题');
      
      // 优先使用配置中的主题设置，然后是localStorage，最后是默认值
      let initialTheme = 'vscode'; // 默认使用vscode主题
      
      if (config && config.theme && config.theme.current) {
        initialTheme = config.theme.current;
        console.log(`[主题] 使用配置中的主题: ${initialTheme}`);
      } else {
        const savedTheme = localStorage.getItem('markdown-livesync-theme');
        if (savedTheme) {
          initialTheme = savedTheme;
          console.log(`[主题] 使用localStorage中的主题: ${initialTheme}`);
        } else {
          console.log(`[主题] 使用默认主题: ${initialTheme}`);
        }
      }
      
      setTheme(initialTheme);
      
      // 监听系统主题变化（仅在vscode主题模式下）
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          if (currentTheme === 'vscode') {
            console.log(`[主题] 系统主题变化: ${e.matches ? '深色' : '浅色'}`);
            setTheme('vscode'); // 重新应用vscode主题以响应系统变化
          }
        });
      }
      
      console.log('[主题] 主题系统初始化完成');
      
      // 创建目录头部控制按钮
      createTocHeaderControls();
    });
  }

  /**
   * 创建目录头部控制按钮
   */
  function createTocHeaderControls() {
    const tocHeader = document.querySelector('.toc-header');
    if (!tocHeader) return;
    
    // 清空现有内容，重新构建布局
    tocHeader.innerHTML = '';
    
    // 设置头部容器的flex布局样式
    tocHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    `;
    
    // 1. 左侧：TOC标题
    const tocTitle = document.createElement('h3');
    tocTitle.textContent = 'TOC';
    tocTitle.style.cssText = `
      margin: 0;
      font-size: 19px;
      font-weight: 750;
      color: var(--vscode-editor-foreground);
    `;
    tocHeader.appendChild(tocTitle);
    
    // 2. 中间：功能按钮组容器
    const middleControls = document.createElement('div');
    middleControls.className = 'toc-middle-controls';
    middleControls.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1px;
      justify-content: center;
      flex: 1;
    `;
    
    // 2.1 分级展开按钮组
    const levelControlsContainer = document.createElement('div');
    levelControlsContainer.className = 'toc-level-controls';
    levelControlsContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    
    [1, 2, 3].forEach((level) => {
      const btn = document.createElement('button');
      btn.className = 'toc-level-control';
      btn.textContent = level;
      btn.title = `展开到${level}级标题`;
      btn.onclick = () => expandToLevel(level);
      btn.style.cssText = `
        background: rgba(214, 227, 227, 0.84);
        border: 1px solid var(--vscode-panel-border);
        color:rgb(23, 14, 14);
        cursor: pointer;
        padding: 2px 2px;
        font-size: 12px;
        min-width: 28px;
        border-radius: 14px;
        transition: all 0.2s ease;
        font-weight: 500;
      `;
      
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = 'rgba(133, 140, 140, 0.84)';
        btn.style.transform = 'scale(1.08)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'rgba(214, 227, 227, 0.84)';
        btn.style.transform = 'scale(1)';
      });
      
      levelControlsContainer.appendChild(btn);
    });
    
    middleControls.appendChild(levelControlsContainer);
    
    // 2.2 全部展开/收起按钮
    const expandCollapseBtn = document.createElement('button');
    expandCollapseBtn.className = 'toc-expand-collapse';
    expandCollapseBtn.title = '全部展开/收起';
    let expanded = true;
    expandCollapseBtn.innerHTML = expanded ? '📂' : '📁';
    expandCollapseBtn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      transition: opacity 0.2s ease;
      color: var(--vscode-foreground);
    `;
    expandCollapseBtn.onclick = function() {
      expanded = !expanded;
      if (expanded) {
        expandAllTocItems();
        expandCollapseBtn.innerHTML = '📂';
      } else {
        collapseAllTocItems();
        expandCollapseBtn.innerHTML = '📁';
      }
    };
    
    expandCollapseBtn.addEventListener('mouseenter', () => {
      expandCollapseBtn.style.opacity = '0.7';
    });
    
    expandCollapseBtn.addEventListener('mouseleave', () => {
      expandCollapseBtn.style.opacity = '1';
    });
    
    middleControls.appendChild(expandCollapseBtn);
    
    // 2.3 主题切换按钮
    const themeBtn = document.createElement('button');
    themeBtn.className = 'toc-theme-toggle';
    themeBtn.title = '切换主题 (vscode/light/dark)';
    themeBtn.innerHTML = getThemeIcon(currentTheme);
    themeBtn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      transition: opacity 0.2s ease;
      color: var(--vscode-foreground);
    `;
    themeBtn.onclick = function() {
      const themes = ['vscode', 'light', 'dark'];
      const idx = themes.indexOf(currentTheme);
      const next = themes[(idx + 1) % themes.length];
      setTheme(next);
      themeBtn.innerHTML = getThemeIcon(next);
    };
    
    themeBtn.addEventListener('mouseenter', () => {
      themeBtn.style.opacity = '0.7';
    });
    
    themeBtn.addEventListener('mouseleave', () => {
      themeBtn.style.opacity = '1';
    });
    
    middleControls.appendChild(themeBtn);
    
    tocHeader.appendChild(middleControls);
    
    // 3. 右侧：关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toc-close-btn';
    closeBtn.title = '关闭目录';
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      font-size: 17px;
      color:rgb(27, 25, 25);
      transition: opacity 0.2s ease;
    `;
    closeBtn.onclick = function() {
      document.querySelector('.toc-container').classList.add('toc-closed');
      showTocFloatingIcon();
    };
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '0.7';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '1';
    });
    
    tocHeader.appendChild(closeBtn);
  }

  /**
   * 获取主题图标
   */
  function getThemeIcon(theme) {
    if (theme === 'vscode') return '🖥️';
    if (theme === 'light') return '🌞';
    if (theme === 'dark') return '🌙';
    return '🎨';
  }

  /**
   * 显示目录悬浮图标
   */
  function showTocFloatingIcon() {
    let icon = document.querySelector('.toc-floating-icon');
    if (!icon) {
      icon = document.createElement('div');
      icon.className = 'toc-floating-icon';
      icon.title = '展开目录';
      icon.innerHTML = '📋';
      icon.onclick = function() {
        document.querySelector('.toc-container').classList.remove('toc-closed');
        icon.style.display = 'none';
      };
      document.body.appendChild(icon);
    }
    icon.style.display = 'block';
  }

  /**
   * 设置主题
   */
  function setTheme(theme) {
    console.log(`[主题] 开始切换主题到: ${theme}`);
    
    // 调试：检查关键DOM元素是否存在
    const elementsToCheck = ['.markdown-body', '.content-container', '.toc-container', '.container'];
    elementsToCheck.forEach(selector => {
      const element = document.querySelector(selector);
      console.log(`[主题] DOM检查 - ${selector}: ${element ? '存在' : '不存在'}`);
    });
    
    currentTheme = theme;
    localStorage.setItem('markdown-livesync-theme', theme);
    
    // 等待样式表加载完成
    const lightTheme = document.getElementById('github-light-theme');
    const darkTheme = document.getElementById('github-dark-theme');
    
    // 检查样式表是否存在
    if (!lightTheme) {
      console.error('[主题] 错误: 找不到github-light-theme样式表');
      // 尝试重新查找或创建
      setTimeout(() => setTheme(theme), 100);
      return;
    }
    if (!darkTheme) {
      console.error('[主题] 错误: 找不到github-dark-theme样式表');
      // 尝试重新查找或创建
      setTimeout(() => setTheme(theme), 100);
      return;
    }
    
    console.log(`[主题] 找到样式表 - Light: ${lightTheme.href}, Dark: ${darkTheme.href}`);
    console.log(`[主题] 当前样式表状态 - Light disabled: ${lightTheme.disabled}, Dark disabled: ${darkTheme.disabled}`);
    
    // 确保样式表已加载
    const ensureStylesheetLoaded = (stylesheet) => {
      return new Promise((resolve) => {
        if (stylesheet.sheet) {
          resolve();
        } else {
          stylesheet.addEventListener('load', resolve);
          // 添加超时保护
          setTimeout(resolve, 1000);
        }
      });
    };
    
    // 等待两个样式表都加载完成
    Promise.all([
      ensureStylesheetLoaded(lightTheme),
      ensureStylesheetLoaded(darkTheme)
    ]).then(() => {
      console.log('[主题] 样式表加载完成，开始应用主题');
      
      // 设置主题相关的CSS变量和样式表
      if (theme === 'light') {
        // 浅色主题：启用浅色样式表，禁用深色样式表
        lightTheme.disabled = false;
        darkTheme.disabled = true;
        
        // 设置主题属性和类名
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
        document.body.className = 'vscode-light';
        
        console.log('[主题] 应用浅色主题');
      } else if (theme === 'dark') {
        // 深色主题：启用深色样式表，禁用浅色样式表
        lightTheme.disabled = true;
        darkTheme.disabled = false;
        
        // 设置主题属性和类名
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        document.body.className = 'vscode-dark';
        
        console.log('[主题] 应用深色主题');
      } else if (theme === 'vscode') {
        // VSCode主题：根据系统偏好自动选择
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        lightTheme.disabled = prefersDark;
        darkTheme.disabled = !prefersDark;
        
        const actualTheme = prefersDark ? 'dark' : 'light';
        const className = prefersDark ? 'vscode-dark' : 'vscode-light';
        
        // 设置主题属性和类名
        document.documentElement.setAttribute('data-theme', actualTheme);
        document.body.setAttribute('data-theme', actualTheme);
        document.body.className = className;
        
        console.log(`[主题] 应用VSCode主题 - 系统偏好: ${prefersDark ? '深色' : '浅色'}`);
      }
      
      // 强制重新渲染样式 - 确保所有元素都应用新主题
      const tocContainer = document.querySelector('.toc-container');
      if (tocContainer) {
        tocContainer.style.display = 'none';
        tocContainer.offsetHeight; // 触发重排
        tocContainer.style.display = '';
      }
      
      // 强制重新渲染markdown内容 - 关键修复
      const markdownBody = document.querySelector('.markdown-body');
      if (markdownBody) {
        markdownBody.style.display = 'none';
        markdownBody.offsetHeight; // 触发重排
        markdownBody.style.display = '';
        
        // 强制重新计算样式
        const computedStyle = window.getComputedStyle(markdownBody);
        markdownBody.style.visibility = 'hidden';
        markdownBody.offsetHeight;
        markdownBody.style.visibility = 'visible';
      }
      
      // 强制重新渲染整个容器
      const container = document.querySelector('.container');
      if (container) {
        container.style.display = 'none';
        container.offsetHeight; // 触发重排
        container.style.display = 'flex';
      }
      
      // 更新按钮图标
      const themeBtn = document.querySelector('.toc-theme-toggle');
      if (themeBtn) {
        themeBtn.innerHTML = getThemeIcon(theme);
        console.log(`[主题] 更新按钮图标: ${getThemeIcon(theme)}`);
      }
      
      // 更新按钮文本（如果存在旧的theme-toggle按钮）
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        themeToggle.textContent = getThemeDisplayName(theme);
      }
      
      console.log(`[主题] 主题切换完成: ${getThemeDisplayName(theme)}`);
      console.log(`[主题] 最终样式表状态 - Light disabled: ${lightTheme.disabled}, Dark disabled: ${darkTheme.disabled}`);
      console.log(`[主题] 最终html data-theme: ${document.documentElement.getAttribute('data-theme')}`);
      console.log(`[主题] 最终body data-theme: ${document.body.getAttribute('data-theme')}`);
      console.log(`[主题] 最终body className: ${document.body.className}`);
      
      // 验证样式是否正确应用
      setTimeout(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        console.log(`[主题] 验证 - body背景色: ${bodyStyle.backgroundColor}`);
        console.log(`[主题] 验证 - body文字色: ${bodyStyle.color}`);
        
        // 重新查询markdownBody元素（避免作用域问题）
        const currentMarkdownBody = document.querySelector('.markdown-body');
        if (currentMarkdownBody) {
          const markdownBodyStyle = window.getComputedStyle(currentMarkdownBody);
          console.log(`[主题] 验证 - markdown-body背景色: ${markdownBodyStyle.backgroundColor}`);
          console.log(`[主题] 验证 - markdown-body文字色: ${markdownBodyStyle.color}`);
        } else {
          console.warn(`[主题] 警告 - .markdown-body元素不存在`);
        }
        
        // 检查content-container是否存在
        const contentContainer = document.querySelector('.content-container');
        if (contentContainer) {
          const containerStyle = window.getComputedStyle(contentContainer);
          console.log(`[主题] 验证 - content-container背景色: ${containerStyle.backgroundColor}`);
        } else {
          console.warn(`[主题] 警告 - .content-container元素不存在`);
        }
        
        // 检查GitHub样式是否正确应用
        const h1Elements = document.querySelectorAll('.markdown-body h1');
        const h2Elements = document.querySelectorAll('.markdown-body h2');
        const tableElements = document.querySelectorAll('.markdown-body table');
        
        if (h1Elements.length > 0) {
          const h1Style = window.getComputedStyle(h1Elements[0]);
          console.log(`[主题] 验证 - H1边框: ${h1Style.borderBottom}`);
        }
        
        if (h2Elements.length > 0) {
          const h2Style = window.getComputedStyle(h2Elements[0]);
          console.log(`[主题] 验证 - H2边框: ${h2Style.borderBottom}`);
        }
        
        if (tableElements.length > 0) {
          const tableStyle = window.getComputedStyle(tableElements[0]);
          console.log(`[主题] 验证 - 表格边框: ${tableStyle.border}`);
        }
      }, 200);
    });
  }

  /**
   * 获取主题显示名称
   */
  function getThemeDisplayName(theme) {
    const names = {
      'vscode': '🖥️ VSCode',
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
   * 滚动到指定行号对应的内容
   */
  function scrollToLine(line) {
    // 首先尝试通过data-source-line属性查找对应的元素
    const targetElement = document.querySelector(`[data-source-line="${line}"]`);
    
    if (targetElement) {
      // 滚动到目标元素位置
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // 添加临时高亮效果
      targetElement.classList.add('highlight-target');
      setTimeout(() => {
        targetElement.classList.remove('highlight-target');
      }, 2000);
      
      console.log(`[目录] 滚动到第${line}行元素: ${targetElement.tagName}`);
      return;
    }
    
    // 如果没找到精确匹配，尝试查找标题元素
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let targetHeading = null;
    let bestMatch = null;
    let minDistance = Infinity;
    
    // 遍历所有标题，找到最接近的标题
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const headingLine = parseInt(heading.getAttribute('data-source-line'));
      
      if (headingLine) {
        const distance = Math.abs(headingLine - line);
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = heading;
        }
        
        // 如果找到精确匹配，直接使用
        if (headingLine === line) {
          targetHeading = heading;
          break;
        }
      }
    }
    
    // 使用最佳匹配或精确匹配
    const finalTarget = targetHeading || bestMatch;
    
    if (finalTarget) {
      // 滚动到标题位置
      finalTarget.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // 添加临时高亮效果
      finalTarget.classList.add('highlight-target');
      setTimeout(() => {
        finalTarget.classList.remove('highlight-target');
      }, 2000);
      
      const targetLine = finalTarget.getAttribute('data-source-line');
      console.log(`[目录] 滚动到标题: ${finalTarget.textContent} (第${targetLine}行)`);
    } else {
      // 如果都没找到，尝试通过锚点滚动
      const tocLink = document.querySelector(`[data-line="${line}"]`);
      if (tocLink && tocLink.href && tocLink.href.includes('#')) {
        const anchor = tocLink.href.split('#')[1];
        scrollToAnchor(anchor);
        console.log(`[目录] 通过锚点滚动: ${anchor}`);
      } else {
        console.warn(`[目录] 无法找到第${line}行对应的元素`);
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
        background-color: var(--vscode-list-activeSelectionBackground);
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
    
    // 创建目录头部控制按钮（包含智能控制功能）
    createTocHeaderControls();
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
    
    // 首先在预览面板中滚动到对应位置
    scrollToLine(line);
    
    // 然后静默同步编辑器（不抢夺焦点）
    vscode.postMessage({ 
      type: 'toc-click', 
      line: line - 1, // 转换为0基索引
      silent: true // 添加静默标志
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
      background: var(--vscode-editor-background);
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
    
    // 应用主题配置
    if (config.theme && config.theme.current) {
      const configTheme = config.theme.current;
      if (configTheme !== currentTheme) {
        console.log(`[配置] 主题配置变更: ${currentTheme} -> ${configTheme}`);
        setTheme(configTheme);
      }
    }
    
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
      createTocHeaderControls(); // 重新创建头部控件（包含智能控制）
    }
    
    // 重新初始化
    initializeMermaid();
    initializeCodeBlocks(); // 重新初始化代码块
    setupIntersectionObserver();
  }

  /**
   * 初始化代码块增强功能
   * 
   * 为所有代码块添加行号和复制按钮
   */
  function initializeCodeBlocks() {
    console.log('[代码块] 初始化代码块增强功能');
    
    // 查找所有代码块
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach((codeElement, index) => {
      const preElement = codeElement.parentElement;
      if (!preElement || preElement.classList.contains('code-enhanced')) {
        return; // 已经处理过的跳过
      }
      
      // 标记为已处理
      preElement.classList.add('code-enhanced');
      
      // 创建代码块容器
      const codeContainer = document.createElement('div');
      codeContainer.className = 'code-block-container';
      
      // 创建头部工具栏
      const toolbar = document.createElement('div');
      toolbar.className = 'code-block-toolbar';
      
      // 获取语言信息
      const language = getCodeLanguage(codeElement);
      if (language) {
        const langLabel = document.createElement('span');
        langLabel.className = 'code-language';
        langLabel.textContent = language;
        toolbar.appendChild(langLabel);
      }
      
      // 创建复制按钮
      const copyButton = document.createElement('button');
      copyButton.className = 'code-copy-button';
      copyButton.innerHTML = '📋 复制';
      copyButton.title = '复制代码';
      copyButton.onclick = () => copyCodeToClipboard(codeElement, copyButton);
      toolbar.appendChild(copyButton);
      
      // 创建带行号的代码容器
      const codeWrapper = document.createElement('div');
      codeWrapper.className = 'code-wrapper';
      
      // 添加行号
      addLineNumbers(preElement, codeElement);
      
      // 重新组织DOM结构
      preElement.parentNode.insertBefore(codeContainer, preElement);
      codeContainer.appendChild(toolbar);
      codeContainer.appendChild(codeWrapper);
      codeWrapper.appendChild(preElement);
    });
  }

  /**
   * 获取代码块语言
   */
  function getCodeLanguage(codeElement) {
    const classList = codeElement.classList;
    for (let className of classList) {
      if (className.startsWith('language-')) {
        return className.replace('language-', '');
      }
    }
    return null;
  }

  /**
   * 为代码块添加行号
   */
  function addLineNumbers(preElement, codeElement) {
    const code = codeElement.textContent || '';
    const lines = code.split('\n');
    
    // 移除最后一个空行（如果存在）
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    // 创建行号容器
    const lineNumbers = document.createElement('div');
    lineNumbers.className = 'line-numbers';
    
    // 生成行号
    for (let i = 1; i <= lines.length; i++) {
      const lineNumber = document.createElement('span');
      lineNumber.className = 'line-number';
      lineNumber.textContent = i.toString();
      lineNumbers.appendChild(lineNumber);
    }
    
    // 添加行号到代码块
    preElement.classList.add('has-line-numbers');
    preElement.insertBefore(lineNumbers, codeElement);
  }

  /**
   * 复制代码到剪贴板
   */
  async function copyCodeToClipboard(codeElement, button) {
    const code = codeElement.textContent || '';
    
    try {
      // 使用现代剪贴板API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      // 显示复制成功反馈
      const originalText = button.innerHTML;
      button.innerHTML = '✅ 已复制';
      button.classList.add('copied');
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('copied');
      }, 2000);
      
      console.log('[代码块] 代码已复制到剪贴板');
      
    } catch (error) {
      console.error('[代码块] 复制失败:', error);
      
      // 显示复制失败反馈
      const originalText = button.innerHTML;
      button.innerHTML = '❌ 复制失败';
      button.classList.add('copy-failed');
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('copy-failed');
      }, 2000);
    }
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
