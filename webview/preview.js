// Markdown预览页面的客户端脚本

// 全局变量
const documentUri = window.documentUri;
const accessToken = window.accessToken;
const initialLine = window.initialLine || 1;
const showToc = window.showToc;
const wsUrl = window.wsUrl;

// DOM元素 - 使用函数延迟初始化，确保在 DOMContentLoaded 后获取
let contentElement, tocContentElement, tocContainer, showTocButton, toggleTocButton, container;

// 初始化 DOM 元素引用
function initDOMElements() {
  contentElement = document.getElementById('markdown-content');
  tocContentElement = document.getElementById('toc-content');
  tocContainer = document.getElementById('toc-container');
  showTocButton = document.getElementById('show-toc');
  toggleTocButton = document.getElementById('toggle-toc');
  container = document.querySelector('.container');

  // 检查必要的元素是否存在
  if (!contentElement) {
    console.error('未找到 markdown-content 元素');
  }

  if (!tocContentElement) {
    console.warn('未找到 toc-content 元素');
  }

  if (!tocContainer) {
    console.warn('未找到 toc-container 元素');
  }
}

// WebSocket连接
let ws = null;

// 目录配置
const tocConfig = {
  // 默认展开层级，1表示只展开第一级，2表示展开到第二级，以此类推
  // 0表示全部折叠，-1表示全部展开
  defaultExpandLevel: 1,

  // 获取保存的配置
  load: function() {
    const savedLevel = localStorage.getItem('markdown-livesync-toc-expand-level');
    if (savedLevel !== null) {
      this.defaultExpandLevel = parseInt(savedLevel, 10);
    }
    return this.defaultExpandLevel;
  },

  // 保存配置
  save: function() {
    localStorage.setItem('markdown-livesync-toc-expand-level', this.defaultExpandLevel.toString());
  }
};

// 跳转策略 - 简化为只使用ID匹配
const SCROLL_STRATEGIES = {
  ID_MATCH: 'id_match'  // 通过ID匹配，找不到则找最近的ID
};

// 当前跳转策略
let currentScrollStrategy = SCROLL_STRATEGIES.ID_MATCH;

// 调试工具配置
const debugToolsConfig = {
  // 是否启用调试工具 - 通过修改此值来控制调试工具的显示/隐藏
  // 设置为 true 显示调试工具，设置为 false 隐藏调试工具
  enabled: false,  // 默认不显示调试工具

  // 加载保存的配置
  load: function() {
    // 尝试从本地存储加载配置
    const savedEnabled = localStorage.getItem('markdown-livesync-debug-enabled');
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true';
    }
    return this.enabled;
  },

  // 保存配置
  save: function() {
    localStorage.setItem('markdown-livesync-debug-enabled', this.enabled.toString());
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded 事件触发');

  // 初始化 DOM 元素引用
  initDOMElements();

  // 加载调试工具配置
  debugToolsConfig.load();

  // 设置调试工具为启用状态（可以根据需要修改）
  debugToolsConfig.enabled = true;  // 设置为 true 显示调试工具，false 隐藏调试工具
  debugToolsConfig.save();

  // 加载调试工具脚本
  if (debugToolsConfig.enabled) {
    loadDebugTools();
    console.log('调试工具已启用，正在加载...');
  }

  // 加载Markdown内容
  loadMarkdownContent();

  // 设置页面标题
  updatePageTitle();

  try {
    // 设置事件监听器
    setupEventListeners();
    console.log('事件监听器设置完成');
  } catch (error) {
    console.error('设置事件监听器时出错:', error);
  }

  // 建立WebSocket连接
  connectWebSocket();
});

/**
 * 从服务器加载Markdown内容
 */
