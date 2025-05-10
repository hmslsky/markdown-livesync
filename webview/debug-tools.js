/**
 * Markdown LiveSync 调试工具
 *
 * 这个文件包含调试工具的所有功能，可以通过配置选项来启用或禁用。
 * 调试工具提供以下功能：
 * 1. 显示/隐藏行号标记
 * 2. 选择不同的跳转策略
 * 3. 手动输入行号进行跳转
 * 4. 显示当前光标所在行号
 */

// 调试模式状态
let debugMode = false;

// 调试工具配置
const debugConfig = {
  // 是否启用调试工具 - 通过主脚本中的 debugToolsConfig.enabled 控制
  enabled: false,

  // 调试工具是否折叠
  collapsed: false,

  // 加载保存的配置
  load: function() {
    // 折叠状态从本地存储加载
    const savedCollapsed = localStorage.getItem('markdown-livesync-debug-collapsed');
    if (savedCollapsed !== null) {
      this.collapsed = savedCollapsed === 'true';
    }

    return this;
  },

  // 保存配置
  save: function() {
    localStorage.setItem('markdown-livesync-debug-collapsed', this.collapsed.toString());
  }
};

/**
 * 初始化调试工具
 *
 * @param {Object} options - 调试工具选项
 * @param {HTMLElement} options.contentElement - 内容元素
 * @param {Function} options.scrollToLine - 跳转到指定行的函数
 * @param {Object} options.scrollStrategies - 跳转策略常量
 * @param {boolean} options.enabled - 是否启用调试工具
 */
function initDebugTools(options) {
  // 加载配置
  debugConfig.load();

  // 从选项中获取启用状态
  debugConfig.enabled = options.enabled;

  // 如果调试工具未启用，不执行任何操作
  if (!debugConfig.enabled) {
    return;
  }

  // 添加调试工具到页面
  addDebugTools(options);
}

/**
 * 添加调试工具
 *
 * @param {Object} options - 调试工具选项
 */
