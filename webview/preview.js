// Markdown预览页面的客户端脚本

// 全局变量
const documentUri = window.documentUri;
const accessToken = window.accessToken;
const initialLine = window.initialLine || 1;
const showToc = window.showToc;
const wsUrl = window.wsUrl;

// DOM元素
const contentElement = document.getElementById('markdown-content');
const tocContentElement = document.getElementById('toc-content');
const tocContainer = document.getElementById('toc-container');
const showTocButton = document.getElementById('show-toc');
const toggleTocButton = document.getElementById('toggle-toc');
const container = document.querySelector('.container');

// WebSocket连接
let ws = null;

// 目录配置
const tocConfig = {
  // 默认展开层级，1表示只展开第一级，2表示展开到第二级，以此类推
  // 0表示全部折叠，-1表示全部展开
  defaultExpandLevel: 2,

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

// 调试模式
let debugMode = false;

// 跳转策略
const SCROLL_STRATEGIES = {
  AUTO: 'auto',         // 自动尝试所有策略
  ID_MATCH: '1',        // 策略1: 通过ID匹配(line-{lineNumber})
  HEADING_MATCH: '2',   // 策略2: 通过标题匹配(heading-{index})
  RATIO_MATCH: '3'      // 策略3: 基于比例的滚动方法
};

// 当前跳转策略
let currentScrollStrategy = SCROLL_STRATEGIES.AUTO;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载Markdown内容
  loadMarkdownContent();

  // 设置页面标题
  updatePageTitle();

  // 设置事件监听器
  setupEventListeners();

  // 建立WebSocket连接
  connectWebSocket();

  // 添加调试模式切换按钮
  addDebugTools();
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
          <span id="toc-level-label">Actions:</span>
          <button class="toc-level-button ${expandLevel === 1 ? 'active' : ''}" data-level="1">Level 1</button>
          <button class="toc-level-button ${expandLevel === 2 ? 'active' : ''}" data-level="2">Level 2</button>
          <button class="toc-level-button ${expandLevel === 3 ? 'active' : ''}" data-level="3">Level 3</button>
          <button class="toc-level-button ${expandLevel === -1 ? 'active' : ''}" data-level="-1">Expand All</button>
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
        } else if (expandLevel === 1) {
          isExpanded = adjustedLevel === 1;
        } else {
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
          <span id="toc-level-label">Actions:</span>
          <button class="toc-level-button ${expandLevel === 1 ? 'active' : ''}" data-level="1">Level 1</button>
          <button class="toc-level-button ${expandLevel === 2 ? 'active' : ''}" data-level="2">Level 2</button>
          <button class="toc-level-button ${expandLevel === 3 ? 'active' : ''}" data-level="3">Level 3</button>
          <button class="toc-level-button ${expandLevel === -1 ? 'active' : ''}" data-level="-1">Expand All</button>
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
        } else if (expandLevel === 1) {
          isExpanded = item.level === 1;
        } else {
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

        // 高亮显示目标元素，使其更容易被注意到
        highlightElement(targetElement);

        // 显示指示器，提示用户已跳转到哪个标题
        showHeadingIndicator(targetElement);

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
    // level === 1: 只展开1级标题
    // 否则: 如果按钮级别 < 目标级别，则展开
    let shouldExpand = false;

    if (level === -1) {
      // 全部展开
      shouldExpand = true;
    } else if (level === 0) {
      // 全部折叠
      shouldExpand = false;
    } else if (level === 1) {
      // 1级：只展开1级标题
      shouldExpand = toggleLevel === 1;
    } else {
      // 其他级别：如果按钮级别 < 目标级别，则展开
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
 *
 * 添加ID的好处：
 * 1. 允许通过目录直接跳转到特定标题
 * 2. 使得可以通过URL片段（如#heading-1）直接导航到特定部分
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
      // 使用特殊格式的ID，以避免与行号ID冲突
      // 使用h前缀加索引，如h1, h2, h3等
      heading.id = `h${index + 1}`;
      console.log(`为标题添加ID: ${heading.id}, 内容: ${heading.textContent.trim()}`);
    }
  });

  // 由于我们已经在服务器端为所有元素添加了ID属性，
  // 这里不再需要查找data-line属性并添加ID
  // 所有元素都已经有了id="line-{lineNumber}"格式的ID
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

  // 添加一个临时的边框，使高亮更明显
  const originalBorder = element.style.border;
  const originalBackground = element.style.backgroundColor;

  element.style.border = '2px solid #ff9800';
  element.style.backgroundColor = '#fffbdd';

  // 指定时间后移除高亮效果
  setTimeout(() => {
    element.classList.remove('highlight-line');
    element.style.border = originalBorder;

    // 使用过渡效果平滑恢复原始背景色
    element.style.transition = 'background-color 1s ease';
    element.style.backgroundColor = originalBackground;

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
 * 滚动到指定行
 *
 * 这个函数负责将预览内容滚动到与编辑器中指定行号对应的位置。
 * 简化后只使用ID属性进行定位，减少复杂性并提高性能。
 *
 * 支持的定位策略：
 * - 自动(auto): 依次尝试所有策略，直到成功
 * - 策略1: 通过ID匹配(line-{lineNumber})
 * - 策略2: 通过ID匹配(heading-{index})
 * - 策略3: 基于比例的滚动方法
 *
 * @param {number} lineNumber - 编辑器中的行号
 * @param {boolean} highlight - 是否高亮显示目标元素，默认为false
 */
function scrollToLine(lineNumber, highlight = false) {
  console.log(`尝试滚动到行: ${lineNumber}, 使用策略: ${currentScrollStrategy}`);

  // 显示当前行号指示器，让用户知道当前光标位置
  showLineIndicator(lineNumber);

  // 如果行号无效，使用默认值
  if (!lineNumber || lineNumber < 1) {
    console.warn(`无效的行号: ${lineNumber}，使用默认值1`);
    lineNumber = 1;
  }

  // 记录开始查找的时间，用于性能分析
  const startTime = performance.now();

  // 如果使用自动策略，或者指定了策略1
  if (currentScrollStrategy === SCROLL_STRATEGIES.AUTO ||
      currentScrollStrategy === SCROLL_STRATEGIES.ID_MATCH) {
    // 策略1: 尝试使用ID直接等于行号的元素
    const lineIdElement = document.getElementById(`${lineNumber}`);
    if (lineIdElement) {
      console.log(`策略1成功: 找到ID为${lineNumber}的元素`);

      scrollToElement(lineIdElement, highlight);
      logPerformance(startTime, "策略1");
      return;
    }

    // 如果只使用策略1但失败了，记录日志
    if (currentScrollStrategy === SCROLL_STRATEGIES.ID_MATCH) {
      console.log(`策略1失败: 未找到ID为${lineNumber}的元素`);
      return;
    }
  }

  // 如果使用自动策略，或者指定了策略2
  if (currentScrollStrategy === SCROLL_STRATEGIES.AUTO ||
      currentScrollStrategy === SCROLL_STRATEGIES.HEADING_MATCH) {
    // 策略2: 尝试查找标题元素
    // 获取所有标题元素
    const headings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');

    // 如果有标题元素
    if (headings.length > 0) {
      // 查找最接近的标题
      let closestHeading = null;
      let closestDistance = Number.MAX_SAFE_INTEGER;

      // 遍历所有标题元素
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];

        // 确保标题有ID
        if (!heading.id) {
          heading.id = `h${i + 1}`;
        }

        // 获取标题的位置信息
        const headingRect = heading.getBoundingClientRect();
        const headingTop = headingRect.top + window.scrollY;

        // 估算行号位置（基于文档总高度和行数的比例）
        const documentHeight = document.body.scrollHeight;
        const totalLines = getTotalLines();
        const estimatedLinePosition = (lineNumber / totalLines) * documentHeight;

        // 计算距离
        const distance = Math.abs(headingTop - estimatedLinePosition);

        // 更新最接近的标题
        if (distance < closestDistance) {
          closestDistance = distance;
          closestHeading = heading;
        }
      }

      // 如果找到了最接近的标题
      if (closestHeading) {
        console.log(`策略2成功: 找到最接近行号 ${lineNumber} 的标题: ${closestHeading.textContent.trim()}`);

        scrollToElement(closestHeading, highlight);
        logPerformance(startTime, "策略2");
        return;
      }
    }

    // 如果只使用策略2但失败了，记录日志
    if (currentScrollStrategy === SCROLL_STRATEGIES.HEADING_MATCH) {
      console.log(`策略2失败: 未找到接近行号 ${lineNumber} 的标题元素`);
      return;
    }
  }

  // 如果使用自动策略，或者指定了策略3
  if (currentScrollStrategy === SCROLL_STRATEGIES.AUTO ||
      currentScrollStrategy === SCROLL_STRATEGIES.RATIO_MATCH) {
    // 策略3: 使用比例方法滚动
    console.log('策略3: 使用比例方法滚动');
    scrollToLineByRatio(lineNumber);
    logPerformance(startTime, "策略3");
    return;
  }

  // 如果指定了无效的策略，记录错误
  console.error(`无效的滚动策略: ${currentScrollStrategy}`);
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
    block: 'center'
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

/**
 * 使用比例方法滚动到指定行（回退方法）
 *
 * 当无法通过ID属性精确定位时，使用这个方法作为回退。
 * 它基于文档的估计总行数和当前行号的比例来计算滚动位置。
 *
 * @param {number} lineNumber - 编辑器中的行号
 */
function scrollToLineByRatio(lineNumber) {
  // 获取估计的总行数
  const totalLines = getTotalLines();

  // 计算滚动比例
  const ratio = Math.min(lineNumber / totalLines, 1); // 限制比例最大为1

  // 计算滚动位置
  const scrollHeight = contentElement.scrollHeight;
  const scrollPosition = Math.floor(scrollHeight * ratio);

  console.log(`使用比例方法滚动: 行号 ${lineNumber}/${totalLines}, 比例: ${ratio}, 位置: ${scrollPosition}px`);

  // 滚动到计算出的位置
  contentElement.scrollTop = scrollPosition;
}

/**
 * 建立WebSocket连接
 */
function connectWebSocket() {
  if (!wsUrl) {
    console.error('WebSocket URL未定义');
    return;
  }

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket连接已建立');

    // 发送连接成功消息
    sendPing();

    // 设置定期发送ping的定时器
    startHeartbeat();
  };

  // 保存最后一次光标位置
  let lastCursorLineNumber = null;

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('收到WebSocket消息:', message.type);

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

        // 更新调试工具中的当前行号显示
        if (window.updateCurrentLineDisplay) {
          window.updateCurrentLineDisplay(message.lineNumber);
        }

        // 使用更长的延迟确保DOM已完全加载
        // 对于光标移动，使用更长的延迟，因为这可能发生在文档更新后
        setTimeout(() => {
          // 检查DOM是否已经准备好
          if (contentElement.querySelectorAll('[id]').length > 0) {
            scrollToLine(message.lineNumber, false);
          } else {
            console.warn('DOM元素尚未准备好，无法滚动到指定行');
            // 再次尝试，使用更长的延迟
            setTimeout(() => {
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
 * 添加调试工具
 */
function addDebugTools() {
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
      showLineMarkers();
    } else {
      hideLineMarkers();
    }
  });

  // 添加策略选择器
  const strategyContainer = document.createElement('div');
  strategyContainer.style.display = 'flex';
  strategyContainer.style.flexDirection = 'column';
  strategyContainer.style.gap = '5px';

  const strategyLabel = document.createElement('div');
  strategyLabel.textContent = '跳转策略:';
  strategyLabel.style.marginBottom = '3px';

  const strategySelect = document.createElement('select');
  strategySelect.style.padding = '5px';
  strategySelect.style.borderRadius = '3px';
  strategySelect.style.border = 'none';

  // 添加策略选项
  const strategies = [
    { value: SCROLL_STRATEGIES.AUTO, label: '自动 (尝试所有策略)' },
    { value: SCROLL_STRATEGIES.ID_MATCH, label: '策略1: ID匹配 (line-N)' },
    { value: SCROLL_STRATEGIES.HEADING_MATCH, label: '策略2: 标题匹配 (heading-N)' },
    { value: SCROLL_STRATEGIES.RATIO_MATCH, label: '策略3: 比例匹配' }
  ];

  strategies.forEach(strategy => {
    const option = document.createElement('option');
    option.value = strategy.value;
    option.textContent = strategy.label;
    if (strategy.value === currentScrollStrategy) {
      option.selected = true;
    }
    strategySelect.appendChild(option);
  });

  strategySelect.addEventListener('change', () => {
    currentScrollStrategy = strategySelect.value;
    console.log(`跳转策略已更改为: ${currentScrollStrategy}`);

    // 保存用户偏好
    localStorage.setItem('markdown-livesync-scroll-strategy', currentScrollStrategy);

    // 如果有输入的行号，立即使用新策略跳转
    const lineNumber = parseInt(lineInput.value, 10);
    if (!isNaN(lineNumber) && lineNumber > 0) {
      scrollToLine(lineNumber, true);
    }
  });

  // 尝试从本地存储加载策略设置
  const savedStrategy = localStorage.getItem('markdown-livesync-scroll-strategy');
  if (savedStrategy && Object.values(SCROLL_STRATEGIES).includes(savedStrategy)) {
    currentScrollStrategy = savedStrategy;
    // 更新选择器
    for (let i = 0; i < strategySelect.options.length; i++) {
      if (strategySelect.options[i].value === currentScrollStrategy) {
        strategySelect.selectedIndex = i;
        break;
      }
    }
  }

  strategyContainer.appendChild(strategyLabel);
  strategyContainer.appendChild(strategySelect);

  // 添加策略说明
  const strategyInfo = document.createElement('div');
  strategyInfo.style.fontSize = '10px';
  strategyInfo.style.color = '#aaa';
  strategyInfo.style.marginTop = '3px';
  strategyInfo.textContent = '选择不同策略可以测试哪种定位方法最适合当前文档';
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
  toggleButton.textContent = '收起';
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
  toolContent.style.display = 'flex';
  toolContent.style.flexDirection = 'column';
  toolContent.style.gap = '10px';

  let isCollapsed = false;
  toggleButton.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    toggleButton.textContent = isCollapsed ? '展开' : '收起';
    toolContent.style.display = isCollapsed ? 'none' : 'flex';

    // 保存用户偏好
    localStorage.setItem('markdown-livesync-debug-collapsed', isCollapsed.toString());
  });

  // 尝试从本地存储加载折叠状态
  const savedCollapsed = localStorage.getItem('markdown-livesync-debug-collapsed');
  if (savedCollapsed === 'true') {
    isCollapsed = true;
    toggleButton.textContent = '展开';
    toolContent.style.display = 'none';
  }

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
 */
function showLineMarkers() {
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
 */
function hideLineMarkers() {
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