async function loadMarkdownContent() {
  try {
    const response = await fetch(`/api/markdown?documentUri=${encodeURIComponent(documentUri)}&token=${accessToken}`);

    if (!response.ok) {
      throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 更新内容
    contentElement.innerHTML = data.html;

    // 为所有标题元素添加ID
    addIdsToHeadings();

    // 更新目录
    renderToc(data.toc);

    // 更新页面标题
    if (data.title) {
      document.title = `${data.title} - Markdown预览`;
    }

    // 滚动到初始行，并高亮显示
    scrollToLine(initialLine, false);

  } catch (error) {
    console.error('加载Markdown内容失败:', error);
    contentElement.innerHTML = `<div class="error">加载内容失败: ${error.message}</div>`;
  }
}

/**
 * 渲染目录
 *
 * 这个函数负责将从服务器获取的目录项数组转换为HTML，并添加到页面中。
 * 它处理目录的层级结构，并为每个有子项的目录项添加展开/折叠按钮。
 * 支持根据配置自动展开到指定层级。
 *
 * 特殊处理：
 * - 当一级目录只有一个时，将其作为文章标题，余下的目录从二级开始生成
 * - 当一级目录有多个时，保持现有方式
 *
 * @param {Array} tocItems - 目录项数组，每项包含level（级别）、text（文本）和slug（用于链接）
 */
function renderToc(tocItems) {
  // 如果没有目录项，显示提示信息
  if (!tocItems || tocItems.length === 0) {
    tocContentElement.innerHTML = '<p>没有找到标题</p>';
    return;
  }

  // 加载目录展开层级配置
  const expandLevel = tocConfig.load();

  // 计算一级标题的数量
  const level1Headings = tocItems.filter(item => item.level === 1);
  const singleLevel1 = level1Headings.length === 1;

  // 如果只有一个一级标题，将其作为文章标题
  if (singleLevel1 && level1Headings[0]) {
    const title = level1Headings[0].text;

    // 创建目录控制面板，包含文章标题
    let controlsHtml = `
      <div id="toc-controls">
        <div id="toc-title">
          <h1 class="article-title">${title}</h1>
        </div>
        <div id="toc-level-control">
          <button class="toc-level-button ${expandLevel === 1 ? 'active' : ''}" data-level="1">1</button>
          <button class="toc-level-button ${expandLevel === 2 ? 'active' : ''}" data-level="2">2</button>
          <button class="toc-level-button ${expandLevel === 3 ? 'active' : ''}" data-level="3">3</button>
          <button class="toc-level-button ${expandLevel === 4 ? 'active' : ''}" data-level="4">4</button>
          <button class="toc-level-button ${expandLevel === -1 ? 'active' : ''}" data-level="-1">All</button>
        </div>
      </div>
    `;

    // 创建目录HTML，从根ul元素开始
    let html = '<ul class="toc-root">';
    let lastLevel = 0; // 跟踪上一个处理的目录项级别

    // 用于跟踪每个目录项是否有子项
    const levelChildCount = {};

    // 第一遍遍历，计算每个目录项是否有子项
    tocItems.forEach((item, index) => {
      // 跳过一级标题
      if (item.level === 1) return;

      // 如果下一项的级别比当前项大，则当前项有子项
      if (index < tocItems.length - 1 && tocItems[index + 1].level > item.level) {
        levelChildCount[index] = true;
      }
    });

    // 第二遍遍历，生成HTML，跳过一级标题
    tocItems.forEach((item, index) => {
      // 跳过一级标题
      if (item.level === 1) return;

      // 调整级别，所有标题级别减1（二级变一级，三级变二级，以此类推）
      const adjustedLevel = item.level - 1;

      // 处理缩进和嵌套结构
      if (adjustedLevel > lastLevel) {
        // 如果当前项级别大于上一项，需要增加嵌套
        const diff = adjustedLevel - lastLevel;
        for (let i = 0; i < diff; i++) {
          const parentLevel = lastLevel + i; // 父级标题的级别
          let isVisible = false;

          if (expandLevel === -1) {
            isVisible = true;
          } else if (expandLevel === 0) {
            isVisible = false;
          } else if (expandLevel === 1) {
            isVisible = parentLevel === 0;
          } else {
            isVisible = parentLevel < expandLevel;
          }

          html += `<ul class="toc-sublist" style="display: ${isVisible ? 'block' : 'none'};">`;
        }
      } else if (adjustedLevel < lastLevel) {
        // 如果当前项级别小于上一项，需要减少嵌套
        const diff = lastLevel - adjustedLevel;
        for (let i = 0; i < diff; i++) {
          html += '</ul>';
        }
      }

      // 检查当前项是否有子项
      const hasChildren = levelChildCount[index];

      // 添加目录项
      html += '<li>';

      // 如果有子项，添加展开/折叠按钮
      if (hasChildren) {
        let isExpanded = false;

        if (expandLevel === -1) {
          isExpanded = true;
        } else if (expandLevel === 0) {
          isExpanded = false;
        } else {
          // 修正逻辑：只有当前级别小于选择的级别时才展开
          isExpanded = adjustedLevel < expandLevel;
        }

        const buttonClass = isExpanded ? 'expanded' : 'collapsed';
        const buttonText = isExpanded ? '▼' : '▶';
        html += `<span class="toc-toggle ${buttonClass}" data-level="${adjustedLevel}">${buttonText}</span>`;
      } else {
        html += `<span class="toc-toggle-placeholder" data-level="${adjustedLevel}"></span>`;
      }

      // 添加链接，使用原始索引以确保正确链接到标题
      html += `<a href="#heading-${index + 1}" data-level="${adjustedLevel}">${item.text}</a></li>`;

      // 更新lastLevel为当前项的调整后级别
      lastLevel = adjustedLevel;
    });

    // 关闭所有未关闭的ul标签
    for (let i = 0; i < lastLevel; i++) {
      html += '</ul>';
    }

    html += '</ul>';

    // 更新目录内容
    tocContentElement.innerHTML = controlsHtml + html;
  } else {
    // 多个一级标题或没有一级标题，使用原始逻辑

    // 创建目录控制面板
    let controlsHtml = `
      <div id="toc-controls">
        <div id="toc-level-control">
          <button class="toc-level-button ${expandLevel === 1 ? 'active' : ''}" data-level="1">1</button>
          <button class="toc-level-button ${expandLevel === 2 ? 'active' : ''}" data-level="2">2</button>
          <button class="toc-level-button ${expandLevel === 3 ? 'active' : ''}" data-level="3">3</button>
          <button class="toc-level-button ${expandLevel === 4 ? 'active' : ''}" data-level="4">4</button>
          <button class="toc-level-button ${expandLevel === -1 ? 'active' : ''}" data-level="-1">All</button>
        </div>
      </div>
    `;

    // 创建目录HTML，从根ul元素开始
    let html = '<ul class="toc-root">';
    let lastLevel = 0; // 跟踪上一个处理的目录项级别

    // 用于跟踪每个目录项是否有子项
    const levelChildCount = {};

    // 第一遍遍历，计算每个目录项是否有子项
    tocItems.forEach((item, index) => {
      // 如果下一项的级别比当前项大，则当前项有子项
      if (index < tocItems.length - 1 && tocItems[index + 1].level > item.level) {
        levelChildCount[index] = true;
      }
    });

    // 第二遍遍历，生成HTML
    tocItems.forEach((item, index) => {
      // 处理缩进和嵌套结构
      if (item.level > lastLevel) {
        // 如果当前项级别大于上一项，需要增加嵌套
        const diff = item.level - lastLevel;
        for (let i = 0; i < diff; i++) {
          const parentLevel = lastLevel + i; // 父级标题的级别
          let isVisible = false;

          if (expandLevel === -1) {
            isVisible = true;
          } else if (expandLevel === 0) {
            isVisible = false;
          } else if (expandLevel === 1) {
            isVisible = parentLevel === 0;
          } else {
            isVisible = parentLevel < expandLevel;
          }

          html += `<ul class="toc-sublist" style="display: ${isVisible ? 'block' : 'none'};">`;
        }
      } else if (item.level < lastLevel) {
        // 如果当前项级别小于上一项，需要减少嵌套
        const diff = lastLevel - item.level;
        for (let i = 0; i < diff; i++) {
          html += '</ul>';
        }
      }

      // 检查当前项是否有子项
      const hasChildren = levelChildCount[index];

      // 添加目录项
      html += '<li>';

      // 如果有子项，添加展开/折叠按钮
      if (hasChildren) {
        let isExpanded = false;

        if (expandLevel === -1) {
          isExpanded = true;
        } else if (expandLevel === 0) {
          isExpanded = false;
        } else {
          // 修正逻辑：只有当前级别小于选择的级别时才展开
          isExpanded = item.level < expandLevel;
        }

        const buttonClass = isExpanded ? 'expanded' : 'collapsed';
        const buttonText = isExpanded ? '▼' : '▶';
        html += `<span class="toc-toggle ${buttonClass}" data-level="${item.level}">${buttonText}</span>`;
      } else {
        html += `<span class="toc-toggle-placeholder" data-level="${item.level}"></span>`;
      }

      // 添加链接
      html += `<a href="#heading-${index + 1}" data-level="${item.level}">${item.text}</a></li>`;

      // 更新lastLevel
      lastLevel = item.level;
    });

    // 关闭所有未关闭的ul标签
    for (let i = 0; i < lastLevel; i++) {
      html += '</ul>';
    }

    html += '</ul>';

    // 更新目录内容
    tocContentElement.innerHTML = controlsHtml + html;
  }

  // 为目录项添加点击事件
  // 选择所有目录链接并为每个链接添加点击事件监听器
  tocContentElement.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      // 阻止默认的链接跳转行为，我们将使用自定义的滚动逻辑
      e.preventDefault();

      // 获取链接的重要属性
      const targetId = link.getAttribute('href').substring(1); // 去掉开头的#
      console.log(`目录项点击: 目标ID = ${targetId}, 链接文本: ${link.textContent}`);

      // 只通过ID查找元素
      let targetElement = document.getElementById(targetId);

      // 如果找不到目标元素，尝试通过标题文本查找
      if (!targetElement) {
        console.log(`未找到ID为 ${targetId} 的元素，尝试通过文本查找...`);
        const headingText = link.textContent.trim();
        const headings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');

        for (const heading of headings) {
          if (heading.textContent.trim() === headingText) {
            console.log(`通过文本找到匹配的标题元素: ${heading.tagName}`);
            targetElement = heading;

            // 确保标题有ID
            if (!heading.id) {
              heading.id = targetId;
              console.log(`为找到的标题添加ID: ${targetId}`);
            }

            break;
          }
        }
      }

      // 如果找到了目标元素
      if (targetElement) {
        console.log(`找到目标元素: ${targetElement.tagName}, ID: ${targetElement.id}`);

        // 滚动到目标元素
        // behavior: 'smooth' 使滚动平滑进行
        // block: 'start' 使元素在视口顶部附近显示
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        console.log(`已滚动到目标元素`);
      } else {
        console.log(`未能找到匹配的标题元素，无法跳转`);
        // 显示错误提示
        alert(`无法找到标题: ${link.textContent}`);
      }
    });
  });

  // 为展开层级按钮添加点击事件
  tocContentElement.querySelectorAll('.toc-level-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();

      // 获取目标展开层级
      const level = parseInt(button.getAttribute('data-level'), 10);
      console.log(`点击展开层级按钮: ${level}, 按钮文本: ${button.textContent}`);

      // 更新配置
      tocConfig.defaultExpandLevel = level;
      tocConfig.save();
      console.log(`保存配置: defaultExpandLevel = ${tocConfig.defaultExpandLevel}`);

      // 更新按钮状态
      tocContentElement.querySelectorAll('.toc-level-button').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      console.log(`更新按钮状态: ${button.textContent} 现在处于活动状态`);

      // 更新目录展开状态
      console.log(`调用 updateTocExpandState(${level})`);
      updateTocExpandState(level);
    });
  });

  // 为展开/折叠按钮添加点击事件
  // 选择所有展开/折叠按钮并添加点击事件监听器
  tocContentElement.querySelectorAll('.toc-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      // 阻止事件冒泡，确保点击按钮不会触发父元素的点击事件
      // 这样点击展开/折叠按钮不会导致页面跳转
      e.stopPropagation();

      // 切换展开/折叠状态的CSS类
      // 这些类用于控制按钮的样式和状态
      toggle.classList.toggle('expanded');   // 展开状态
      toggle.classList.toggle('collapsed');  // 折叠状态

      // 根据当前状态更新按钮图标
      // 展开状态显示向下箭头▼，折叠状态显示向右箭头▶
      toggle.textContent = toggle.classList.contains('expanded') ? '▼' : '▶';

      // 获取包含此按钮的列表项（li元素）
      const li = toggle.parentElement;

      // 尝试找到关联的子列表（ul元素）
      // 有两种可能的位置：
      // 1. 作为当前li的下一个兄弟元素
      // 2. 作为当前li内部的子元素
      const sublist = li.nextElementSibling && li.nextElementSibling.tagName === 'UL'
        ? li.nextElementSibling  // 如果下一个元素是ul，使用它
        : li.querySelector('ul'); // 否则尝试在li内部查找ul

      // 如果找到了子列表
      if (sublist) {
        // 根据当前状态切换子列表的显示/隐藏
        // 展开状态显示子列表，折叠状态隐藏子列表
        sublist.style.display = toggle.classList.contains('expanded') ? 'block' : 'none';
      }
    });
  });
}