function addDebugTools(options) {
  const { contentElement, scrollToLine, scrollStrategies } = options;
  let currentScrollStrategy = options.currentScrollStrategy || scrollStrategies.AUTO;

  // 创建调试工具容器
  const debugTools = document.createElement('div');
  debugTools.id = 'debug-tools';
  debugTools.style.position = 'fixed';
  debugTools.style.bottom = '10px';
  debugTools.style.left = '10px';
  debugTools.style.zIndex = '9999';
  debugTools.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  debugTools.style.color = 'white';
  debugTools.style.padding = '10px';
  debugTools.style.borderRadius = '5px';
  debugTools.style.fontSize = '12px';
  debugTools.style.display = 'flex';
  debugTools.style.flexDirection = 'column';
  debugTools.style.gap = '10px';
  debugTools.style.maxWidth = '300px';
  debugTools.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';

  // 添加标题
  const title = document.createElement('div');
  title.textContent = '调试工具';
  title.style.fontWeight = 'bold';
  title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
  title.style.paddingBottom = '5px';
  title.style.marginBottom = '5px';

  // 添加调试模式切换按钮
  const debugToggle = document.createElement('button');
  debugToggle.textContent = '显示行号标记';
  debugToggle.style.padding = '5px 10px';
  debugToggle.style.cursor = 'pointer';
  debugToggle.style.backgroundColor = '#4CAF50';
  debugToggle.style.border = 'none';
  debugToggle.style.borderRadius = '3px';
  debugToggle.style.color = 'white';

  debugToggle.addEventListener('click', () => {
    debugMode = !debugMode;
    debugToggle.textContent = debugMode ? '隐藏行号标记' : '显示行号标记';
    debugToggle.style.backgroundColor = debugMode ? '#f44336' : '#4CAF50';

    if (debugMode) {
      showLineMarkers(contentElement);
    } else {
      hideLineMarkers(contentElement);
    }
  });

  // 添加策略说明
  const strategyContainer = document.createElement('div');
  strategyContainer.style.display = 'flex';
  strategyContainer.style.flexDirection = 'column';
  strategyContainer.style.gap = '5px';

  const strategyLabel = document.createElement('div');
  strategyLabel.textContent = '跳转策略:';
  strategyLabel.style.marginBottom = '3px';

  const strategyInfo = document.createElement('div');
  strategyInfo.style.fontSize = '12px';
  strategyInfo.style.color = '#666';
  strategyInfo.style.marginTop = '3px';
  strategyInfo.style.padding = '5px';
  strategyInfo.style.backgroundColor = '#f5f5f5';
  strategyInfo.style.borderRadius = '3px';
  strategyInfo.style.border = '1px solid #ddd';
  strategyInfo.textContent = '使用ID匹配策略，找不到精确ID时查找最近的ID';

  strategyContainer.appendChild(strategyLabel);
  strategyContainer.appendChild(strategyInfo);

  // 添加跳转到行功能
  const jumpContainer = document.createElement('div');
  jumpContainer.style.display = 'flex';
  jumpContainer.style.alignItems = 'center';
  jumpContainer.style.gap = '5px';

  const lineInput = document.createElement('input');
  lineInput.type = 'number';
  lineInput.min = '1';
  lineInput.placeholder = '行号';
  lineInput.style.width = '60px';
  lineInput.style.padding = '5px';
  lineInput.style.borderRadius = '3px';
  lineInput.style.border = 'none';

  const jumpButton = document.createElement('button');
  jumpButton.textContent = '跳转';
  jumpButton.style.padding = '5px 10px';
  jumpButton.style.cursor = 'pointer';
  jumpButton.style.backgroundColor = '#2196F3';
  jumpButton.style.border = 'none';
  jumpButton.style.borderRadius = '3px';
  jumpButton.style.color = 'white';
  jumpButton.style.flexGrow = '1';

  jumpButton.addEventListener('click', () => {
    const lineNumber = parseInt(lineInput.value, 10);
    if (!isNaN(lineNumber) && lineNumber > 0) {
      scrollToLine(lineNumber, true);
    }
  });

  // 添加回车键支持
  lineInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const lineNumber = parseInt(lineInput.value, 10);
      if (!isNaN(lineNumber) && lineNumber > 0) {
        scrollToLine(lineNumber, true);
      }
    }
  });

  jumpContainer.appendChild(lineInput);
  jumpContainer.appendChild(jumpButton);

  // 添加当前行号显示
  const currentLineContainer = document.createElement('div');
  currentLineContainer.style.display = 'flex';
  currentLineContainer.style.alignItems = 'center';
  currentLineContainer.style.justifyContent = 'space-between';
  currentLineContainer.style.marginTop = '5px';

  const currentLineLabel = document.createElement('span');
  currentLineLabel.textContent = '当前行号:';

  const currentLineValue = document.createElement('span');
  currentLineValue.id = 'current-line-value';
  currentLineValue.textContent = '-';
  currentLineValue.style.fontWeight = 'bold';

  currentLineContainer.appendChild(currentLineLabel);
  currentLineContainer.appendChild(currentLineValue);

  // 添加折叠/展开功能
  const toggleButton = document.createElement('button');
  toggleButton.textContent = debugConfig.collapsed ? '展开' : '收起';
  toggleButton.style.position = 'absolute';
  toggleButton.style.top = '10px';
  toggleButton.style.right = '10px';
  toggleButton.style.padding = '2px 5px';
  toggleButton.style.fontSize = '10px';
  toggleButton.style.backgroundColor = 'transparent';
  toggleButton.style.border = '1px solid rgba(255, 255, 255, 0.3)';
  toggleButton.style.borderRadius = '3px';
  toggleButton.style.color = 'white';
  toggleButton.style.cursor = 'pointer';

  const toolContent = document.createElement('div');
  toolContent.style.display = debugConfig.collapsed ? 'none' : 'flex';
  toolContent.style.flexDirection = 'column';
  toolContent.style.gap = '10px';

  toggleButton.addEventListener('click', () => {
    debugConfig.collapsed = !debugConfig.collapsed;
    toggleButton.textContent = debugConfig.collapsed ? '展开' : '收起';
    toolContent.style.display = debugConfig.collapsed ? 'none' : 'flex';
    debugConfig.save();
  });

  // 添加元素到调试工具容器
  debugTools.appendChild(title);
  debugTools.appendChild(toggleButton);

  // 添加内容到工具内容容器
  toolContent.appendChild(debugToggle);
  toolContent.appendChild(strategyContainer);
  toolContent.appendChild(jumpContainer);
  toolContent.appendChild(currentLineContainer);

  // 将工具内容添加到主容器
  debugTools.appendChild(toolContent);

  // 添加到文档
  document.body.appendChild(debugTools);

  // 更新当前行号显示的函数
  window.updateCurrentLineDisplay = function(lineNumber) {
    const currentLineValue = document.getElementById('current-line-value');
    if (currentLineValue) {
      currentLineValue.textContent = lineNumber || '-';
    }
  };
}

