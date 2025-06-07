# Mermaid模块设计文档

## 1. 模块概述

Mermaid模块负责在Markdown文档中渲染和交互Mermaid图表。该模块包含以下主要功能：
- 图表渲染
- 交互控制（缩放、平移、全屏）
- 自适应布局
- 错误处理

## 2. 架构设计

### 2.1 核心组件

```
Mermaid模块
├── 解析器 (mermaidPlugin.ts)
│   ├── 图表类型检测
│   ├── 复杂度分析
│   └── HTML结构生成
│
├── 渲染器 (preview.js)
│   ├── 初始化配置
│   ├── 渲染逻辑
│   └── 错误处理
│
└── 样式系统 (markdown.css)
    ├── 基础样式
    ├── 交互样式
    └── 响应式布局
```

### 2.2 数据流

```
Markdown文本
    ↓
Mermaid代码块解析
    ↓
图表类型和复杂度分析
    ↓
HTML结构生成
    ↓
Mermaid渲染
    ↓
交互功能初始化
```

## 3. 详细设计

### 3.1 解析器 (mermaidPlugin.ts)

#### 3.1.1 图表类型检测
```typescript
function detectChartType(code: string): { type: string; direction: string }
```
- 输入：Mermaid代码字符串
- 输出：图表类型和方向信息
- 功能：
  - 识别图表类型（流程图、序列图等）
  - 检测图表方向（垂直/水平）
  - 返回类型和方向信息

#### 3.1.2 复杂度分析
```typescript
function analyzeChartComplexity(code: string, chartType: string, direction: string): string
```
- 输入：Mermaid代码、图表类型、方向
- 输出：复杂度级别（simple/medium/complex）
- 功能：
  - 计算节点数量
  - 计算连接数量
  - 根据图表类型和方向判断复杂度

### 3.2 渲染器 (preview.js)

#### 3.2.1 初始化配置
```javascript
function initMermaid()
```
- 功能：
  - 配置Mermaid渲染参数
  - 设置主题和样式
  - 初始化错误处理

#### 3.2.2 渲染逻辑
```javascript
function renderMermaidDiagrams()
```
- 功能：
  - 查找Mermaid容器
  - 解析图表代码
  - 执行渲染
  - 设置交互功能

#### 3.2.3 交互控制
```javascript
function handleMermaidZoom()
function toggleMermaidFullscreen()
function updateMermaidTransform()
```
- 功能：
  - 缩放控制
  - 全屏切换
  - 变换更新

### 3.3 样式系统 (markdown.css)

#### 3.3.1 基础样式
```css
.mermaid-container
.mermaid-wrapper
.mermaid
```
- 功能：
  - 容器布局
  - 图表定位
  - 基础样式设置

#### 3.3.2 交互样式
```css
.mermaid-controls
.mermaid-wrapper.fullscreen
```
- 功能：
  - 控制按钮样式
  - 全屏模式样式
  - 交互状态样式

#### 3.3.3 响应式布局
```css
@media (max-width: 768px)
@media (max-width: 576px)
```
- 功能：
  - 屏幕适配
  - 尺寸调整
  - 布局优化

## 4. 关键算法

### 4.1 复杂度分析算法
```typescript
// 纵向图表
if (direction === 'vertical') {
  if (nodeCount <= 3 && connectionCount <= 2) return 'simple';
  if (nodeCount <= 6 && connectionCount <= 8) return 'medium';
  return 'complex';
}

// 其他图表
if (nodeCount <= 3 && connectionCount <= 3) return 'simple';
if (nodeCount <= 8 && connectionCount <= 10) return 'medium';
return 'complex';
```

### 4.2 全屏缩放算法
```javascript
const scaleX = (windowWidth * 0.8) / svgRect.width;
const scaleY = (windowHeight * 0.8) / svgRect.height;
const scale = Math.min(scaleX, scaleY);
```

## 5. 错误处理

### 5.1 渲染错误
```javascript
function handleMermaidRenderError(element, error, mermaidCode, index)
```
- 功能：
  - 显示错误信息
  - 提供错误代码
  - 给出解决建议

### 5.2 交互错误
- 缩放限制：0.5x - 3x
- 全屏模式异常处理
- 拖拽边界检查

## 6. 性能优化

### 6.1 渲染优化
- 延迟加载
- 缓存机制
- 按需渲染

### 6.2 交互优化
- 防抖处理
- 事件委托
- 状态缓存

## 7. 扩展性

### 7.1 图表类型扩展
- 支持新增图表类型
- 自定义渲染配置
- 类型特定处理

### 7.2 交互功能扩展
- 自定义控制按钮
- 扩展交互方式
- 自定义样式

## 8. 测试策略

### 8.1 单元测试
- 类型检测测试
- 复杂度分析测试
- 渲染功能测试

### 8.2 集成测试
- 完整渲染流程
- 交互功能测试
- 错误处理测试

### 8.3 性能测试
- 渲染性能
- 交互响应
- 内存使用 