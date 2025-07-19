/**
 * 滚动同步模块 (Scroll Sync)
 * 
 * 负责编辑器与预览面板之间的滚动位置同步
 * 使用 IntersectionObserver 实现高性能的滚动监听
 * 
 * @author hmslsky
 * @version 1.0.0
 */

class ScrollSyncManager {
  constructor() {
    this.currentLine = 1;               // 当前行号
    this.isScrolling = false;           // 是否正在滚动
    this.scrollTimeout = null;          // 滚动超时
    this.lastSyncTime = 0;              // 上次同步时间
    this.syncDebounceTimeout = null;    // 同步防抖超时
    this.intersectionObserver = null;   // IntersectionObserver实例，用于监听元素可见性变化
    this.config = {};                   // 配置对象
    this.vscode = null;                 // VSCode API对象
    
    // 同步控制常量
    this.MIN_SYNC_INTERVAL = 50;    // 最小同步间隔50ms
    this.SYNC_DEBOUNCE_DELAY = 30;  // 防抖延迟30ms
  }

  /**
   * 初始化滚动同步管理器
   * 
   * @param {Object} config - 配置对象
   * @param {Object} vscode - VSCode API对象
   */
  initialize(config, vscode) {
    console.log('[滚动同步] 初始化滚动同步管理器');
    this.config = config;
    this.vscode = vscode;
    
    // 设置 IntersectionObserver 和滚动监听器
    this.setupIntersectionObserver();

    // 设置滚动监听器
    this.setupScrollListener();
  }