/**
 * 更新目录展开状态
 *
 * 根据指定的展开层级，更新目录的展开/折叠状态
 *
 * @param {number} level - 展开层级，-1表示全部展开，0表示全部折叠
 */
function updateTocExpandState(level) {
  console.log(`更新目录展开状态，层级: ${level}`);

  // 更新所有展开/折叠按钮
  const toggleButtons = tocContentElement.querySelectorAll('.toc-toggle');
  console.log(`找到 ${toggleButtons.length} 个展开/折叠按钮`);

  toggleButtons.forEach(toggle => {
    // 获取按钮的级别
    const toggleLevel = parseInt(toggle.getAttribute('data-level'), 10);
    console.log(`按钮级别: ${toggleLevel}, 目标级别: ${level}`);

    // 确定是否应该展开
    // level === -1: 全部展开
    // level === 0: 全部折叠
    // level === 1, 2, 3, 4: 只展开到对应级别
    // 修正逻辑：默认收起状态，只有当前级别小于选择的级别时才展开
    let shouldExpand = false;

    if (level === -1) {
      // 全部展开
      shouldExpand = true;
    } else if (level === 0) {
      // 全部折叠
      shouldExpand = false;
    } else {
      // 只有当前级别小于选择的级别时才展开
      // 例如：选择级别2时，只展开级别1的项目
      shouldExpand = toggleLevel < level;
    }

    console.log(`是否应该展开: ${shouldExpand}`);

    // 只处理有展开/折叠功能的按钮（不是占位符）
    if (!toggle.classList.contains('toc-toggle-placeholder')) {
      // 更新按钮状态
      toggle.classList.toggle('expanded', shouldExpand);
      toggle.classList.toggle('collapsed', !shouldExpand);
      toggle.textContent = shouldExpand ? '▼' : '▶';

      // 更新子列表显示状态
      const li = toggle.parentElement;
      const sublist = li.nextElementSibling && li.nextElementSibling.tagName === 'UL'
        ? li.nextElementSibling
        : li.querySelector('ul');

      if (sublist) {
        sublist.style.display = shouldExpand ? 'block' : 'none';
      }
    }
  });

  // 更新所有子列表
  const sublists = tocContentElement.querySelectorAll('.toc-sublist');
  console.log(`找到 ${sublists.length} 个子列表`);

  // 处理根级别的子列表（直接在toc-root下的子列表）
  const rootSubLists = tocContentElement.querySelectorAll('.toc-root > .toc-sublist');
  if (level === 1) {
    // 如果是1级，确保根级别的子列表显示
    rootSubLists.forEach(sublist => {
      sublist.style.display = 'block';
    });
  } else if (level === 0) {
    // 如果是全部折叠，确保所有子列表都隐藏
    sublists.forEach(sublist => {
      sublist.style.display = 'none';
    });
    return; // 提前返回，不需要继续处理
  }

  // 处理其他子列表
  sublists.forEach(sublist => {
    // 跳过根级别的子列表，因为已经在上面处理过了
    if (level === 1 && Array.from(rootSubLists).includes(sublist)) {
      return;
    }

    // 获取父级标题的级别
    let parentLevel = 1; // 默认为1级
    const parentLi = sublist.previousElementSibling;

    if (parentLi && parentLi.tagName === 'LI') {
      const parentLink = parentLi.querySelector('a');
      if (parentLink) {
        parentLevel = parseInt(parentLink.getAttribute('data-level'), 10);
      }
    }

    // 根据父级标题的级别和展开层级决定是否显示
    const shouldShow = level === -1 || (level > 0 && parentLevel < level);
    console.log(`子列表父级级别: ${parentLevel}, 是否应该显示: ${shouldShow}`);

    sublist.style.display = shouldShow ? 'block' : 'none';
  });
}