/**
 * 显示所有行号标记
 *
 * @param {HTMLElement} contentElement - 内容元素
 */
function showLineMarkers(contentElement) {
  // 移除已有的行号标记
  const existingMarkers = document.querySelectorAll('.debug-line-marker');
  existingMarkers.forEach(marker => marker.remove());

  // 为所有ID可以解析为数字的元素添加行号标记
  const lineElements = contentElement.querySelectorAll('[id]');
  lineElements.forEach(element => {
    // 尝试将ID直接解析为数字
    const lineNumber = element.id;
    if (!lineNumber || isNaN(parseInt(lineNumber, 10))) return;

    const marker = document.createElement('span');
    marker.className = 'debug-line-marker';
    marker.textContent = `L${lineNumber}`;
    marker.style.position = 'absolute';
    marker.style.left = '0';
    marker.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    marker.style.color = 'white';
    marker.style.padding = '2px 5px';
    marker.style.fontSize = '10px';
    marker.style.borderRadius = '3px';
    marker.style.zIndex = '999';
    marker.style.pointerEvents = 'none';

    // 为元素添加相对定位，以便绝对定位的标记能够正确显示
    const originalPosition = window.getComputedStyle(element).position;
    if (originalPosition === 'static') {
      element.style.position = 'relative';
    }

    // 添加边框以突出显示元素
    element.style.outline = '1px dashed rgba(255, 0, 0, 0.5)';

    element.appendChild(marker);

    // 添加点击事件，点击时高亮显示元素
    element.addEventListener('click', function(e) {
      if (debugMode) {
        e.stopPropagation();
        highlightElement(this, 1000);
        console.log(`点击了行号 ${lineNumber} 的元素:`, this);
      }
    });
  });

  console.log(`已显示 ${lineElements.length} 个行号标记`);
}

/**
 * 隐藏所有行号标记
 *
 * @param {HTMLElement} contentElement - 内容元素
 */
function hideLineMarkers(contentElement) {
  // 移除所有行号标记
  const markers = document.querySelectorAll('.debug-line-marker');
  markers.forEach(marker => marker.remove());

  // 恢复元素样式
  const lineElements = contentElement.querySelectorAll('[id]');
  lineElements.forEach(element => {
    // 只处理ID为数字的元素
    if (!isNaN(parseInt(element.id, 10))) {
      element.style.outline = '';
    }
  });

  console.log('已隐藏所有行号标记');
}

/**
 * 高亮显示元素
 *
 * @param {HTMLElement} element - 要高亮显示的元素
 * @param {number} duration - 高亮持续时间（毫秒）
 */
function highlightElement(element, duration = 1000) {
  element.classList.add('highlight-line');
  setTimeout(() => {
    element.classList.remove('highlight-line');
  }, duration);
}

/**
 * 此函数已不再使用，调试工具的显示/隐藏通过主脚本中的 debugToolsConfig.enabled 来控制
 * 保留此函数是为了兼容性，避免可能的引用错误
 */
function toggleDebugTools() {
  console.log('调试工具的显示/隐藏现在通过主脚本中的 debugToolsConfig.enabled 来控制');
  return debugConfig.enabled;
}

// 导出函数和变量
window.debugTools = {
  initDebugTools,
  toggleDebugTools,
  showLineMarkers,
  hideLineMarkers,
  highlightElement,
  config: debugConfig
};
