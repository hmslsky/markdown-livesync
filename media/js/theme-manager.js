/**
 * 主题管理模块 (Theme Manager)
 * 
 * 负责预览面板的主题切换和样式管理
 * 支持浅色/深色主题的无缝切换
 * 
 * @author hmslsky
 * @version 1.0.0
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.config = {};
  }

  /**
   * 初始化主题系统
   * 
   * 主题初始化流程：
   * 1. 立即应用配置中的主题，避免初始闪烁
   * 2. 等待样式表完全加载后确认主题设置
   * 
   * @param {Object} config - 配置对象
   */
  async initialize(config) {
    console.log('[主题] 开始初始化主题系统');
    this.config = config;
    
    // 1. 立即确定并应用初始主题，避免闪烁
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
    
    // 2. 立即应用初始主题，减少闪烁
    this.setTheme(initialTheme);
    console.log(`[主题] 已立即应用初始主题: ${initialTheme}`);

    // 3. 等待样式表加载完成后确认主题设置
    await this.waitForStylesheets();
    
    // 4. 再次确认主题设置，确保样式正确应用
    this.setTheme(initialTheme);
    console.log('[主题] 主题系统初始化完成');
  }

  /**
   * 等待GitHub样式表加载完成
   * 
   * @returns {Promise<void>}
   */
  waitForStylesheets() {
    return new Promise((resolve) => {
      const lightTheme = document.getElementById('github-light-theme');
      const darkTheme = document.getElementById('github-dark-theme');
      
      // 如果样式表元素不存在，短暂等待后重试
      if (!lightTheme || !darkTheme) {
        console.log('[主题] 样式表尚未加载，等待中...');
        setTimeout(() => this.waitForStylesheets().then(resolve), 50);
        return;
      }
      
      const checkLoaded = () => {
        const lightLoaded = lightTheme.sheet !== null;
        const darkLoaded = darkTheme.sheet !== null;
        
        console.log(`[主题] 样式表加载状态 - Light: ${lightLoaded}, Dark: ${darkLoaded}`);
        
        if (lightLoaded && darkLoaded) {
          // 所有样式表都已加载完成
          resolve();
        } else {
          // 为未加载的样式表添加load事件监听器
          const promises = [];
          if (!lightLoaded) {
            promises.push(new Promise(res => lightTheme.addEventListener('load', res, { once: true })));
          }
          if (!darkLoaded) {
            promises.push(new Promise(res => darkTheme.addEventListener('load', res, { once: true })));
          }
          // 等待所有样式表加载完成或超时
          Promise.race([
            Promise.all(promises),
            new Promise(res => setTimeout(res, 1000)) // 1秒超时保护
          ]).then(resolve);
        }
      };
      
      checkLoaded();
    });
  }

  /**
   * 设置主题
   * 
   * @param {string} theme - 主题名称 ('light' | 'dark')
   */
  setTheme(theme) {
    console.log(`[主题] 设置主题: ${theme}`);
    
    // 验证主题名称
    if (!['light', 'dark'].includes(theme)) {
      console.warn(`[主题] 无效的主题名称: ${theme}，使用默认主题 light`);
      theme = 'light';
    }
    
    this.currentTheme = theme;
    
    // 更新样式表状态
    this.updateStylesheets(theme);
    
    // 更新文档主题属性
    this.updateDocumentTheme(theme);
    
    // 保存主题偏好到本地存储
    localStorage.setItem('markdown-livesync-theme', theme);
    
    console.log(`[主题] 主题已设置为: ${theme}`);
  }

  /**
   * 更新样式表启用/禁用状态
   * 
   * @param {string} theme - 当前主题
   */
  updateStylesheets(theme) {
    const lightTheme = document.getElementById('github-light-theme');
    const darkTheme = document.getElementById('github-dark-theme');
    
    if (!lightTheme || !darkTheme) {
      console.warn('[主题] 样式表元素未找到');
      return;
    }
    
    // 根据主题启用/禁用对应的样式表
    lightTheme.disabled = (theme === 'dark');
    darkTheme.disabled = (theme === 'light');
    
    console.log(`[主题] 样式表状态更新 - Light: ${!lightTheme.disabled}, Dark: ${!darkTheme.disabled}`);
  }

  /**
   * 更新文档的主题相关属性
   * 
   * @param {string} theme - 当前主题
   */
  updateDocumentTheme(theme) {
    const html = document.documentElement;
    const body = document.body;
    
    // 更新HTML和Body的data-theme属性
    html.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);
    
    // 更新Body的class（VSCode主题兼容）
    body.className = `vscode-${theme}`;
    
    console.log(`[主题] 文档主题属性已更新: ${theme}`);
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * 获取当前主题
   * 
   * @returns {string} 当前主题名称
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * 获取主题显示名称
   * 
   * @param {string} theme - 主题名称
   * @returns {string} 主题显示名称
   */
  getThemeDisplayName(theme) {
    const names = {
      'light': '浅色模式',
      'dark': '深色模式'
    };
    return names[theme] || theme;
  }

  /**
   * 获取主题图标
   * 
   * @param {string} theme - 主题名称
   * @returns {string} 主题图标
   */
  getThemeIcon(theme) {
    return theme === 'dark' ? '🌙' : '☀️';
  }

  /**
   * 应用配置更新
   * 
   * @param {Object} newConfig - 新的配置对象
   */
  applyConfig(newConfig) {
    this.config = newConfig;
    
    if (newConfig.theme && newConfig.theme.current) {
      this.setTheme(newConfig.theme.current);
    }
  }
}

// 导出单例实例
window.ThemeManager = ThemeManager; 