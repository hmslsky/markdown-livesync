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

  // 创建目录控制面板
  let controlsHtml = `
    <div id="toc-controls">
      <div id="toc-level-control">
        <span id="toc-level-label">快捷操作:</span>
        <button class="toc-level-button ${expandLevel === 0 ? 'active' : ''}" data-level="0">全部折叠</button>
        <button class="toc-level-button ${expandLevel === 1 ? 'active' : ''}" data-level="1">1级</button>
        <button class="toc-level-button ${expandLevel === 2 ? 'active' : ''}" data-level="2">2级</button>
        <button class="toc-level-button ${expandLevel === 3 ? 'active' : ''}" data-level="3">3级</button>
        <button class="toc-level-button ${expandLevel === -1 ? 'active' : ''}" data-level="-1">全部展开</button>
      </div>
    </div>
  `;

  // 创建目录HTML，从根ul元素开始
  let html = '<ul class="toc-root">';
  let lastLevel = 0; // 跟踪上一个处理的目录项级别

  // 用于跟踪每个目录项是否有子项
  const levelChildCount = {};

  // 第一遍遍历，计算每个目录项是否有子项
  // 通过比较相邻项的级别来确定
  tocItems.forEach((item, index) => {
    // 如果下一项的级别比当前项大，则当前项有子项
    // 例如：当前项是h2，下一项是h3，则当前h2有子项
    if (index < tocItems.length - 1 && tocItems[index + 1].level > item.level) {
      levelChildCount[index] = true;
    }
  });

  // 第二遍遍历，生成HTML
  tocItems.forEach((item, index) => {
    // 处理缩进和嵌套结构
    if (item.level > lastLevel) {
      // 如果当前项级别大于上一项，需要增加嵌套
      // 例如：从h1到h2，需要开始一个新的子列表
      const diff = item.level - lastLevel;
      for (let i = 0; i < diff; i++) {
        // 添加可折叠的子列表
        // 根据展开层级配置决定是否默认显示
        // 注意：这里的判断逻辑是关键
        // expandLevel === -1: 全部展开
        // expandLevel === 0: 全部折叠
        // 否则: 如果当前级别 < 展开层级，则显示
        const parentLevel = lastLevel + i; // 父级标题的级别
        let isVisible = false;

        if (expandLevel === -1) {
          // 全部展开
          isVisible = true;
        } else if (expandLevel === 0) {
          // 全部折叠
          isVisible = false;
        } else if (expandLevel === 1) {
          // 1级：只显示直接在根下的子列表
          isVisible = parentLevel === 0;
        } else {
          // 其他级别：如果父级别 < 展开级别，则显示
          isVisible = parentLevel < expandLevel;
        }

        console.log(`子列表父级级别: ${parentLevel}, 展开层级: ${expandLevel}, 是否显示: ${isVisible}`);
        html += `<ul class="toc-sublist" style="display: ${isVisible ? 'block' : 'none'};">`;
      }
    } else if (item.level < lastLevel) {
      // 如果当前项级别小于上一项，需要减少嵌套
      // 例如：从h3到h2，需要结束当前子列表
      const diff = lastLevel - item.level;
      for (let i = 0; i < diff; i++) {
        html += '</ul>';
      }
    }

    // 检查当前项是否有子项
    const hasChildren = levelChildCount[index];

    // 添加目录项，包含展开/折叠按钮（如果有子项）
    html += '<li>';

    // 如果有子项，添加展开/折叠按钮
    if (hasChildren) {
      // 根据展开层级配置决定按钮的初始状态
      // 注意：这里的判断逻辑需要与updateTocExpandState函数保持一致
      let isExpanded = false;

      if (expandLevel === -1) {
        // 全部展开
        isExpanded = true;
      } else if (expandLevel === 0) {
        // 全部折叠
        isExpanded = false;
      } else if (expandLevel === 1) {
        // 1级：只展开1级标题
        isExpanded = item.level === 1;
      } else {
        // 其他级别：如果当前级别 < 展开层级，则展开
        isExpanded = item.level < expandLevel;
      }

      const buttonClass = isExpanded ? 'expanded' : 'collapsed';
      const buttonText = isExpanded ? '▼' : '▶';
      console.log(`按钮级别: ${item.level}, 展开层级: ${expandLevel}, 是否展开: ${isExpanded}`);
      html += `<span class="toc-toggle ${buttonClass}" data-level="${item.level}">${buttonText}</span>`;
    } else {
      // 如果没有子项，添加一个占位符，保持缩进一致
      // 仍然添加data-level属性，以便updateTocExpandState函数可以处理
      html += `<span class="toc-toggle-placeholder" data-level="${item.level}"></span>`;
    }

    // 添加链接，包含必要的属性：
    // href: 链接到对应的锚点
    // data-level: 目录项的级别，用于样式和行为控制
    html += `<a href="#heading-${index + 1}" data-level="${item.level}">${item.text}</a></li>`;

    // 更新lastLevel为当前项的级别，用于下一次迭代
    lastLevel = item.level;
  });

  // 关闭所有未关闭的ul标签
  // 这确保了HTML结构的完整性
  for (let i = 0; i < lastLevel; i++) {
    html += '</ul>';
  }

  html += '</ul>';

  // 更新目录内容，包括控制面板和目录树
  tocContentElement.innerHTML = controlsHtml + html;

  // 为目录项添加点击事件
  // 选择所有目录链接并为每个链接添加点击事件监听器
  tocContentElement.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      // 阻止默认的链接跳转行为，我们将使用自定义的滚动逻辑
      e.preventDefault();

      // 获取链接的重要属性
      const targetId = link.getAttribute('href').substring(1); // 去掉开头的#
      console.log(`目录项点击: 目标ID = ${targetId}`);

      // 只通过ID查找元素
      const targetElement = document.getElementById(targetId);

      // 如果找到了目标元素
      if (targetElement) {
        console.log(`找到目标元素: ${targetElement.tagName}`);

        // 滚动到目标元素
        // behavior: 'smooth' 使滚动平滑进行
        // block: 'start' 使元素在视口顶部附近显示
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // 显示指示器，提示用户已跳转到哪个标题
        showHeadingIndicator(targetElement);

        console.log(`已滚动到目标元素`);
      } else {
        console.log(`未找到ID为 ${targetId} 的元素`);
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
 * 这些ID用于目录导航和锚点链接。同时，它也为带有行号标记的元素添加ID。
 *
 * 添加ID的好处：
 * 1. 允许通过目录直接跳转到特定标题
 * 2. 使得可以通过URL片段（如#section-1）直接导航到特定部分
 * 3. 提高查找和滚动到特定元素的效率
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
      // 使用带索引的ID格式
      heading.id = `heading-${index + 1}`;
      console.log(`为标题添加ID: ${heading.id}`);
    }
  });

  // 为所有带有data-line属性的元素添加ID
  // 这些元素是在服务器端添加了行号标记的内容元素
  const lineElements = contentElement.querySelectorAll('[data-line]');
  lineElements.forEach(element => {
    // 如果元素还没有ID
    if (!element.id) {
      // 使用行号创建ID
      const lineNumber = element.getAttribute('data-line');
      element.id = `line-${lineNumber}`;
      // 这样可以通过 #line-123 直接跳转到特定行
    }
  });
}

