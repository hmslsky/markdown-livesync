/**
 * 目录管理模块 (TOC Manager)
 * 
 * 负责目录的创建、管理和交互功能
 * 包括展开/折叠、浮动显示、导航同步等
 * 
 * @author hmslsky
 * @version 1.0.0
 */

class TocManager {
  constructor() {
    this.tocFloating = false;
    this.tocVisible = false;
    this.config = {};
    this.vscode = null;
  }

  /**
   * 初始化目录管理器
   * 
   * @param {Object} config - 配置对象
   * @param {Object} vscode - VSCode API对象
   */
  initialize(config, vscode) {
    console.log('[目录] 初始化目录管理器');
    this.config = config;
    this.vscode = vscode;
    
    this.initializeTocState();
    this.setupTocEventListeners();
  }

  /**
   * 创建目录头部控制按钮
   */
  createTocHeaderControls() {
    const tocHeader = document.querySelector('.toc-header');
    if (!tocHeader) return;
    
    // 检查是否已经创建了完整的头部控件
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
    
    // 2.1 分级展开按钮组
    const levelControlsContainer = document.createElement('div');
    levelControlsContainer.className = 'toc-level-controls';
    levelControlsContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1px;
      margin: 0 8px;
    `;
    
    // 动态生成级别按钮
    const maxLevel = this.getMaxTocLevel();
    for (let level = 1; level <= Math.min(maxLevel, 6); level++) {
      const levelBtn = document.createElement('button');
      levelBtn.className = 'toc-level-btn';
      levelBtn.textContent = level.toString();
      levelBtn.title = `展开到${level}级标题`;
      levelBtn.onclick = () => this.expandToLevel(level);
      levelBtn.style.cssText = `
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        min-width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      levelControlsContainer.appendChild(levelBtn);
    }
    
    // 2.2 展开/折叠所有按钮
    const toggleAllContainer = document.createElement('div');
    toggleAllContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 1px;
      margin: 0 4px;
    `;
    
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'toc-expand-all';
    expandAllBtn.innerHTML = '+';
    expandAllBtn.title = '展开所有';
    expandAllBtn.onclick = () => this.expandAllTocItems();
    expandAllBtn.style.cssText = `
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      min-width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'toc-collapse-all';
    collapseAllBtn.innerHTML = '-';
    collapseAllBtn.title = '折叠所有';
    collapseAllBtn.onclick = () => this.collapseAllTocItems();
    collapseAllBtn.style.cssText = expandAllBtn.style.cssText;
    
    toggleAllContainer.appendChild(expandAllBtn);
    toggleAllContainer.appendChild(collapseAllBtn);
    
    // 2.3 主题切换按钮
    const themeBtn = document.createElement('button');
    themeBtn.className = 'toc-theme-toggle';
    themeBtn.onclick = () => {
      if (window.themeManager) {
        window.themeManager.toggleTheme();
        const currentTheme = window.themeManager.getCurrentTheme();
        themeBtn.innerHTML = window.themeManager.getThemeIcon(currentTheme);
        themeBtn.title = `切换到${window.themeManager.getThemeDisplayName(currentTheme === 'light' ? 'dark' : 'light')}`;
      }
    };
    themeBtn.style.cssText = `
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
      min-width: 28px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 4px;
    `;
    
    // 设置初始主题图标
    if (window.themeManager) {
      const currentTheme = window.themeManager.getCurrentTheme();
      themeBtn.innerHTML = window.themeManager.getThemeIcon(currentTheme);
      themeBtn.title = `切换到${window.themeManager.getThemeDisplayName(currentTheme === 'light' ? 'dark' : 'light')}`;
    }
    
    // 组装中间控制区域
    middleControls.appendChild(levelControlsContainer);
    middleControls.appendChild(toggleAllContainer);
    middleControls.appendChild(themeBtn);
    