/**
 * 为所有标题元素添加ID
 *
 * 这个函数遍历文档中的所有标题元素，为它们添加唯一的ID。
 * 这些ID用于目录导航和锚点链接。
 * 简化版本：只添加ID属性，不添加其他属性，减少计算复杂度。
 */
function addIdsToHeadings() {
  console.log('为所有标题元素添加ID');

  // 查找文档中的所有标题元素（h1到h6）
  const headings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log(`找到 ${headings.length} 个标题元素`);

  // 遍历每个标题元素，为其添加ID
  headings.forEach((heading, index) => {
    // 如果标题元素还没有ID，添加一个
    if (!heading.id) {
      // 使用heading-前缀加索引，如heading-1, heading-2等
      heading.id = `heading-${index + 1}`;
      console.log(`为标题添加ID: ${heading.id}, 内容: ${heading.textContent.trim()}`);
    }
  });

  // 检查所有元素，确保有数字ID的元素可以被正确定位
  console.log('检查所有元素的ID属性');
  const allElements = contentElement.querySelectorAll('[id]');
  console.log(`找到 ${allElements.length} 个带有ID的元素`);

  // 统计数字ID的数量
  let numericIdCount = 0;
  allElements.forEach(el => {
    if (!isNaN(parseInt(el.id, 10))) {
      numericIdCount++;
    }
  });

  console.log(`其中 ${numericIdCount} 个元素有数字ID，可用于行号定位`);
}

