/**
 * Markdown LiveSync 预览脚本 (重构版)
 * 
 * 为VSCode Webview预览面板提供交互功能
 * 采用模块化架构，各功能独立管理
 * 
 * @author hmslsky
 * @version 2.0.0
 */

(function() {
  'use strict';

  // ==================== 全局变量和配置 ====================
  
  // 获取VSCode API
  const vscode = acquireVsCodeApi();
  
  // 全局配置
  let config = {};
  
  // 管理器实例
  let themeManager = null;
  let tocManager = null;
  let scrollSyncManager = null;
  let mermaidManager = null;
  let codeBlocksManager = null;

  // ==================== 初始化函数 ====================

  /**
   * 主程序初始化函数
   * 
   * 初始化流程：
   * 1. 获取插件配置
   * 2. 初始化各个功能模块
   * 3. 设置全局事件监听器
   * 4. 发送就绪消息给VSCode
   */
  function initialize() {
    console.log('Markdown LiveSync 预览脚本初始化 (v2.0)');
    
    // 获取从后端传递的配置
    config = window.markdownLiveSyncConfig || {};
    console.log('配置加载完成:', config);
    
    // 初始化各个管理器
    initializeManagers();
    
    // 设置全局事件监听器
    setupGlobalEventListeners();
    
    // 初始化响应式布局
    initializeResponsiveLayout();
    
    // 向VSCode发送预览面板就绪消息
    vscode.postMessage({ type: 'ready' });
    
    console.log('Markdown LiveSync 预览脚本初始化完成');
  }

  /**
   * 初始化所有管理器
   */
  async function initializeManagers() {
    console.log('开始初始化功能模块');
    
    try {
      // 1. 初始化主题管理器
      if (window.ThemeManager) {
        themeManager = new window.ThemeManager();
        window.themeManager = themeManager; // 全局引用
        await themeManager.initialize(config);
      }
      
      // 2. 初始化目录管理器
      if (window.TocManager) {
        tocManager = new window.TocManager();
        window.tocManager = tocManager; // 全局引用
        tocManager.initialize(config, vscode);
        
        // 创建目录头部控件
        tocManager.createTocHeaderControls();
      }
      
      // 3. 初始化滚动同步管理器
      if (window.ScrollSyncManager) {
        scrollSyncManager = new window.ScrollSyncManager();
        window.scrollSyncManager = scrollSyncManager; // 全局引用
        scrollSyncManager.initialize(config, vscode);
      }
      
      // 4. 初始化Mermaid管理器
      if (window.MermaidManager) {
        mermaidManager = new window.MermaidManager();
        window.mermaidManager = mermaidManager; // 全局引用
        mermaidManager.initialize(config);
      }
      
      // 5. 初始化代码块管理器
      if (window.CodeBlocksManager) {
        codeBlocksManager = new window.CodeBlocksManager();
        window.codeBlocksManager = codeBlocksManager; // 全局引用
        codeBlocksManager.initialize(config);
      }
      
      console.log('所有功能模块初始化完成');
    } catch (error) {
      console.error('初始化管理器时出错:', error);
    }
  }

  /**
   * 设置全局事件监听器
   */
  function setupGlobalEventListeners() {
    console.log('设置全局事件监听器');
    
    // VSCode消息监听
    window.addEventListener('message', handleVSCodeMessage);
    
    // 点击事件委托
    document.addEventListener('click', handleGlobalClick);
    
    // 键盘事件
    document.addEventListener('keydown', handleKeydown);
    
    // 窗口大小变化
    window.addEventListener('resize', handleResize);
  }

  /**
   * 处理来自VSCode的消息
   * 
   * @param {MessageEvent} event - 消息事件
   */
  function handleVSCodeMessage(event) {
    const message = event.data;
    console.log('收到VSCode消息:', message.type);
    
    switch (message.type) {
      case 'sync-cursor':
        // 编辑器同步到预览
        if (scrollSyncManager) {
          scrollSyncManager.syncToCursor(message.line);
        }
        break;
        
      case 'update-content':
        // 更新预览内容
        updatePreviewContent(message.html, message.toc);
        break;
        
      case 'update-config':
        // 更新配置
        updateConfig(message.config);
        break;
        
      case 'debug-response':
        // 调试响应
        updateDebugInfo(message.data);
        break;
        
      default:
        console.log('未知的VSCode消息类型:', message.type);
    }
  }

  /**
   * 处理全局点击事件
   * 
   * @param {Event} event - 点击事件
   */
  function handleGlobalClick(event) {
    // 锚点链接导航
    if (event.target.tagName === 'A' && event.target.hash) {
      event.preventDefault();
      const anchor = event.target.hash.substring(1);
      scrollToAnchor(anchor);
    }
  }

  /**
   * 处理键盘事件
   * 
   * @param {KeyboardEvent} event - 键盘事件
   */
  function handleKeydown(event) {
    // Ctrl/Cmd + K: 切换主题
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      if (themeManager) {
        themeManager.toggleTheme();
      }
    }
    
    // Escape: 退出全屏
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        if (mermaidManager) {
          mermaidManager.exitFullscreen();
        }
      }
    }
  }

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    // 防抖处理
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      if (tocManager) {
        tocManager.checkResponsiveLayout();
      }
    }, 250);
  }

  /**
   * 滚动到锚点
   * 
   * @param {string} anchor - 锚点名称
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
   * 更新预览内容
   * 
   * @param {string} html - HTML内容
   * @param {string} toc - 目录HTML
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
    if (toc && tocManager) {
      const tocContent = document.querySelector('.toc-content');
      if (tocContent) {
        tocContent.innerHTML = toc;
        tocManager.initializeTocState();
        
        // 只在目录头部控件不存在时才创建，避免重复
        const existingControls = document.querySelector('.toc-middle-controls');
        if (!existingControls) {
          tocManager.createTocHeaderControls();
          console.log('[内容更新] 创建目录头部控件');
        }
      }
    }
    
    // 重新初始化各个模块（注意顺序：先处理普通代码块，再处理Mermaid）
    if (codeBlocksManager) {
      codeBlocksManager.reinitialize();
    }
    
    if (mermaidManager) {
      mermaidManager.renderMermaidDiagrams();
    }
    
    if (scrollSyncManager) {
      scrollSyncManager.reinitialize();
    }
    
    console.log('[内容更新] 预览内容更新完成');
  }

  /**
   * 更新配置
   * 
   * @param {Object} newConfig - 新配置
   */
  function updateConfig(newConfig) {
    console.log('[配置更新] 应用新配置');
    
    config = newConfig;
    
    // 通知各个管理器应用新配置
    if (themeManager) {
      themeManager.applyConfig(newConfig);
    }
    
    if (tocManager) {
      tocManager.applyConfig(newConfig);
    }
    
    if (scrollSyncManager) {
      scrollSyncManager.applyConfig(newConfig);
    }
    
    if (mermaidManager) {
      mermaidManager.applyConfig(newConfig);
    }
    
    if (codeBlocksManager) {
      codeBlocksManager.applyConfig(newConfig);
    }
    
    console.log('[配置更新] 配置更新完成');
  }

  /**
   * 更新调试信息
   * 
   * @param {Object} data - 调试数据
   */
  function updateDebugInfo(data) {
    const debugInfo = document.querySelector('.debug-info');
    if (debugInfo) {
      debugInfo.innerHTML = `
        <p>当前行: ${data.line}</p>
        <p>滚动位置: ${data.scrollTop}</p>
        <p>时间: ${new Date().toLocaleTimeString()}</p>
      `;
    }
  }

  /**
   * 初始化响应式布局
   */
  function initializeResponsiveLayout() {
    console.log('[响应式] 初始化响应式布局');
    
    // 初始检查
    checkResponsiveLayout();
    
    // 监听媒体查询变化
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addListener(checkResponsiveLayout);
  }

  /**
   * 检查响应式布局
   */
  function checkResponsiveLayout() {
    const isMobile = window.innerWidth < 768;
    document.body.classList.toggle('mobile-layout', isMobile);
    
    // 通知目录管理器
    if (tocManager) {
      tocManager.checkResponsiveLayout();
    }
  }

  // ==================== 向后兼容的全局函数 ====================

  /**
   * 处理目录点击（向后兼容）
   * 
   * @param {Event} event - 点击事件
   * @param {number} line - 行号
   */
  window.handleTocClick = function(event, line) {
    event.preventDefault();
    if (tocManager) {
      tocManager.handleTocClick(line);
    }
  };

  /**
   * 切换目录项（向后兼容）
   * 
   * @param {string} id - 项目ID
   */
  window.toggleTocItem = function(id) {
    if (tocManager) {
      tocManager.toggleTocItem(id);
    }
  };

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

  // 添加基础样式
  const style = document.createElement('style');
  style.textContent = `
    .mobile-layout .toc-container {
      display: none;
    }
    
    .mobile-layout .content-container {
      margin-left: 0 !important;
    }
    
    @media (max-width: 768px) {
      .toc-level-controls {
        display: none !important;
      }
      
      .toc-middle-controls {
        justify-content: flex-end !important;
      }
    }
  `;
  document.head.appendChild(style);

})(); 