    // 3. 右侧：关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toc-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = '隐藏目录';
    closeBtn.onclick = () => this.toggleTocVisibility();
    closeBtn.style.cssText = `
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      min-width: 28px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 组装完整的头部布局
    tocHeader.appendChild(tocTitle);
    tocHeader.appendChild(middleControls);
    tocHeader.appendChild(closeBtn);
    
    // 添加样式优化
    this.addControlButtonsHoverEffects();
  }

  /**
   * 添加控制按钮的悬停效果
   */
  addControlButtonsHoverEffects() {
    const style = document.createElement('style');
    style.textContent = `
      .toc-header button:hover {
        background: var(--vscode-button-hoverBackground) !important;
      }
      .toc-level-btn.active {
        background: var(--vscode-list-activeSelectionBackground) !important;
        color: var(--vscode-list-activeSelectionForeground) !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 获取目录的最大级别
   * 
   * @returns {number} 最大级别数
   */
  getMaxTocLevel() {
    const tocItems = document.querySelectorAll('.toc-item');
    let maxLevel = 1;
    
    tocItems.forEach(item => {
      const level = parseInt(item.getAttribute('data-level'));
      if (level > maxLevel) {
        maxLevel = level;
      }
    });
    
    return maxLevel;
  }

  /**
   * 初始化目录状态
   */
  initializeTocState() {
    console.log('[目录] 初始化目录状态');
    
    // 根据配置设置默认折叠级别
    const defaultLevel = this.config.toc?.defaultCollapseLevel || 2;
    this.expandToLevel(defaultLevel);
    
    // 初始化响应式状态
    this.checkResponsiveLayout();
  }

  /**
   * 设置目录事件监听器
   */
  setupTocEventListeners() {
    console.log('[目录] 设置目录事件监听器');
    
    // TOC项点击事件委托
    const tocContent = document.querySelector('.toc-content');
    if (tocContent) {
      tocContent.addEventListener('click', (event) => {
        const tocItem = event.target.closest('.toc-item a');
        if (tocItem && tocItem.hasAttribute('data-line')) {
          event.preventDefault();
          const line = parseInt(tocItem.getAttribute('data-line'));
          this.handleTocClick(line);
        }
        
        // 处理折叠/展开按钮点击
        const toggleBtn = event.target.closest('.toc-toggle');
        if (toggleBtn) {
          event.preventDefault();
          const tocItem = toggleBtn.closest('.toc-item');
          const itemId = tocItem.getAttribute('data-id');
          this.toggleTocItem(itemId);
        }
      });
    }
  }

  /**
   * 处理目录点击事件
   * 
   * @param {number} line - 行号
   */
  handleTocClick(line) {
    console.log(`[目录] 处理目录点击: 第${line}行`);
    
    if (this.vscode) {
      this.vscode.postMessage({
        type: 'toc-click',
        line: line - 1 // 转换为0基索引
      });
    }
    
    // 滚动到对应位置
    this.scrollToLine(line);
  }

  /**
   * 滚动到指定行号对应的内容
   * 
   * @param {number} line - 行号
   */
  scrollToLine(line) {
    console.log(`[目录] 滚动到第${line}行`);
    
    // 查找目标元素
    let finalTarget = null;
    
    // 优先查找精确匹配的标题元素
    const exactMatch = document.querySelector(`h1[data-source-line="${line}"], h2[data-source-line="${line}"], h3[data-source-line="${line}"], h4[data-source-line="${line}"], h5[data-source-line="${line}"], h6[data-source-line="${line}"]`);
    if (exactMatch) {
      finalTarget = exactMatch;
      console.log(`[目录] 找到精确匹配的标题: ${finalTarget.textContent}`);
    } else {
      // 查找最接近的元素
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
      
      // 添加临时高亮效果
      finalTarget.classList.add('highlight-target');
      setTimeout(() => {
        finalTarget.classList.remove('highlight-target');
      }, 2000);
      
      const targetLine = finalTarget.getAttribute('data-source-line');
      console.log(`[目录] 滚动到标题: ${finalTarget.textContent} (第${targetLine}行)`);
    } else {
      console.warn(`[目录] 无法找到第${line}行对应的元素`);
    }
  }

  /**
   * 切换目录项的展开/折叠状态
   * 
   * @param {string} id - 目录项ID
   */
  toggleTocItem(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (!item) return;
    
    const isExpanded = item.classList.contains('expanded');
    if (isExpanded) {
      this.collapseTocItem(id);
    } else {
      this.expandTocItem(id);
    }
  }

  /**
   * 展开目录项
   * 
   * @param {string} id - 目录项ID
   */
  expandTocItem(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (!item) return;
    
    item.classList.add('expanded');
    item.classList.remove('collapsed');
    
    const toggle = item.querySelector('.toc-toggle');
    if (toggle) {
      toggle.textContent = '−';
      toggle.title = '折叠';
    }
    
    // 显示子项
    const children = item.querySelectorAll(':scope > .toc-children > .toc-item');
    children.forEach(child => {
      child.style.display = 'block';
    });
  }

  /**
   * 折叠目录项
   * 
   * @param {string} id - 目录项ID
   */
  collapseTocItem(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (!item) return;
    
    item.classList.add('collapsed');
    item.classList.remove('expanded');
    
    const toggle = item.querySelector('.toc-toggle');
    if (toggle) {
      toggle.textContent = '+';
      toggle.title = '展开';
    }
    
    // 隐藏子项
    const children = item.querySelectorAll(':scope > .toc-children > .toc-item');
    children.forEach(child => {
      child.style.display = 'none';
    });
  }

  /**
   * 展开所有目录项
   */
  expandAllTocItems() {
    console.log('[目录] 展开所有目录项');
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      const id = item.getAttribute('data-id');
      this.expandTocItem(id);
    });
  }

  /**
   * 折叠所有目录项
   */
  collapseAllTocItems() {
    console.log('[目录] 折叠所有目录项');
    const tocItems = document.querySelectorAll('.toc-item[data-id]');
    tocItems.forEach(item => {
      const id = item.getAttribute('data-id');
      this.collapseTocItem(id);
    });
  }

  /**
   * 展开到指定级别
   * 
   * @param {number} targetLevel - 目标级别
   */
  expandToLevel(targetLevel) {
    console.log(`[目录] 展开到第${targetLevel}级`);
    
    const tocItems = document.querySelectorAll('.toc-item[data-level]');
    tocItems.forEach(item => {
      const level = parseInt(item.getAttribute('data-level'));
      const id = item.getAttribute('data-id');
      
      if (level <= targetLevel) {
        this.expandTocItem(id);
      } else {
        this.collapseTocItem(id);
      }
    });
    
    // 更新级别按钮的活动状态
    const levelButtons = document.querySelectorAll('.toc-level-btn');
    levelButtons.forEach(btn => {
      const btnLevel = parseInt(btn.textContent);
      btn.classList.toggle('active', btnLevel === targetLevel);
    });
  }

  /**
   * 更新目录高亮
   * 
   * @param {number} line - 当前行号
   */
  updateTocHighlight(line) {
    // 移除之前的高亮
    const previousHighlight = document.querySelector('.toc-item.current');
    if (previousHighlight) {
      previousHighlight.classList.remove('current');
    }
    
    // 查找最匹配的目录项
    const tocLinks = document.querySelectorAll('.toc-item a[data-line]');
    let bestMatch = null;
    let minDistance = Infinity;
    
    tocLinks.forEach(link => {
      const linkLine = parseInt(link.getAttribute('data-line'));
      if (linkLine <= line) {
        const distance = line - linkLine;
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = link.closest('.toc-item');
        }
      }
    });
    
    if (bestMatch) {
      bestMatch.classList.add('current');
      
      // 自动展开到当前项
      if (this.config.toc?.autoExpandCurrent) {
        let parent = bestMatch.parentElement;
        while (parent && parent.classList.contains('toc-children')) {
          const parentItem = parent.closest('.toc-item');
          if (parentItem && parentItem.getAttribute('data-id')) {
            this.expandTocItem(parentItem.getAttribute('data-id'));
          }
          parent = parentItem?.parentElement;
        }
      }
    }
  }

  /**
   * 切换目录可见性
   */
  toggleTocVisibility() {
    const tocContainer = document.querySelector('.toc-container');
    if (!tocContainer) return;
    
    this.tocVisible = !this.tocVisible;
    tocContainer.style.display = this.tocVisible ? 'block' : 'none';
    
    // 显示/隐藏浮动图标
    if (this.tocVisible) {
      this.hideTocFloatingIcon();
    } else {
      this.showTocFloatingIcon();
    }
  }

  /**
   * 显示目录浮动图标
   */
  showTocFloatingIcon() {
    let floatingIcon = document.getElementById('toc-floating-icon');
    if (!floatingIcon) {
      floatingIcon = document.createElement('div');
      floatingIcon.id = 'toc-floating-icon';
      floatingIcon.innerHTML = '📑';
      floatingIcon.title = '显示目录';
      floatingIcon.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        width: 40px;
        height: 40px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      floatingIcon.onclick = () => this.toggleTocVisibility();
      document.body.appendChild(floatingIcon);
    }
    floatingIcon.style.display = 'flex';
  }

  /**
   * 隐藏目录浮动图标
   */
  hideTocFloatingIcon() {
    const floatingIcon = document.getElementById('toc-floating-icon');
    if (floatingIcon) {
      floatingIcon.style.display = 'none';
    }
  }

  /**
   * 检查响应式布局
   */
  checkResponsiveLayout() {
    const containerWidth = window.innerWidth;
    const tocContainer = document.querySelector('.toc-container');
    
    if (containerWidth < 768) {
      // 小屏幕：隐藏目录，显示浮动按钮
      if (tocContainer) {
        tocContainer.style.display = 'none';
        this.tocVisible = false;
      }
      this.showTocFloatingIcon();
    } else {
      // 大屏幕：显示目录，隐藏浮动按钮
      if (tocContainer) {
        tocContainer.style.display = 'block';
        this.tocVisible = true;
      }
      this.hideTocFloatingIcon();
    }
  }

  /**
   * 应用配置更新
   * 
   * @param {Object} newConfig - 新的配置对象
   */
  applyConfig(newConfig) {
    this.config = newConfig;
    
    // 重新初始化状态
    this.initializeTocState();
  }
}

// 导出单例实例
window.TocManager = TocManager; 