/**
 * 高亮元素
 *
 * 为元素添加高亮效果，使其更容易被用户注意到
 *
 * @param {HTMLElement} element - 要高亮的元素
 * @param {number} duration - 高亮持续时间（毫秒），默认3000ms
 */
function highlightElement(element, duration = 3000) {
  // 先移除可能存在的高亮类，确保动画可以重新触发
  element.classList.remove('highlight-line');

  // 强制重绘
  void element.offsetWidth;

  // 添加高亮类
  element.classList.add('highlight-line');

  // 保存原始样式
  const originalBorder = element.style.border;
  const originalBackground = element.style.backgroundColor;
  const originalBoxShadow = element.style.boxShadow;
  const originalPosition = element.style.position;
  const originalZIndex = element.style.zIndex;

  // 添加更明显的高亮效果
  element.style.border = '2px solid #ff9800';
  element.style.backgroundColor = '#fffbdd';
  element.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.7)';

  // 确保元素在视觉上突出
  if (originalPosition === 'static') {
    element.style.position = 'relative';
  }
  element.style.zIndex = '5';

  // 添加光标指示器
  const indicator = document.createElement('div');
  indicator.style.position = 'absolute';
  indicator.style.left = '-20px';
  indicator.style.top = '0';
  indicator.style.height = '100%';
  indicator.style.width = '4px';
  indicator.style.backgroundColor = '#ff9800';
  indicator.style.borderRadius = '2px';
  indicator.style.animation = 'pulse 1.5s infinite';

  // 添加脉冲动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(style);

  // 如果元素有相对或绝对定位，添加指示器
  if (getComputedStyle(element).position !== 'static') {
    element.appendChild(indicator);
  }

  // 指定时间后移除高亮效果
  setTimeout(() => {
    element.classList.remove('highlight-line');
    element.style.border = originalBorder;
    element.style.boxShadow = originalBoxShadow;
    element.style.position = originalPosition;
    element.style.zIndex = originalZIndex;

    // 使用过渡效果平滑恢复原始背景色
    element.style.transition = 'background-color 1s ease';
    element.style.backgroundColor = originalBackground;

    // 移除指示器和动画样式
    if (indicator.parentNode === element) {
      element.removeChild(indicator);
    }
    style.remove();

    // 过渡完成后移除过渡样式
    setTimeout(() => {
      element.style.transition = '';
    }, 1000);
  }, duration);
}

/**
 * 更新页面标题
 */
function updatePageTitle() {
  // 从URI中提取文件名
  const uriParts = documentUri.split('/');
  const fileName = uriParts[uriParts.length - 1];

  if (fileName) {
    document.title = `${fileName} - Markdown预览`;
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 处理链接点击
  document.addEventListener('click', (event) => {
    if (event.target.tagName === 'A') {
      const href = event.target.getAttribute('href');

      // 如果是锚点链接，处理滚动
      if (href && href.startsWith('#')) {
        event.preventDefault();
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
          // 高亮显示
          // highlightElement(targetElement);
        }
      }
    }
  });

  // 处理目录显示/隐藏
  if (toggleTocButton) {
    toggleTocButton.addEventListener('click', () => {
      hideToc();
    });
  }

  if (showTocButton) {
    showTocButton.addEventListener('click', () => {
      showTocPanel();
    });
  }

  // 可以添加更多事件监听器，如键盘导航等
}

/**
 * 隐藏目录
 */
function hideToc() {
  tocContainer.classList.add('hidden');
  showTocButton.classList.remove('hidden');
  container.classList.remove('with-toc');

  // 保存用户偏好
  localStorage.setItem('markdown-livesync-toc-visible', 'false');
}

/**
 * 显示目录
 */
function showTocPanel() {
  tocContainer.classList.remove('hidden');
  showTocButton.classList.add('hidden');
  container.classList.add('with-toc');

  // 保存用户偏好
  localStorage.setItem('markdown-livesync-toc-visible', 'true');
}

/**
 * 切换目录显示/隐藏状态
 *
 * 这个函数是为了向后兼容而保留的，实际上会根据当前状态调用 hideToc 或 showTocPanel
 */
function toggleToc() {
  console.log('toggleToc 函数已被调用，但建议直接使用 hideToc 或 showTocPanel');

  // 检查目录是否可见
  const isTocVisible = !tocContainer.classList.contains('hidden');

  if (isTocVisible) {
    hideToc();
  } else {
    showTocPanel();
  }
}

/**
 * 滚动到指定行
 *
 * 这个函数负责将预览内容滚动到与编辑器中指定行号对应的位置。
 * 简化后只使用ID属性进行定位，如果找不到精确匹配，则找最近的ID。
 *
 * @param {number} lineNumber - 编辑器中的行号
 * @param {boolean} highlight - 是否高亮显示目标元素，默认为false
 */