  /**
   * 设置 IntersectionObserver 用于监听元素可见性变化
   */
  setupIntersectionObserver() {
    console.log('[滚动同步] 设置 IntersectionObserver');
    
    // 如果已存在，先清理
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    const options = {
      root: null, // 使用视口作为根
      rootMargin: '-10% 0px -80% 0px', // 顶部10%到80%的区域
      threshold: [0, 0.1, 0.5, 1.0] // 多个阈值，提供更精确的检测
    };
    
    // 创建 IntersectionObserver 实例，用于监听元素可见性变化
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.handleIntersection(entries);
    }, options);
    
    // 观察所有带有行号标记的元素
    this.observeElements();
  }

  /**
   * 观察文档中的所有元素
   */
  observeElements() {
    const elements = document.querySelectorAll('[data-source-line]');
    elements.forEach(element => {
      this.intersectionObserver.observe(element);
    });
    console.log(`[滚动同步] 开始观察 ${elements.length} 个元素`);
  }

  /**
   * 处理元素可见性变化
   * 
   * @param {IntersectionObserverEntry[]} entries - 可见性变化的元素
   */
  handleIntersection(entries) {
    // 如果正在滚动，跳过同步以避免循环
    if (this.isScrolling) {
      return;
    }
    
    // 如果滚动同步被禁用，直接返回
    if (!this.config.preview?.syncScroll) {
      return;
    }
    
    // 查找最佳匹配的可见元素
    let bestEntry = null;
    let bestRatio = 0;
    
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        bestEntry = entry;
      }
    });
    
    // 如果没有找到合适的元素，检查当前所有可见元素
    if (!bestEntry) {
      const allElements = document.querySelectorAll('[data-source-line]');
      allElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // 检查元素是否在视口的核心区域
        if (rect.top >= 0 && rect.top <= viewportHeight * 0.3) {
          const line = parseInt(element.getAttribute('data-source-line'));
          if (line && line !== this.currentLine) {
            this.syncToEditor(line);
            return;
          }
        }
      });
      return;
    }
    
    // 获取行号并同步
    const line = parseInt(bestEntry.target.getAttribute('data-source-line'));
    if (line && line !== this.currentLine) {
      this.syncToEditor(line);
    }
  }

  /**
   * 同步到编辑器
   * 
   * @param {number} line - 行号
   */
  syncToEditor(line) {
    const now = Date.now();
    
    // 防抖和限流
    if (now - this.lastSyncTime < this.MIN_SYNC_INTERVAL) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = setTimeout(() => {
        this.performSyncToEditor(line);
      }, this.SYNC_DEBOUNCE_DELAY);
      return;
    }
    
    this.performSyncToEditor(line);
  }

  /**
   * 执行到编辑器的同步
   * 
   * @param {number} line - 行号
   */
  performSyncToEditor(line) {
    console.log(`[滚动同步] 预览同步到编辑器: 第${line}行`);
    
    this.currentLine = line;
    this.lastSyncTime = Date.now();
    
    // 发送同步消息到 VSCode
    if (this.vscode) {
      this.vscode.postMessage({
        type: 'sync-cursor',
        line: line - 1 // 转换为0基索引
      });
    }
    
    // 更新目录高亮
    if (window.tocManager) {
      window.tocManager.updateTocHighlight(line);
    }
  }

  /**
   * 设置滚动监听器
   */
  setupScrollListener() {
    console.log('[滚动同步] 设置滚动监听器');
    
    // 监听窗口滚动事件
    window.addEventListener('scroll', () => {
      this.handleScroll();
    }, { passive: true });
  }

  /**
   * 处理滚动事件
   */
  handleScroll() {
    // 如果正在程序化滚动，跳过处理
    if (this.isScrolling) {
      return;
    }
    
    // 清除之前的超时
    clearTimeout(this.scrollTimeout);
    
    // 设置滚动超时，用于检测滚动结束
    this.scrollTimeout = setTimeout(() => {
      // 滚动结束后的处理（如果需要）
    }, 150);
  }

  /**
   * 从编辑器同步到预览（由外部调用）
   * 
   * @param {number} line - 行号（0基索引）
   */
  syncToCursor(line) {
    console.log(`[滚动同步] 编辑器同步到预览: 第${line + 1}行`);
    
    if (!this.config.preview?.syncScroll) {
      console.log('[滚动同步] 跳过同步 - syncScroll配置已禁用');
      return;
    }
    
    const element = this.findClosestElement(line);
    if (element) {
      console.log(`[滚动同步] 找到目标元素: ${element.tagName} data-source-line="${element.dataset.sourceLine}"`);
      
      // 设置滚动标志，防止反向同步
      this.isScrolling = true;
      
      // 使用smooth滚动，提供更好的用户体验
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      
      // 更新目录高亮
      if (window.tocManager) {
        window.tocManager.updateTocHighlight(line + 1);
      }
      
      // 短暂的滚动锁定时间，避免冲突
      setTimeout(() => { 
        this.isScrolling = false; 
        console.log('[滚动同步] 滚动完成，重新启用预览到编辑器同步');
      }, 300);
    } else {
      console.warn(`[滚动同步] 警告: 找不到第${line + 1}行对应的元素`);
    }
  }

  /**
   * 查找最接近指定行号的元素
   * 
   * @param {number} line - 行号（0基索引）
   * @returns {Element|null} 最接近的元素
   */
  findClosestElement(line) {
    const elements = document.querySelectorAll('[data-source-line]');
    console.log(`[滚动同步] 搜索第${line + 1}行的最近元素，共有${elements.length}个候选元素`);
    
    let closestElement = null;
    let minDiff = Infinity;
    
    elements.forEach((el, index) => {
      const elLine = parseInt(el.dataset.sourceLine, 10);
      if (!isNaN(elLine) && elLine <= line + 1) { // 转换为1基索引进行比较
        const diff = (line + 1) - elLine;
        console.log(`[滚动同步] 候选元素${index + 1}: ${el.tagName} line=${elLine} diff=${diff}`);
        if (diff < minDiff) {
          minDiff = diff;
          closestElement = el;
        }
      }
    });
    
    if (closestElement) {
      console.log(`[滚动同步] 选中最近元素: ${closestElement.tagName} line=${closestElement.dataset.sourceLine} diff=${minDiff}`);
    } else {
      console.warn(`[滚动同步] 警告: 找不到第${line + 1}行或之前的任何元素`);
    }
    
    return closestElement;
  }

  /**
   * 高亮指定行
   * 
   * @param {number} line - 行号
   */
  highlightLine(line) {
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
        top: ${indicator.offsetTop}px;
      `;
      indicator.parentElement.appendChild(highlight);
      
      // 2秒后自动移除高亮
      setTimeout(() => {
        if (highlight.parentElement) {
          highlight.remove();
        }
      }, 2000);
    }
  }

  /**
   * 重新初始化观察器（内容更新后调用）
   */
  reinitialize() {
    console.log('[滚动同步] 重新初始化观察器');
    
    // 重新设置观察器
    this.setupIntersectionObserver();
  }

  /**
   * 应用配置更新
   * 
   * @param {Object} newConfig - 新的配置对象
   */
  applyConfig(newConfig) {
    this.config = newConfig;
    
    // 如果同步被禁用，停止观察
    if (!newConfig.preview?.syncScroll) {
      console.log('[滚动同步] 滚动同步已禁用');
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
    } else {
      console.log('[滚动同步] 滚动同步已启用');
      this.setupIntersectionObserver();
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    console.log('[滚动同步] 清理滚动同步资源');
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    
    clearTimeout(this.scrollTimeout);
    clearTimeout(this.syncDebounceTimeout);
  }
}

// 导出单例实例
window.ScrollSyncManager = ScrollSyncManager; 