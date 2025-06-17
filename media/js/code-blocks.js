/**
 * 代码块增强模块 (Code Blocks Enhancement)
 * 
 * 为代码块添加行号、复制按钮、语言标签等增强功能
 * 提升代码阅读和使用体验
 * 
 * @author hmslsky
 * @version 1.0.0
 */

class CodeBlocksManager {
  constructor() {
    this.config = {};
  }

  /**
   * 初始化代码块管理器
   * 
   * @param {Object} config - 配置对象
   */
  initialize(config) {
    console.log('[代码块] 初始化代码块管理器');
    this.config = config;
    
    this.initializeCodeBlocks();
  }

  /**
   * 初始化所有代码块的增强功能
   */
  initializeCodeBlocks() {
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
      
      this.enhanceCodeBlock(preElement, codeElement, index);
    });
    
    console.log(`[代码块] 完成 ${codeBlocks.length} 个代码块的增强`);
  }

  /**
   * 增强单个代码块
   * 
   * @param {Element} preElement - pre元素
   * @param {Element} codeElement - code元素
   * @param {number} index - 代码块索引
   */
  enhanceCodeBlock(preElement, codeElement, index) {
    // 跳过Mermaid代码块
    if (codeElement.classList.contains('language-mermaid')) {
      return;
    }
    
    try {
      // 创建复制按钮
      const copyButton = this.createCopyButton(codeElement);
      
      // 添加到代码块右上角
      preElement.style.position = 'relative';
      copyButton.style.position = 'absolute';
      copyButton.style.top = '8px';
      copyButton.style.right = '8px';
      copyButton.style.zIndex = '10';
      
      preElement.appendChild(copyButton);
      
      console.log(`[代码块] 代码块 ${index} 增强完成`);
    } catch (error) {
      console.error(`[代码块] 增强代码块 ${index} 失败:`, error);
    }
  }

  /**
   * 创建复制按钮
   * 
   * @param {Element} codeElement - code元素
   * @returns {Element} 复制按钮元素
   */
  createCopyButton(codeElement) {
    const copyButton = document.createElement('button');
    copyButton.className = 'code-copy-button';
    copyButton.innerHTML = '📋';
    copyButton.title = '复制代码';
    copyButton.style.cssText = `
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      opacity: 0.7;
    `;
    
    copyButton.addEventListener('mouseenter', () => {
      copyButton.style.background = 'var(--vscode-button-hoverBackground)';
      copyButton.style.opacity = '1';
    });
    
    copyButton.addEventListener('mouseleave', () => {
      copyButton.style.background = 'var(--vscode-button-background)';
      copyButton.style.opacity = '0.7';
    });
    
    copyButton.onclick = () => this.copyCodeToClipboard(codeElement, copyButton);
    
    return copyButton;
  }

  /**
   * 复制代码到剪贴板
   * 
   * @param {Element} codeElement - code元素
   * @param {Element} button - 复制按钮
   */
  async copyCodeToClipboard(codeElement, button) {
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
      this.showCopyFeedback(button, true);
      
      console.log('[代码块] 代码已复制到剪贴板');
      
    } catch (error) {
      console.error('[代码块] 复制失败:', error);
      
      // 显示复制失败反馈
      this.showCopyFeedback(button, false);
    }
  }

  /**
   * 显示复制反馈
   * 
   * @param {Element} button - 复制按钮
   * @param {boolean} success - 是否成功
   */
  showCopyFeedback(button, success) {
    const originalText = button.innerHTML;
    const originalTitle = button.title;
    
    if (success) {
      button.innerHTML = '✅';
      button.title = '复制成功';
    } else {
      button.innerHTML = '❌';
      button.title = '复制失败';
    }
    
    // 2秒后恢复原状
    setTimeout(() => {
      button.innerHTML = originalText;
      button.title = originalTitle;
    }, 2000);
  }

  /**
   * 重新初始化（内容更新后调用）
   */
  reinitialize() {
    console.log('[代码块] 重新初始化代码块');
    
    // 清除已处理标记
    const enhancedBlocks = document.querySelectorAll('.code-enhanced');
    enhancedBlocks.forEach(block => {
      block.classList.remove('code-enhanced');
    });
    
    // 重新初始化
    this.initializeCodeBlocks();
  }

  /**
   * 应用配置更新
   * 
   * @param {Object} newConfig - 新的配置对象
   */
  applyConfig(newConfig) {
    this.config = newConfig;
  }
}

// 导出单例实例
window.CodeBlocksManager = CodeBlocksManager; 