function scrollToLine(lineNumber, highlight = false) {
  console.log(`尝试滚动到行: ${lineNumber}`);

  // 显示当前行号指示器，让用户知道当前光标位置
  showLineIndicator(lineNumber);

  // 如果行号无效，使用默认值
  if (!lineNumber || lineNumber < 1) {
    console.warn(`无效的行号: ${lineNumber}，使用默认值1`);
    lineNumber = 1;
  }

  // 记录开始查找的时间，用于性能分析
  const startTime = performance.now();

  // 尝试使用ID直接等于行号的元素
  const lineIdElement = document.getElementById(`${lineNumber}`);
  if (lineIdElement) {
    console.log(`成功: 找到ID为${lineNumber}的元素`);

    // 添加临时高亮效果，帮助用户识别当前光标位置
    const tempHighlight = highlight || true; // 默认添加高亮效果

    scrollToElement(lineIdElement, tempHighlight);

    // 更新调试工具中的当前行显示（如果存在）
    if (window.updateCurrentLineDisplay) {
      window.updateCurrentLineDisplay(lineNumber);
    }

    logPerformance(startTime, "精确匹配");
    return;
  }

  // 如果没有找到精确匹配，查找最近的ID
  console.log(`未找到ID为${lineNumber}的元素，尝试查找最近的ID`);

  // 获取所有带有数字ID的元素
  const allElements = Array.from(contentElement.querySelectorAll('[id]'))
    .filter(el => !isNaN(parseInt(el.id, 10)))
    .map(el => ({
      element: el,
      id: parseInt(el.id, 10)
    }))
    .sort((a, b) => a.id - b.id); // 按ID排序

  if (allElements.length === 0) {
    console.warn('未找到任何带有数字ID的元素，无法滚动');
    return;
  }

  // 查找最接近的ID
  let closestElement = null;
  let minDistance = Number.MAX_SAFE_INTEGER;

  for (const item of allElements) {
    const distance = Math.abs(item.id - lineNumber);
    if (distance < minDistance) {
      minDistance = distance;
      closestElement = item.element;
    }
  }

  if (closestElement) {
    const closestId = parseInt(closestElement.id, 10);
    console.log(`成功: 找到最接近行号${lineNumber}的元素，ID为${closestId}`);

    // 添加临时高亮效果，帮助用户识别当前光标位置
    const tempHighlight = highlight || true; // 默认添加高亮效果

    scrollToElement(closestElement, tempHighlight);

    // 更新调试工具中的当前行显示（如果存在）
    if (window.updateCurrentLineDisplay) {
      window.updateCurrentLineDisplay(closestId);
    }

    logPerformance(startTime, "最近ID匹配");
    return;
  }

  // 如果所有方法都失败，记录错误
  console.error(`无法找到任何接近行号${lineNumber}的元素`);
}

/**
 * 获取文档的估计总行数
 *
 * @returns {number} 估计的总行数
 */
function getTotalLines() {
  // 默认估计值
  let estimatedLines = 100;

  // 尝试从文档中获取实际行数
  const allElements = contentElement.querySelectorAll('[id]');
  if (allElements.length > 0) {
    // 找出最大的行号
    let maxLine = 0;
    allElements.forEach(element => {
      // 尝试将ID直接解析为数字
      const lineNum = parseInt(element.id, 10);
      if (!isNaN(lineNum) && lineNum > maxLine) {
        maxLine = lineNum;
      }
    });

    if (maxLine > 0) {
      estimatedLines = maxLine;
    }
  }

  return estimatedLines;
}

/**
 * 滚动到指定元素
 *
 * @param {HTMLElement} element - 要滚动到的元素
 * @param {boolean} highlight - 是否高亮显示元素
 */
function scrollToElement(element, highlight = false) {
  if (!element) return;

  // 滚动到元素
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center', // 使用 'center' 使元素在视口中垂直居中
    inline: 'center' // 水平居中显示
  });

  // 如果需要高亮显示
  if (highlight) {
    highlightElement(element);
  }
}

/**
 * 记录性能指标
 *
 * @param {number} startTime - 开始时间
 * @param {string} strategy - 使用的策略
 */
function logPerformance(startTime, strategy) {
  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log(`${strategy} 执行时间: ${duration.toFixed(2)}ms`);
}

/**
 * 显示当前行号指示器
 */
function showLineIndicator(lineNumber) {
  // 移除旧的指示器
  const oldIndicator = document.getElementById('line-indicator');
  if (oldIndicator) {
    oldIndicator.remove();
  }

  // 创建新的指示器
  const indicator = document.createElement('div');
  indicator.id = 'line-indicator';
  indicator.textContent = `行号: ${lineNumber}`;
  indicator.style.position = 'fixed';
  indicator.style.bottom = '10px';
  indicator.style.right = '10px';
  indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  indicator.style.color = 'white';
  indicator.style.padding = '5px 10px';
  indicator.style.borderRadius = '3px';
  indicator.style.fontSize = '12px';
  indicator.style.zIndex = '9999';
  indicator.style.opacity = '0.8';

  document.body.appendChild(indicator);

  // 3秒后淡出
  setTimeout(() => {
    indicator.style.transition = 'opacity 1s';
    indicator.style.opacity = '0';

    // 淡出后移除
    setTimeout(() => {
      indicator.remove();
    }, 1000);
  }, 3000);
}

/**
 * 显示标题指示器
 *
 * 在页面顶部显示一个指示器，提示用户已跳转到哪个标题
 *
 * @param {HTMLElement} headingElement - 标题元素
 */
