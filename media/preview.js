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
  let tocFloating = false;          // 目录是否浮动
  let tocVisible = false;           // 目录是否可见
  
  // 同步控制变量
  let lastSyncTime = 0;             // 上次同步时间
  let syncDebounceTimeout = null;  // 同步防抖定时器
  const MIN_SYNC_INTERVAL = 50;    // 最小同步间隔50ms
  const SYNC_DEBOUNCE_DELAY = 30;  // 防抖延迟30ms

  // ==================== 主题系统核心变量 ====================
  
  /**
   * 当前激活的主题名称
   * 可选值：'light' | 'dark'
   * - 'light': 强制使用浅色主题
   * - 'dark': 强制使用深色主题
   */
  let currentTheme = 'light';

  // ==================== 主题系统初始化 ====================

  /**
   * 初始化主题系统和目录控件
   * 
   * 主题系统初始化流程：
   * 1. 等待DOM和CSS样式表完全加载
   * 2. 确定初始主题（优先级：配置 > localStorage > 默认值）
   * 3. 应用初始主题设置
   * 4. 设置系统主题变化监听器
   * 5. 创建目录头部控制按钮
   * 
   * 样式表加载策略：
   * - 使用Promise.all确保所有样式表都已加载
   * - 添加超时保护机制，避免无限等待
   * - 通过stylesheet.sheet属性检测加载状态
   */
  function initializeThemeAndToc() {
    console.log('[主题] 开始初始化主题系统');
    
    /**
     * 等待GitHub样式表加载完成
     * 
     * 加载检测机制：
     * 1. 首先检查DOM中是否存在样式表元素
     * 2. 然后检查stylesheet.sheet属性是否不为null
     * 3. 如果未加载完成，添加load事件监听器
     * 4. 设置2秒超时保护，避免无限等待
     * 
     * @returns Promise<void> 样式表加载完成的Promise
     */
    const waitForStylesheets = () => {
      return new Promise((resolve) => {
        // 获取GitHub官方样式表元素引用
        const lightTheme = document.getElementById('github-light-theme');
        const darkTheme = document.getElementById('github-dark-theme');
        
        // 如果样式表元素不存在，继续等待DOM加载
        if (!lightTheme || !darkTheme) {
          console.log('[主题] 样式表尚未加载，等待中...');
          setTimeout(() => waitForStylesheets().then(resolve), 50);
          return;
        }
        
        /**
         * 检查样式表是否已完全加载
         * 
         * 检测方法：
         * - stylesheet.sheet !== null 表示样式表已加载并可访问
         * - 如果为null，说明样式表仍在加载中
         */
        const checkLoaded = () => {
          const lightLoaded = lightTheme.sheet !== null;
          const darkLoaded = darkTheme.sheet !== null;
          
          console.log(`[主题] 样式表加载状态 - Light: ${lightLoaded}, Dark: ${darkLoaded}`);
          
          if (lightLoaded && darkLoaded) {
            // 所有样式表都已加载完成
            resolve();
          } else {
            // 为未加载的样式表添加load事件监听器
            if (!lightLoaded) {
              lightTheme.addEventListener('load', checkLoaded, { once: true });
            }
            if (!darkLoaded) {
              darkTheme.addEventListener('load', checkLoaded, { once: true });
            }
            // 添加超时保护，避免无限等待
            setTimeout(resolve, 2000);
          }
        };
        
        checkLoaded();
      });
    };

    // 等待样式表加载完成后开始主题初始化
    waitForStylesheets().then(() => {
      console.log('[主题] 样式表加载完成，开始初始化主题');
      
      /**
       * 确定初始主题设置
       * 
       * 优先级顺序：
       * 1. 插件配置中的主题设置（config.theme.current）
       * 2. localStorage中保存的用户偏好
       * 3. 默认值：'light'
       */
      let initialTheme = 'light'; // 默认使用light主题
      
      if (config && config.theme && config.theme.current) {
        // 优先使用插件配置中的主题设置
        initialTheme = config.theme.current;
        console.log(`[主题] 使用配置中的主题: ${initialTheme}`);
      } else {
        // 其次使用localStorage中保存的用户偏好
        const savedTheme = localStorage.getItem('markdown-livesync-theme');
        if (savedTheme) {
          initialTheme = savedTheme;
          console.log(`[主题] 使用localStorage中的主题: ${initialTheme}`);
        } else {
          console.log(`[主题] 使用默认主题: ${initialTheme}`);
        }
      }
      
      // 应用初始主题设置
      setTheme(initialTheme);
      
      // 简化的主题系统不需要监听系统主题变化
      
      console.log('[主题] 主题系统初始化完成');
      
      // 移除重复的createTocHeaderControls()调用
      // 目录头部控件将在initializeToc()中统一创建
    });
  }

  /**
   * 创建目录头部控制按钮
   */
  function createTocHeaderControls() {
    const tocHeader = document.querySelector('.toc-header');
    if (!tocHeader) return;
    
    // 检查是否已经创建了完整的头部控件
    // 如果已存在TOC标题和控制按钮，则跳过重复创建
    const existingTitle = tocHeader.querySelector('h3');
    const existingControls = tocHeader.querySelector('.toc-middle-controls');
    const existingCloseBtn = tocHeader.querySelector('.toc-close-btn');
    
    if (existingTitle && existingControls && existingCloseBtn) {
      console.log('[目录] 头部控件已存在，跳过重复创建');
      return;
    }
    
    console.log('[目录] 创建目录头部控制按钮');
    
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
    
    // 2.1 分级展开按钮组 - 根据实际目录级别动态生成
    const levelControlsContainer = document.createElement('div');
    levelControlsContainer.className = 'toc-level-controls';
    levelControlsContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    
    // 获取当前文档的最大目录级别
    const maxLevel = getMaxTocLevel();
    console.log(`[目录] 检测到最大目录级别: ${maxLevel}`);
    
    // 只生成到最大级别-1的按钮（因为最后一级不需要展开按钮）
    const buttonLevels = Math.max(1, maxLevel - 1);
    for (let level = 1; level <= buttonLevels; level++) {
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
    }
    
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
    themeBtn.title = '切换主题 (浅色/深色)';
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
      const themes = ['light', 'dark'];
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
    if (theme === 'light') return '🌞';
    if (theme === 'dark') return '🌙';
    return '🌞'; // 默认浅色主题图标
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
  // ==================== 主题切换核心函数 ====================

  /**
   * 设置主题
   * 
   * 主题切换完整流程：
   * 1. 验证DOM元素存在性
   * 2. 更新全局主题状态和持久化存储
   * 3. 获取并验证样式表元素
   * 4. 等待样式表加载完成
   * 5. 根据主题类型启用/禁用对应样式表
   * 6. 设置DOM元素的主题属性和CSS类
   * 7. 强制重新渲染关键元素
   * 8. 更新UI控件状态
   * 9. 验证样式应用效果
   * 
   * 支持的主题类型：
   * - 'light': 强制使用浅色主题（GitHub Light）
   * - 'dark': 强制使用深色主题（GitHub Dark）
   * 
   * @param {string} theme 目标主题名称
   */
  function setTheme(theme) {
    console.log(`[主题] 开始切换主题到: ${theme}`);
    
    /**
     * DOM元素存在性检查
     * 
     * 在主题切换前验证关键DOM元素是否已加载：
     * - .markdown-body: Markdown内容容器
     * - .content-container: 内容区域容器
     * - .toc-container: 目录容器
     * - .container: 主容器
     */
    const elementsToCheck = ['.markdown-body', '.content-container', '.toc-container', '.container'];
    elementsToCheck.forEach(selector => {
      const element = document.querySelector(selector);
      console.log(`[主题] DOM检查 - ${selector}: ${element ? '存在' : '不存在'}`);
    });
    
    /**
     * 更新全局主题状态和持久化存储
     * 
     * 状态管理：
     * - currentTheme: 全局变量，记录当前激活的主题
     * - localStorage: 持久化存储用户的主题偏好
     */
    currentTheme = theme;
    localStorage.setItem('markdown-livesync-theme', theme);
    
    /**
     * 获取GitHub官方样式表元素引用
     * 
     * 样式表架构：
     * - github-light-theme: GitHub官方浅色主题样式
     * - github-dark-theme: GitHub官方深色主题样式
     * 
     * 这两个样式表在HTML中预加载，通过disabled属性控制启用状态
     */
    const lightTheme = document.getElementById('github-light-theme');
    const darkTheme = document.getElementById('github-dark-theme');
    
    /**
     * 样式表存在性验证
     * 
     * 错误处理策略：
     * - 如果样式表不存在，延迟100ms后重试
     * - 避免在样式表未加载时进行主题切换
     */
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
    
    /**
     * 确保样式表已完全加载
     * 
     * 加载检测机制：
     * - 检查stylesheet.sheet属性是否存在
     * - 如果未加载，添加load事件监听器
     * - 设置1秒超时保护，避免无限等待
     * 
     * @param {HTMLLinkElement} stylesheet 样式表元素
     * @returns {Promise<void>} 加载完成的Promise
     */
    const ensureStylesheetLoaded = (stylesheet) => {
      return new Promise((resolve) => {
        if (stylesheet.sheet) {
          // 样式表已加载
          resolve();
        } else {
          // 等待样式表加载完成
          stylesheet.addEventListener('load', resolve);
          // 添加超时保护
          setTimeout(resolve, 1000);
        }
      });
    };
    
    /**
     * 等待所有样式表加载完成后应用主题
     * 
     * 并发加载策略：
     * - 使用Promise.all同时等待两个样式表加载
     * - 确保在样式表完全可用后再进行主题切换
     */
    Promise.all([
      ensureStylesheetLoaded(lightTheme),
      ensureStylesheetLoaded(darkTheme)
    ]).then(() => {
      console.log('[主题] 样式表加载完成，开始应用主题');
      
      /**
       * 主题应用核心逻辑
       * 
       * 简化的两种主题模式：
       * 
       * 1. 'light' 模式（默认）：
       *    - 启用GitHub浅色样式表，禁用深色样式表
       *    - 设置data-theme="light"和vscode-light类
       * 
       * 2. 'dark' 模式：
       *    - 启用GitHub深色样式表，禁用浅色样式表
       *    - 设置data-theme="dark"和vscode-dark类
       */
      if (theme === 'light') {
        /**
         * 浅色主题应用
         * 
         * 样式表控制：
         * - lightTheme.disabled = false: 启用GitHub浅色样式
         * - darkTheme.disabled = true: 禁用GitHub深色样式
         * 
         * DOM属性设置：
         * - data-theme="light": 用于CSS选择器和JavaScript判断
         * - className="vscode-light": 应用VSCode浅色主题变量
         */
        lightTheme.disabled = false;
        darkTheme.disabled = true;
        
        // 设置HTML根元素和body元素的主题属性
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
        document.body.className = 'vscode-light';
        
        console.log('[主题] 应用浅色主题');
      } else if (theme === 'dark') {
        /**
         * 深色主题应用
         * 
         * 样式表控制：
         * - lightTheme.disabled = true: 禁用GitHub浅色样式
         * - darkTheme.disabled = false: 启用GitHub深色样式
         * 
         * DOM属性设置：
         * - data-theme="dark": 用于CSS选择器和JavaScript判断
         * - className="vscode-dark": 应用VSCode深色主题变量
         */
        lightTheme.disabled = true;
        darkTheme.disabled = false;
        
        // 设置HTML根元素和body元素的主题属性
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        document.body.className = 'vscode-dark';
        
        console.log('[主题] 应用深色主题');
      } else {
        /**
         * 默认回退到浅色主题
         * 
         * 如果传入了无效的主题名称，自动回退到浅色主题
         */
        console.warn(`[主题] 未知主题: ${theme}，回退到浅色主题`);
        setTheme('light');
        return;
      }
      
      /**
       * 强制DOM重新渲染和样式重新计算
       * 
       * 重新渲染策略：
       * 1. 临时隐藏元素（display: none）
       * 2. 访问offsetHeight属性触发浏览器重排（reflow）
       * 3. 恢复元素显示状态
       * 4. 对关键元素进行额外的样式重新计算
       * 
       * 这个过程确保新的主题样式能够正确应用到所有元素上，
       * 特别是解决某些浏览器的样式缓存问题。
       */
      
      // 重新渲染目录容器
      const tocContainer = document.querySelector('.toc-container');
      if (tocContainer) {
        tocContainer.style.display = 'none';
        tocContainer.offsetHeight; // 触发重排，强制浏览器重新计算布局
        tocContainer.style.display = '';
      }
      
      /**
       * 重新渲染Markdown内容容器（关键修复）
       * 
       * 这是主题切换的关键步骤，确保GitHub样式正确应用：
       * 1. 隐藏元素并触发重排
       * 2. 强制重新计算样式（通过getComputedStyle）
       * 3. 使用visibility属性进行二次重新渲染
       */
      const markdownBody = document.querySelector('.markdown-body');
      if (markdownBody) {
        // 第一次重新渲染：display属性
        markdownBody.style.display = 'none';
        markdownBody.offsetHeight; // 触发重排
        markdownBody.style.display = '';
        
        // 第二次重新渲染：强制重新计算样式
        const computedStyle = window.getComputedStyle(markdownBody);
        markdownBody.style.visibility = 'hidden';
        markdownBody.offsetHeight; // 再次触发重排
        markdownBody.style.visibility = 'visible';
      }
      
      // 重新渲染主容器
      const container = document.querySelector('.container');
      if (container) {
        container.style.display = 'none';
        container.offsetHeight; // 触发重排
        container.style.display = 'flex'; // 恢复为flex布局
      }
      
      /**
       * 更新UI控件状态
       * 
       * 主题切换完成后需要更新相关UI元素：
       * 1. 主题切换按钮的图标
       * 2. 按钮的文本显示（兼容性）
       */
      
      // 更新主题切换按钮图标
      const themeBtn = document.querySelector('.toc-theme-toggle');
      if (themeBtn) {
        themeBtn.innerHTML = getThemeIcon(theme);
        console.log(`[主题] 更新按钮图标: ${getThemeIcon(theme)}`);
      }
      
      // 更新按钮文本（向后兼容旧版本的按钮）
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        themeToggle.textContent = getThemeDisplayName(theme);
      }
      
      /**
       * 主题切换状态日志记录
       * 
       * 记录主题切换完成后的关键状态信息：
       * 1. 样式表的启用/禁用状态
       * 2. DOM元素的主题属性设置
       * 3. CSS类名的应用情况
       */
      console.log(`[主题] 主题切换完成: ${getThemeDisplayName(theme)}`);
      console.log(`[主题] 最终样式表状态 - Light disabled: ${lightTheme.disabled}, Dark disabled: ${darkTheme.disabled}`);
      console.log(`[主题] 最终html data-theme: ${document.documentElement.getAttribute('data-theme')}`);
      console.log(`[主题] 最终body data-theme: ${document.body.getAttribute('data-theme')}`);
      console.log(`[主题] 最终body className: ${document.body.className}`);
      
      /**
       * 样式应用效果验证
       * 
       * 延迟验证机制：
       * - 使用200ms延迟，确保浏览器完成样式重新计算
       * - 通过getComputedStyle获取实际应用的样式值
       * - 验证关键元素的样式是否正确应用
       * 
       * 验证内容：
       * 1. 基础容器样式（body、content-container）
       * 2. Markdown内容样式（.markdown-body）
       * 3. GitHub特定样式（标题边框、表格边框等）
       */
      setTimeout(() => {
        console.log('[主题] 开始验证样式应用效果...');
        
        // 验证body元素的基础样式
        const bodyStyle = window.getComputedStyle(document.body);
        console.log(`[主题] 验证 - body背景色: ${bodyStyle.backgroundColor}`);
        console.log(`[主题] 验证 - body文字色: ${bodyStyle.color}`);
        
        /**
         * 验证Markdown内容容器样式
         * 
         * 重新查询元素的原因：
         * - 避免闭包作用域问题
         * - 确保获取到最新的DOM元素引用
         * 
         * 容错处理：
         * - 如果.markdown-body元素不存在，可能是内容还未加载
         * - 这种情况在首次打开预览或空文档时是正常的
         */
        const currentMarkdownBody = document.querySelector('.markdown-body');
        if (currentMarkdownBody) {
          const markdownBodyStyle = window.getComputedStyle(currentMarkdownBody);
          console.log(`[主题] 验证 - markdown-body背景色: ${markdownBodyStyle.backgroundColor}`);
          console.log(`[主题] 验证 - markdown-body文字色: ${markdownBodyStyle.color}`);
          
          // 检查是否有实际内容
          const hasContent = currentMarkdownBody.children.length > 0 || currentMarkdownBody.textContent.trim().length > 0;
          console.log(`[主题] 验证 - markdown-body是否有内容: ${hasContent}`);
        } else {
          console.warn(`[主题] 警告 - .markdown-body元素不存在（可能内容还未加载）`);
        }
        
        // 验证内容容器样式
        const contentContainer = document.querySelector('.content-container');
        if (contentContainer) {
          const containerStyle = window.getComputedStyle(contentContainer);
          console.log(`[主题] 验证 - content-container背景色: ${containerStyle.backgroundColor}`);
        } else {
          console.warn(`[主题] 警告 - .content-container元素不存在`);
        }
        
        /**
         * 验证GitHub官方样式的关键特征
         * 
         * 验证项目：
         * - H1标题的下边框（GitHub浅色/深色主题的特征）
         * - H2标题的下边框
         * - 表格的边框样式
         * 
         * 这些样式是判断GitHub主题是否正确应用的关键指标
         * 
         * 容错处理：
         * - 如果没有找到对应元素，说明当前文档中没有这些内容
         * - 这是正常情况，不需要报错
         */
        const h1Elements = document.querySelectorAll('.markdown-body h1');
        const h2Elements = document.querySelectorAll('.markdown-body h2');
        const tableElements = document.querySelectorAll('.markdown-body table');
        
        console.log(`[主题] 验证 - 找到H1元素: ${h1Elements.length}个, H2元素: ${h2Elements.length}个, 表格: ${tableElements.length}个`);
        
        if (h1Elements.length > 0) {
          const h1Style = window.getComputedStyle(h1Elements[0]);
          console.log(`[主题] 验证 - H1边框: ${h1Style.borderBottom}`);
        } else {
          console.log(`[主题] 验证 - 当前文档无H1标题`);
        }
        
        if (h2Elements.length > 0) {
          const h2Style = window.getComputedStyle(h2Elements[0]);
          console.log(`[主题] 验证 - H2边框: ${h2Style.borderBottom}`);
        } else {
          console.log(`[主题] 验证 - 当前文档无H2标题`);
        }
        
        if (tableElements.length > 0) {
          const tableStyle = window.getComputedStyle(tableElements[0]);
          console.log(`[主题] 验证 - 表格边框: ${tableStyle.border}`);
        } else {
          console.log(`[主题] 验证 - 当前文档无表格`);
        }
        
        console.log('[主题] 样式验证完成');
      }, 200);
    });
  }

  /**
   * 获取当前主题
   * 
   * 优先级：
   * 1. 全局变量 currentTheme
   * 2. localStorage 存储的主题
   * 3. 配置中的主题
   * 4. 默认主题 'light'
   */
  function getCurrentTheme() {
    return currentTheme || 
           localStorage.getItem('markdownLiveSync.theme') || 
           (window.markdownLiveSyncConfig?.theme?.current) || 
           'light';
  }

  /**
   * 获取主题显示名称
   */
  function getThemeDisplayName(theme) {
    const names = {
      'light': '🌞 浅色',
      'dark': '🌙 深色'
    };
    return names[theme] || '🌞 浅色';
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
        
        // 遍历所有交叉观察条目
        entries.forEach(entry => {
          // 只处理当前可见的元素
          if (entry.isIntersecting) {
            // 获取元素的位置信息
            const rect = entry.boundingClientRect;
            // 从data-source-line属性获取对应的源代码行号
            const sourceLine = entry.target.dataset.sourceLine;
            // 记录可见元素的详细信息，用于调试
            console.log(`[滚动同步] 可见元素: ${entry.target.tagName} line=${sourceLine} top=${rect.top.toFixed(2)}`);
            
            // 计算元素中心点到视口顶部的距离
            const elementCenter = rect.top + rect.height / 2;
            const distanceToTop = Math.abs(elementCenter);
            
            // 选择中心点最接近视口顶部的元素
            if (distanceToTop < minTop) {
              minTop = distanceToTop;
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
    console.log(`[目录] 滚动到第${line}行`);
    
    // 查找目标元素的策略：
    // 1. 优先查找精确匹配的标题元素
    // 2. 如果没有，查找最接近的元素
    // 3. 最后尝试通过锚点滚动
    
    let finalTarget = null;
    
    // 策略1：查找精确匹配的标题元素
    const exactMatch = document.querySelector(`h1[data-source-line="${line}"], h2[data-source-line="${line}"], h3[data-source-line="${line}"], h4[data-source-line="${line}"], h5[data-source-line="${line}"], h6[data-source-line="${line}"]`);
    if (exactMatch) {
      finalTarget = exactMatch;
      console.log(`[目录] 找到精确匹配的标题: ${finalTarget.textContent}`);
    } else {
      // 策略2：查找最接近的元素
      const allElements = document.querySelectorAll('[data-source-line]');
      let closestElement = null;
      let minDistance = Infinity;
      
      allElements.forEach(element => {
        const elementLine = parseInt(element.getAttribute('data-source-line'));
        if (elementLine > line) return;
        const distance = Math.abs(elementLine - line);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestElement = element;
        }
      });
      
      if (closestElement) {
        finalTarget = closestElement;
        console.log(`[目录] 找到最接近的元素: ${finalTarget.tagName} (距离${minDistance}行)`);
      }
    }
    
    if (finalTarget) {
      // 滚动到标题位置
      finalTarget.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // 向上滚动100px，提供更好的阅读体验
      const currentScroll = finalTarget.scrollY;
      finalTarget.scrollTo({
        top: currentScroll - 100,
        behavior: 'smooth'
      });
      console.log('[目录] 向上滚动100px');
      
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
   * 获取当前文档的最大目录级别
   */
  function getMaxTocLevel() {
    const tocItems = document.querySelectorAll('.toc-item[data-level]');
    let maxLevel = 1;
    
    tocItems.forEach(item => {
      const level = parseInt(item.dataset.level);
      if (level > maxLevel) {
        maxLevel = level;
      }
    });
    
    console.log(`[目录] 文档最大目录级别: ${maxLevel}`);
    return maxLevel;
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
    
    // 查找对应的目录项 - 改进算法，确保高亮准确性
    const tocLinks = document.querySelectorAll('.toc-link[data-line]');
    let activeItem = null;
    let bestMatch = null;
    let minDistance = Infinity;
    
    // 找到最接近且不大于当前行号的标题
    tocLinks.forEach(link => {
      const linkLine = parseInt(link.dataset.line);
      
      // 只考虑行号小于等于当前行的标题
      if (linkLine <= line) {
        const distance = line - linkLine;
        
        // 选择距离最小的标题作为最佳匹配
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = link;
        }
      }
    });
    
    if (bestMatch) {
      activeItem = bestMatch.closest('.toc-item');
      
      if (activeItem) {
        activeItem.classList.add('active');
        
        // 确保活动项在目录中可见
        const tocContent = document.querySelector('.toc-content');
        if (tocContent && activeItem) {
          // 计算目录项在容器中的位置
          const containerRect = tocContent.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          
          // 如果目录项不在可视区域内，滚动到合适位置
          if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
            activeItem.scrollIntoView({
              behavior: 'smooth',
              block: 'center' // 居中显示，提供更好的上下文
            });
          }
        }
        
        const activeLine = parseInt(bestMatch.dataset.line);
        console.log(`[目录] 高亮目录项: line=${activeLine} (当前预览行=${line})`);
      }
    } else {
      console.log(`[目录] 未找到合适的目录项进行高亮 (当前预览行=${line})`);
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
    // vscode.postMessage({ 
    //   type: 'toc-click', 
    //   line: line - 1, // 转换为0基索引
    //   silent: true // 添加静默标志
    // });
    
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
    const markdownBody = document.querySelector('.markdown-body');
    if (markdownBody && html) {
      markdownBody.innerHTML = html;
      console.log('[内容更新] 已更新.markdown-body内容');
    } else if (html) {
      // 如果.markdown-body不存在，重新创建完整结构
      const contentContainer = document.querySelector('.content-container');
      if (contentContainer) {
        contentContainer.innerHTML = `<div class="markdown-body">${html}</div>`;
        console.log('[内容更新] 重新创建.markdown-body结构');
      }
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
    
    // 内容更新后重新应用当前主题
    // 这确保新内容能正确应用主题样式
    const currentTheme = getCurrentTheme();
    if (currentTheme) {
      console.log(`[内容更新] 重新应用主题: ${currentTheme}`);
      // 延迟一点时间确保DOM更新完成
      setTimeout(() => {
        setTheme(currentTheme);
      }, 50);
    }
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
      copyButton.innerHTML = '❐';
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
      button.innerHTML = '✅';
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

  // ==================== 主程序初始化 ====================

  /**
   * 主程序初始化函数
   * 
   * 初始化流程：
   * 1. 获取插件配置
   * 2. 初始化主题系统和目录控件
   * 3. 设置事件监听器
   * 4. 初始化Mermaid图表支持
   * 5. 初始化目录功能
   * 6. 设置滚动同步观察器
   * 7. 初始化响应式布局
   * 8. 初始化代码块增强功能
   * 9. 发送就绪消息给VSCode
   */
  function initialize() {
    console.log('Markdown LiveSync 预览脚本初始化');
    
    // 获取从后端传递的配置
    config = window.markdownLiveSyncConfig || {};
    
    // 初始化主题系统（包含样式表加载等待和主题应用）
    initializeThemeAndToc();
    
    // 设置各种事件监听器（滚动、点击、键盘、窗口大小变化等）
    setupEventListeners();
    
    // 初始化Mermaid图表渲染引擎
    initializeMermaid();
    
    // 初始化目录功能（状态管理、事件绑定等）
    initializeToc();
    
    // 设置IntersectionObserver用于滚动同步
    setupIntersectionObserver();
    
    // 初始化响应式布局（处理不同屏幕尺寸）
    initializeResponsiveLayout();
    
    // 初始化代码块增强功能（行号、复制按钮等）
    initializeCodeBlocks();
    
    // 向VSCode发送预览面板就绪消息
    vscode.postMessage({ type: 'ready' });
  }

  // ==================== 程序启动 ====================

  /**
   * 程序启动逻辑
   * 
   * 启动策略：
   * - 如果DOM正在加载，等待DOMContentLoaded事件
   * - 如果DOM已加载完成，立即执行初始化
   */
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