/**
 * 高亮元素
 */
function highlightElement(element) {
  element.classList.add('highlight-line');

  // 3秒后移除高亮
  setTimeout(() => {
    element.classList.remove('highlight-line');
  }, 3000);
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
 * 根据优化后的规则，查找小于该光标行号的最大块元素位置，然后滚动到该位置。
 * 每个块元素记录行号，行号不连续，考虑块元素内内容的换行符。
 * 代码块的开始和结束标记以及代码块内的内容都会被计入行号统计。
 *
 * @param {number} lineNumber - 编辑器中的行号
 * @param {boolean} highlight - 是否高亮显示目标元素，默认为false
 */
function scrollToLine(lineNumber, highlight = false) {
  console.log(`尝试滚动到行: ${lineNumber}`);

  // 显示当前行号指示器，让用户知道当前光标位置
  showLineIndicator(lineNumber);

  // 获取所有带有行号属性的块元素
  const blockElements = contentElement.querySelectorAll('[data-line-start][data-line-end]');

  if (blockElements.length > 0) {
    console.log(`找到 ${blockElements.length} 个带有行号范围的块元素`);

    // 查找小于等于当前光标行号的最大行号的块元素
    let targetElement = null;
    let maxLineNumber = 0;

    // 首先尝试查找精确匹配当前行号的元素
    let exactMatchElement = null;
    for (const element of blockElements) {
      const elementLine = parseInt(element.getAttribute('data-line'), 10);
      if (elementLine === lineNumber) {
        exactMatchElement = element;
        console.log(`找到精确匹配行号 ${lineNumber} 的元素: ${element.tagName}`);
        break;
      }
    }

    // 如果找到了精确匹配的元素，直接使用它
    if (exactMatchElement) {
      targetElement = exactMatchElement;
    } else {
      // 尝试查找包含当前行号的块元素
      for (const element of blockElements) {
        const startLine = parseInt(element.getAttribute('data-line-start'), 10);
        const endLine = parseInt(element.getAttribute('data-line-end'), 10);

        // 如果当前行号在块元素的行号范围内，直接使用这个元素
        if (lineNumber >= startLine && lineNumber <= endLine) {
          console.log(`找到包含行 ${lineNumber} 的块元素: ${element.tagName}, 范围: ${startLine}-${endLine}`);
          targetElement = element;
          break;
        }

        // 如果块元素的起始行号小于等于当前行号，且大于已找到的最大行号
        if (startLine <= lineNumber && startLine > maxLineNumber) {
          maxLineNumber = startLine;
          targetElement = element;
        }
      }
    }

    // 如果找到了目标元素
    if (targetElement) {
      // 获取元素的行号信息
      const startLine = targetElement.hasAttribute('data-line-start')
        ? parseInt(targetElement.getAttribute('data-line-start'), 10)
        : parseInt(targetElement.getAttribute('data-line'), 10);

      const endLine = targetElement.hasAttribute('data-line-end')
        ? parseInt(targetElement.getAttribute('data-line-end'), 10)
        : startLine;

      console.log(`滚动到块元素: ${targetElement.tagName}, 行号范围: ${startLine}-${endLine}`);

      // 滚动到目标元素
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // 如果需要高亮显示
      if (highlight) {
        highlightElement(targetElement);
      }

      return;
    }
  }

  // 如果没有找到合适的块元素，尝试使用行号标记
  const lineMarkers = contentElement.querySelectorAll('.line-marker[data-line]');

  if (lineMarkers.length > 0) {
    console.log(`找到 ${lineMarkers.length} 个行号标记元素`);

    // 首先尝试查找精确匹配当前行号的标记
    let exactMatchMarker = null;
    for (const marker of lineMarkers) {
      const markerLine = parseInt(marker.getAttribute('data-line'), 10);
      if (markerLine === lineNumber) {
        exactMatchMarker = marker;
        console.log(`找到精确匹配行号 ${lineNumber} 的标记`);
        break;
      }
    }

    // 如果找到了精确匹配的标记，直接使用它
    if (exactMatchMarker) {
      exactMatchMarker.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }

    // 如果没有找到精确匹配的标记，查找小于等于当前光标行号的最大行号的标记
    let targetMarker = null;
    let maxLineNumber = 0;

    for (const marker of lineMarkers) {
      const markerLine = parseInt(marker.getAttribute('data-line'), 10);

      // 如果标记的行号小于等于当前行号，且大于已找到的最大行号
      if (markerLine <= lineNumber && markerLine > maxLineNumber) {
        maxLineNumber = markerLine;
        targetMarker = marker;
      }
    }

    // 如果找到了目标标记
    if (targetMarker) {
      const markerLine = parseInt(targetMarker.getAttribute('data-line'), 10);
      console.log(`滚动到行号标记: 行号: ${markerLine}`);

      // 滚动到目标标记
      targetMarker.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      return;
    }
  }

  // 尝试查找精确匹配当前行号的任何元素
  const exactLineElements = contentElement.querySelectorAll(`[data-line="${lineNumber}"]`);
  if (exactLineElements.length > 0) {
    const exactElement = exactLineElements[0];
    console.log(`找到精确匹配行号 ${lineNumber} 的元素: ${exactElement.tagName}`);

    exactElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    if (highlight) {
      highlightElement(exactElement);
    }

    return;
  }

  // 如果上述方法都失败，尝试使用ID为line-{lineNumber}的元素
  const lineIdElement = document.getElementById(`line-${lineNumber}`);
  if (lineIdElement) {
    console.log(`找到ID为line-${lineNumber}的元素`);

    lineIdElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    if (highlight) {
      highlightElement(lineIdElement);
    }

    return;
  }

  // 如果所有方法都失败，回退到比例方法
  console.log('所有精确定位方法都失败，回退到比例方法');
  scrollToLineByRatio(lineNumber);
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
 */
function showHeadingIndicator(headingElement) {
  // 获取标题文本
  const headingText = headingElement.textContent.trim();

  // 移除旧的指示器
  const oldIndicator = document.getElementById('heading-indicator');
  if (oldIndicator) {
    oldIndicator.remove();
  }

  // 创建新的指示器
  const indicator = document.createElement('div');
  indicator.id = 'heading-indicator';
  indicator.textContent = `跳转到: ${headingText}`;
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.left = '50%';
  indicator.style.transform = 'translateX(-50%)';
  indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  indicator.style.color = 'white';
  indicator.style.padding = '5px 10px';
  indicator.style.borderRadius = '3px';
  indicator.style.fontSize = '12px';
  indicator.style.zIndex = '9999';
  indicator.style.opacity = '0.8';
  indicator.style.maxWidth = '80%';
  indicator.style.overflow = 'hidden';
  indicator.style.textOverflow = 'ellipsis';
  indicator.style.whiteSpace = 'nowrap';

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
 * 使用比例方法滚动到指定行（回退方法）
 *
 * 当无法通过data-line属性精确定位时，使用这个方法作为回退。
 * 它基于文档的总行数和当前行号的比例来计算滚动位置。
 *
 * @param {number} lineNumber - 编辑器中的行号
 */
function scrollToLineByRatio(lineNumber) {
  // 获取文档总行数
  const totalLinesElement = contentElement.querySelector('[data-total-lines]');
  let totalLines = 100; // 默认值

  if (totalLinesElement) {
    totalLines = parseInt(totalLinesElement.getAttribute('data-total-lines'), 10);
  }

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

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('收到WebSocket消息:', message);

      if (message.type === 'update') {
        console.log('收到文档更新');

        // 更新内容
        contentElement.innerHTML = message.html;

        // 为所有标题元素添加ID
        addIdsToHeadings();

        // 更新目录
        renderToc(message.toc);

        // 保持滚动位置
        const scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;
        window.scrollTo(0, scrollPosition);
      }
      else if (message.type === 'cursorMove') {
        console.log(`收到光标位置更新: 行 ${message.lineNumber}`);

        // 滚动到光标位置，不高亮显示
        // 使用setTimeout确保DOM已完全加载
        setTimeout(() => {
          scrollToLine(message.lineNumber, false);
        }, 10);
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