function showHeadingIndicator(headingElement) {
  // 获取标题文本
  const headingText = headingElement.textContent.trim();

  // 获取标题级别（h1-h6）
  const headingLevel = headingElement.tagName.toLowerCase();

  // 移除旧的指示器
  const oldIndicator = document.getElementById('heading-indicator');
  if (oldIndicator) {
    oldIndicator.remove();
  }

  // 创建新的指示器
  const indicator = document.createElement('div');
  indicator.id = 'heading-indicator';

  // 根据标题级别添加不同的前缀
  let prefix = '';
  switch (headingLevel) {
    case 'h1': prefix = '📌 '; break;
    case 'h2': prefix = '📍 '; break;
    default: prefix = '🔖 '; break;
  }

  indicator.textContent = `${prefix}跳转到: ${headingText}`;

  // 设置样式
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.left = '50%';
  indicator.style.transform = 'translateX(-50%)';
  indicator.style.backgroundColor = 'rgba(3, 102, 214, 0.9)';
  indicator.style.color = 'white';
  indicator.style.padding = '8px 15px';
  indicator.style.borderRadius = '5px';
  indicator.style.fontSize = '14px';
  indicator.style.fontWeight = 'bold';
  indicator.style.zIndex = '9999';
  indicator.style.opacity = '0.95';
  indicator.style.maxWidth = '80%';
  indicator.style.overflow = 'hidden';
  indicator.style.textOverflow = 'ellipsis';
  indicator.style.whiteSpace = 'nowrap';
  indicator.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
  indicator.style.border = '1px solid rgba(255, 255, 255, 0.2)';

  // 添加动画效果
  indicator.style.animation = 'indicator-slide-in 0.3s ease-out';

  // 添加样式到文档
  const style = document.createElement('style');
  style.textContent = `
    @keyframes indicator-slide-in {
      from { transform: translate(-50%, -20px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 0.95; }
    }

    @keyframes indicator-slide-out {
      from { transform: translate(-50%, 0); opacity: 0.95; }
      to { transform: translate(-50%, -20px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(indicator);

  // 4秒后淡出
  setTimeout(() => {
    indicator.style.animation = 'indicator-slide-out 0.5s ease-in forwards';

    // 淡出后移除
    setTimeout(() => {
      indicator.remove();
      style.remove();
    }, 500);
  }, 4000);
}

// 已移除 scrollToLineByRatio 函数，现在只使用ID匹配策略

/**
 * 建立WebSocket连接
 */
function connectWebSocket() {
  if (!wsUrl) {
    console.error('WebSocket URL未定义');
    return;
  }

  console.log('正在连接WebSocket:', wsUrl);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');

      // 发送连接成功消息
      sendPing();

      // 设置定期发送ping的定时器
      startHeartbeat();
    };
  } catch (error) {
    console.error('WebSocket连接失败:', error);
  }

  // 保存最后一次光标位置
  let lastCursorLineNumber = null;

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('收到WebSocket消息:', message.type, message);

      if (message.type === 'update') {
        console.log('收到文档更新');

        // 记录更新前的滚动位置和光标位置
        const scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;
        const currentCursorLine = lastCursorLineNumber;

        // 更新内容
        contentElement.innerHTML = message.html;

        // 为所有标题元素添加ID
        addIdsToHeadings();

        // 更新目录
        renderToc(message.toc);

        // 使用更长的延迟确保DOM完全更新
        setTimeout(() => {
          // 如果有光标位置，优先滚动到光标位置
          if (currentCursorLine) {
            console.log(`文档更新后恢复光标位置: 行 ${currentCursorLine}`);
            scrollToLine(currentCursorLine, false);
          } else {
            // 否则保持原来的滚动位置
            console.log(`文档更新后恢复滚动位置: ${scrollPosition}px`);
            window.scrollTo(0, scrollPosition);
          }
        }, 100); // 增加延迟到100ms
      }
      else if (message.type === 'cursorMove') {
        console.log(`收到光标位置更新: 行 ${message.lineNumber}`);

        // 保存最后一次光标位置
        lastCursorLineNumber = message.lineNumber;

        // 使用更长的延迟确保DOM已完全加载
        // 对于光标移动，使用更长的延迟，因为这可能发生在文档更新后
        setTimeout(() => {
          // 检查DOM是否已经准备好
          if (contentElement.querySelectorAll('[id]').length > 0) {
            console.log(`准备滚动到行 ${message.lineNumber}，DOM已准备好`);
            scrollToLine(message.lineNumber, false);
          } else {
            console.warn('DOM元素尚未准备好，无法滚动到指定行，将在300ms后重试');
            // 再次尝试，使用更长的延迟
            setTimeout(() => {
              console.log(`重试滚动到行 ${message.lineNumber}`);
              scrollToLine(message.lineNumber, false);
            }, 300);
          }
        }, 100);
      }
      else if (message.type === 'pong') {
        console.log('收到服务器心跳响应');
      }
    } catch (error) {
      console.error('处理WebSocket消息时出错:', error);
      console.error('原始消息:', event.data);
    }
  };

  ws.onclose = (event) => {
    console.log(`WebSocket连接已关闭: 代码=${event.code}, 原因=${event.reason}`);

    // 停止心跳
    stopHeartbeat();

    // 尝试重新连接
    setTimeout(() => {
      if (document.visibilityState !== 'hidden') {
        console.log('尝试重新连接WebSocket...');
        connectWebSocket();
      }
    }, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };

  // 当页面可见性改变时处理WebSocket连接
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!ws || ws.readyState === 3) { // 3 = CLOSED
        console.log('页面变为可见，重新连接WebSocket');
        connectWebSocket();
      }
    } else {
      // 页面不可见时停止心跳
      stopHeartbeat();
    }
  });
}

// 心跳定时器
let heartbeatTimer = null;

/**
 * 开始心跳检测
 */
function startHeartbeat() {
  stopHeartbeat(); // 确保没有多个定时器

  // 每30秒发送一次ping
  heartbeatTimer = setInterval(() => {
    sendPing();
  }, 30000);
}

/**
 * 停止心跳检测
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * 发送ping消息
 */
function sendPing() {
  if (ws && ws.readyState === 1) { // 1 = OPEN
    console.log('发送ping到服务器');
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 设置目录切换按钮事件
  const showTocButton = document.getElementById('show-toc');
  if (showTocButton) {
    showTocButton.addEventListener('click', () => {
      showTocPanel();
    });
  } else {
    console.warn('未找到 show-toc 按钮');
  }

  // 在 HTML 模板中，关闭按钮的 ID 是 toggle-toc，而不是 close-toc
  const toggleTocButton = document.getElementById('toggle-toc');
  if (toggleTocButton) {
    toggleTocButton.addEventListener('click', () => {
      hideToc();
    });
  } else {
    console.warn('未找到 toggle-toc 按钮');
  }

  // 监听窗口大小变化，调整布局
  window.addEventListener('resize', () => {
    try {
      adjustLayout();
    } catch (error) {
      console.error('窗口大小变化时调整布局出错:', error);
    }
  });

  // 监听调试工具事件
  window.addEventListener('scrollStrategyChanged', (e) => {
    try {
      currentScrollStrategy = e.detail.strategy;
      console.log(`主脚本接收到策略变更: ${currentScrollStrategy}`);
    } catch (error) {
      console.error('处理策略变更事件时出错:', error);
    }
  });

  window.addEventListener('reloadDebugTools', () => {
    try {
      loadDebugTools();
    } catch (error) {
      console.error('重新加载调试工具时出错:', error);
    }
  });

  // 初始调整布局
  try {
    console.log('初始调整布局');
    adjustLayout();
  } catch (error) {
    console.error('初始调整布局时出错:', error);
  }
}

/**
 * 加载调试工具
 */
function loadDebugTools() {
  console.log('开始加载调试工具...');
  console.log('调试工具状态:', debugToolsConfig.enabled ? '启用' : '禁用');

  // 检查是否已经加载
  if (window.debugTools) {
    console.log('调试工具已经加载，正在初始化...');
    initializeDebugTools();
    return;
  }

  // 创建脚本元素
  const script = document.createElement('script');

  // 使用完整路径
  script.src = '/static/debug-tools.js';
  console.log('正在加载调试工具脚本:', script.src);

  script.onload = () => {
    console.log('调试工具脚本加载成功');
    if (window.debugTools) {
      console.log('window.debugTools 对象已创建');
    } else {
      console.error('window.debugTools 对象未创建');
    }
    initializeDebugTools();
  };

  script.onerror = (error) => {
    console.error('加载调试工具脚本失败:', error);
    console.error('请检查 debug-tools.js 文件是否存在于正确的路径');
  };

  // 添加到文档
  document.head.appendChild(script);
  console.log('调试工具脚本元素已添加到文档');
}

/**
 * 初始化调试工具
 */
function initializeDebugTools() {
  if (window.debugTools && window.debugTools.initDebugTools) {
    window.debugTools.initDebugTools({
      contentElement: contentElement,
      scrollToLine: scrollToLine,
      scrollStrategies: SCROLL_STRATEGIES,
      currentScrollStrategy: currentScrollStrategy,
      enabled: debugToolsConfig.enabled  // 传递启用状态
    });
  }
}

/**
 * 此函数已不再使用，调试工具的显示/隐藏通过修改 debugToolsConfig.enabled 来控制
 * 保留此函数是为了兼容性，避免可能的引用错误
 */
function toggleDebugTools() {
  console.log('调试工具的显示/隐藏现在通过修改 debugToolsConfig.enabled 来控制');
  console.log('请在代码中设置 debugToolsConfig.enabled = true/false 来显示/隐藏调试工具');
}

/**
 * 调整页面布局
 *
 * 根据窗口大小和目录显示状态调整页面布局
 */
function adjustLayout() {
  // 检查必要的元素是否存在
  if (!container || !tocContainer) {
    console.warn('adjustLayout: 必要的元素不存在，无法调整布局');
    return;
  }

  try {
    // 获取窗口宽度
    const windowWidth = window.innerWidth;

    // 检查目录是否可见
    const isTocVisible = !tocContainer.classList.contains('hidden');

    // 如果窗口宽度小于 768px（移动设备），强制隐藏目录
    if (windowWidth < 768 && isTocVisible) {
      console.log('窗口宽度小于 768px，强制隐藏目录');
      hideToc();
    }

    // 调整内容区域的最大宽度
    if (isTocVisible) {
      // 目录可见时，内容区域宽度减小
      container.style.maxWidth = `${windowWidth - 300}px`;
    } else {
      // 目录隐藏时，内容区域可以更宽
      container.style.maxWidth = `${windowWidth - 100}px`;
    }

    console.log(`布局已调整: 窗口宽度=${windowWidth}px, 目录${isTocVisible ? '可见' : '隐藏'}`);
  } catch (error) {
    console.error('调整布局时出错:', error);
  }
}

