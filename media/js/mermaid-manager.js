/**
 * Mermaid图表管理模块 (Mermaid Manager)
 * 
 * 负责Mermaid图表的渲染、交互和控制功能
 * 包括缩放、全屏、主题适配等
 * 
 * @author hmslsky
 * @version 1.0.0
 */

class MermaidManager {
  constructor() {
    this.config = {};
    this.initialized = false;
  }

  /**
   * 初始化Mermaid管理器
   * 
   * @param {Object} config - 配置对象
   */
  initialize(config) {
    console.log('[Mermaid] 初始化Mermaid管理器');
    this.config = config;
    
    if (!config.mermaid?.enabled) {
      console.log('[Mermaid] Mermaid功能已禁用');
      return;
    }
    
    if (typeof mermaid === 'undefined') {
      console.warn('[Mermaid] Mermaid库未加载');
      return;
    }
    
    this.initializeMermaid();
  }

  /**
   * 初始化Mermaid配置
   */
  initializeMermaid() {
    console.log('[Mermaid] 配置Mermaid');
    
    try {
      // 基础Mermaid配置
      const mermaidConfig = {
        startOnLoad: false, // 手动控制渲染时机
        theme: this.getMermaidTheme(),
        themeVariables: this.getThemeVariables(),
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true
        },
        sequence: {
          useMaxWidth: true,
          showSequenceNumbers: true
        },
        gantt: {
          useMaxWidth: true
        },
        pie: {
          useMaxWidth: true
        },
        git: {
          useMaxWidth: true
        },
        c4: {
          useMaxWidth: true
        },
        journey: {
          useMaxWidth: true
        },
        timeline: {
          useMaxWidth: true
        },
        mindmap: {
          useMaxWidth: true
        },
        gitGraph: {
          useMaxWidth: true
        },
        // 安全配置
        securityLevel: 'strict',
        // 字体配置
        fontFamily: '"SF Pro Text", "Segoe UI", system-ui, sans-serif'
      };
      
      mermaid.initialize(mermaidConfig);
      this.initialized = true;
      
      // 渲染所有图表
      this.renderMermaidDiagrams();
      
      console.log('[Mermaid] Mermaid初始化完成');
    } catch (error) {
      console.error('[Mermaid] Mermaid初始化失败:', error);
    }
  }

  /**
   * 获取Mermaid主题
   * 
   * @returns {string} Mermaid主题名称
   */
  getMermaidTheme() {
    const configTheme = this.config.mermaid?.theme || 'default';
    
    // 如果配置为跟随系统主题
    if (window.themeManager) {
      const currentTheme = window.themeManager.getCurrentTheme();
      if (currentTheme === 'dark') {
        return 'dark';
      }
    }
    
    return configTheme;
  }

  /**
   * 获取主题变量
   * 
   * @returns {Object} 主题变量配置
   */
  getThemeVariables() {
    const currentTheme = window.themeManager?.getCurrentTheme() || 'light';
    
    if (currentTheme === 'dark') {
      return {
        primaryColor: '#bb2528',
        primaryTextColor: '#fff',
        primaryBorderColor: '#ff0000',
        lineColor: '#ffffff',
        secondaryColor: '#006100',
        tertiaryColor: '#fff'
      };
    } else {
      return {
        primaryColor: '#0071e3',
        primaryTextColor: '#fff',
        primaryBorderColor: '#0071e3',
        lineColor: '#333333',
        secondaryColor: '#ffcc02',
        tertiaryColor: '#fff'
      };
    }
  }

  /**
   * 渲染所有Mermaid图表
   */
  renderMermaidDiagrams() {
    if (!this.initialized) {
      console.log('[Mermaid] Mermaid未初始化，跳过渲染');
      return;
    }
    
    console.log('[Mermaid] 开始渲染Mermaid图表');
    
    const mermaidElements = document.querySelectorAll('pre code.language-mermaid');
    
    mermaidElements.forEach((element, index) => {
      this.renderSingleDiagram(element, index);
    });
    
    console.log(`[Mermaid] 完成渲染 ${mermaidElements.length} 个图表`);
  }

  /**
   * 渲染单个Mermaid图表
   * 
   * @param {Element} element - 代码元素
   * @param {number} index - 图表索引
   */
  renderSingleDiagram(element, index) {
    try {
      const code = element.textContent;
      const uniqueId = `mermaid-diagram-${index}-${Date.now()}`;
      
      // 检查是否已经渲染过
      if (element.parentElement.querySelector('.mermaid-container')) {
        console.log(`[Mermaid] 图表 ${index} 已存在，跳过渲染`);
        return;
      }
      
      // 创建图表容器
      const container = document.createElement('div');
      container.className = 'mermaid-container';
      container.style.cssText = `
        position: relative;
        margin: 16px 0;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        background: var(--vscode-editor-background);
        overflow: hidden;
      `;
      
      // 创建图表元素
      const diagramDiv = document.createElement('div');
      diagramDiv.className = 'mermaid-diagram';
      diagramDiv.id = uniqueId;
      diagramDiv.style.cssText = `
        padding: 16px;
        text-align: center;
        background: white;
        overflow: auto;
      `;
      
      // 渲染图表
      mermaid.render(uniqueId + '-svg', code).then(({ svg }) => {
        diagramDiv.innerHTML = svg;
        
        // 添加控制工具栏
        this.addDiagramControls(container, diagramDiv, index);
        
        // 组装容器
        container.appendChild(diagramDiv);
        
        // 替换原始代码块
        const preElement = element.parentElement;
        preElement.parentNode.replaceChild(container, preElement);
        
        console.log(`[Mermaid] 图表 ${index} 渲染完成`);
      }).catch(error => {
        console.error(`[Mermaid] 图表 ${index} 渲染失败:`, error);
        
        // 显示错误信息
        diagramDiv.innerHTML = `
          <div style="color: var(--vscode-errorForeground); padding: 20px; text-align: center;">
            <strong>Mermaid 图表渲染失败</strong><br>
            <small>${error.message}</small>
          </div>
        `;
        
        container.appendChild(diagramDiv);
        const preElement = element.parentElement;
        preElement.parentNode.replaceChild(container, preElement);
      });
      
    } catch (error) {
      console.error(`[Mermaid] 处理图表 ${index} 时出错:`, error);
    }
  }

  /**
   * 添加图表控制工具栏
   * 
   * @param {Element} container - 图表容器
   * @param {Element} diagramDiv - 图表元素
   * @param {number} index - 图表索引
   */
  addDiagramControls(container, diagramDiv, index) {
    if (!this.config.mermaid?.enableZoom && !this.config.mermaid?.enableFullscreen) {
      return;
    }
    
    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-toolbar';
    toolbar.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      opacity: 0.7;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    toolbar.addEventListener('mouseenter', () => {
      toolbar.style.opacity = '1';
    });
    
    toolbar.addEventListener('mouseleave', () => {
      toolbar.style.opacity = '0.7';
    });
    
    // 缩放控制按钮
    if (this.config.mermaid?.enableZoom) {
      const zoomInBtn = this.createControlButton('🔍+', '放大', () => {
        this.zoomMermaid(diagramDiv, 1.2);
      });
      
      const zoomOutBtn = this.createControlButton('🔍-', '缩小', () => {
        this.zoomMermaid(diagramDiv, 0.8);
      });
      
      const resetBtn = this.createControlButton('↻', '重置', () => {
        this.resetMermaid(diagramDiv);
      });
      
      toolbar.appendChild(zoomInBtn);
      toolbar.appendChild(zoomOutBtn);
      toolbar.appendChild(resetBtn);
    }
    
    // 全屏按钮
    if (this.config.mermaid?.enableFullscreen) {
      const fullscreenBtn = this.createControlButton('⛶', '全屏', () => {
        this.toggleMermaidFullscreen(container);
      });
      
      toolbar.appendChild(fullscreenBtn);
    }
    
    container.appendChild(toolbar);
  }

  /**
   * 创建控制按钮
   * 
   * @param {string} text - 按钮文本
   * @param {string} title - 按钮提示
   * @param {Function} onClick - 点击回调
   * @returns {Element} 按钮元素
   */
  createControlButton(text, title, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.title = title;
    button.onclick = onClick;
    button.style.cssText = `
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--vscode-button-hoverBackground)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'var(--vscode-button-background)';
    });
    
    return button;
  }

  /**
   * 缩放Mermaid图表
   * 
   * @param {Element} diagramDiv - 图表元素
   * @param {number} scale - 缩放比例
   */
  zoomMermaid(diagramDiv, scale) {
    const svg = diagramDiv.querySelector('svg');
    if (!svg) return;
    
    const currentTransform = svg.style.transform || 'scale(1)';
    const currentScale = parseFloat(currentTransform.match(/scale\(([^)]+)\)/)?.[1] || '1');
    const newScale = Math.max(0.1, Math.min(5, currentScale * scale));
    
    svg.style.transform = `scale(${newScale})`;
    svg.style.transformOrigin = 'center center';
    
    console.log(`[Mermaid] 图表缩放至: ${newScale}`);
  }

  /**
   * 重置Mermaid图表缩放
   * 
   * @param {Element} diagramDiv - 图表元素
   */
  resetMermaid(diagramDiv) {
    const svg = diagramDiv.querySelector('svg');
    if (!svg) return;
    
    svg.style.transform = 'scale(1)';
    console.log('[Mermaid] 图表缩放已重置');
  }

  /**
   * 切换Mermaid图表全屏显示
   * 
   * @param {Element} container - 图表容器
   */
  toggleMermaidFullscreen(container) {
    if (document.fullscreenElement) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen(container);
    }
  }

  /**
   * 进入全屏模式
   * 
   * @param {Element} element - 要全屏的元素
   */
  enterFullscreen(element) {
    console.log('[Mermaid] 进入全屏模式');
    
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
    
    // 添加全屏样式
    element.classList.add('mermaid-fullscreen');
  }

  /**
   * 退出全屏模式
   */
  exitFullscreen() {
    console.log('[Mermaid] 退出全屏模式');
    
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    // 移除全屏样式
    const fullscreenElements = document.querySelectorAll('.mermaid-fullscreen');
    fullscreenElements.forEach(el => el.classList.remove('mermaid-fullscreen'));
  }

  /**
   * 重新渲染所有图表（主题切换时调用）
   */
  rerender() {
    if (!this.initialized) {
      return;
    }
    
    console.log('[Mermaid] 重新渲染所有图表');
    
    // 重新初始化配置
    const mermaidConfig = {
      theme: this.getMermaidTheme(),
      themeVariables: this.getThemeVariables()
    };
    
    mermaid.initialize(mermaidConfig);
    
    // 清除现有图表并重新渲染
    const containers = document.querySelectorAll('.mermaid-container');
    containers.forEach(container => {
      const diagram = container.querySelector('.mermaid-diagram');
      if (diagram && diagram.innerHTML) {
        // 触发重新渲染
        setTimeout(() => {
          this.renderMermaidDiagrams();
        }, 100);
      }
    });
  }

  /**
   * 应用配置更新
   * 
   * @param {Object} newConfig - 新的配置对象
   */
  applyConfig(newConfig) {
    this.config = newConfig;
    
    if (newConfig.mermaid?.enabled && !this.initialized) {
      this.initialize(newConfig);
    } else if (!newConfig.mermaid?.enabled && this.initialized) {
      console.log('[Mermaid] 禁用Mermaid功能');
      this.initialized = false;
    } else if (this.initialized) {
      // 重新渲染以应用新配置
      this.rerender();
    }
  }
}

// 添加全屏相关样式
const style = document.createElement('style');
style.textContent = `
  .mermaid-fullscreen {
    background: var(--vscode-editor-background) !important;
    padding: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .mermaid-fullscreen .mermaid-diagram {
    max-width: 90vw !important;
    max-height: 90vh !important;
    overflow: auto !important;
  }
  
  .highlight-target {
    animation: highlight-flash 2s ease-out;
  }
  
  @keyframes highlight-flash {
    0% { background-color: var(--vscode-list-activeSelectionBackground); }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);

// 导出单例实例
window.MermaidManager = MermaidManager; 