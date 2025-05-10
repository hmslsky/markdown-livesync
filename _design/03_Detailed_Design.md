# 详细设计文档 (Detailed Design)

## 1. 引言 (Introduction)
- 1.1 目的 (Purpose)
  - 本文档详细描述KRobot个人助手VS Code/Cursor插件的设计细节
- 1.2 范围 (Scope)
  - 本文档涵盖插件的模块设计、类设计、数据流和算法设计
- 1.3 定义与缩写 (Definitions and Abbreviations)
  - VS Code: Visual Studio Code
  - API: Application Programming Interface
  - UI: User Interface
  - DOM: Document Object Model
- 1.4 参考文献 (References)
  - VS Code Extension API: https://code.visualstudio.com/api
  - Markdown-it: https://github.com/markdown-it/markdown-it
  - Express.js: https://expressjs.com/

## 2. 设计概述 (Design Overview)
- 2.1 设计原则 (Design Principles)
  - 模块化：将功能划分为独立模块，降低耦合度
  - 可扩展性：设计应支持未来功能的扩展
  - 用户体验：提供简单直观的界面和流畅的操作体验
  - 性能优先：优化性能，减少资源占用
- 2.2 设计模式 (Design Patterns)
  - 命令模式：用于实现编辑器命令
  - 观察者模式：用于处理文档变化和位置同步
  - 单例模式：用于服务器和核心服务
  - MVC模式：分离数据、视图和控制逻辑
- 2.3 设计约束 (Design Constraints)
  - VS Code扩展API的限制
  - 浏览器安全限制
  - 跨平台兼容性要求

## 3. 模块设计 (Module Design)
- 3.1 模块划分 (Module Division)
  - 核心模块 (Core)：插件的入口点和生命周期管理
  - 命令模块 (Commands)：处理用户命令
  - Markdown处理模块 (Markdown)：解析和处理Markdown内容
  - 服务器模块 (Server)：提供HTTP服务
  - 浏览器集成模块 (Browser)：与浏览器通信
  - 工具模块 (Utils)：提供通用工具函数
- 3.2 模块职责 (Module Responsibilities)
  - 核心模块：
    - 初始化插件
    - 管理插件生命周期
    - 协调各模块之间的交互
  - 命令模块：
    - 注册VS Code命令
    - 处理命令执行逻辑
    - 提供用户反馈
  - Markdown处理模块：
    - 解析Markdown内容
    - 转换为HTML
    - 处理图片和链接路径
  - 服务器模块：
    - 启动和管理HTTP服务器
    - 处理API请求
    - 提供预览页面
  - 浏览器集成模块：
    - 打开浏览器
    - 管理浏览器通信
  - 工具模块：
    - 提供通用工具函数
    - 处理错误和日志
- 3.3 模块依赖关系 (Module Dependencies)
  - 核心模块依赖于命令模块和服务器模块
  - 命令模块依赖于服务器模块和浏览器集成模块
  - 服务器模块依赖于Markdown处理模块
  - 所有模块可能依赖于工具模块

## 4. 类设计 (Class Design)
- 4.1 类图 (Class Diagrams)
  - 核心类：
    ```
    extension.ts
    ├── activate()
    └── deactivate()
    ```
  - 命令类：
    ```
    commands.ts
    ├── registerCommands()
    └── openMarkdownInBrowser()
    ```
  - 服务器类：
    ```
    MarkdownServer
    ├── constructor()
    ├── setupServer()
    ├── startServer()
    ├── openPreview()
    ├── closePreviewForDocument()
    └── dispose()
    ```
  - Markdown处理类：
    ```
    MarkdownProcessor
    ├── constructor()
    ├── configurePlugins()
    ├── convertToHtml()
    └── resolveImagePaths()
    ```
  - 浏览器集成类：
    ```
    browserIntegration.ts
    └── openBrowser()
    ```
- 4.2 类职责 (Class Responsibilities)
  - extension.ts：插件入口点，负责初始化和清理
  - commands.ts：注册和实现命令
  - MarkdownServer：管理HTTP服务器和预览
  - MarkdownProcessor：处理Markdown内容转换
  - browserIntegration.ts：处理浏览器打开和通信
- 4.3 类关系 (Class Relationships)
  - extension.ts创建MarkdownServer实例
  - extension.ts调用commands.ts中的registerCommands()
  - commands.ts使用MarkdownServer实例
  - MarkdownServer使用MarkdownProcessor处理内容
  - MarkdownServer通过browserIntegration.ts打开浏览器

## 5. 数据流设计 (Data Flow Design)
- 5.1 数据模型 (Data Models)
  - Markdown文档模型：表示当前编辑的Markdown文件
    - 文件路径
    - 文件内容
    - 编辑位置
  - 配置模型：存储用户配置
    - 浏览器路径
    - 其他设置
- 5.2 数据流程 (Data Flow Processes)
  - Markdown预览流程：
    1. 用户触发预览命令
    2. 获取当前文档内容和光标位置
    3. 启动HTTP服务器（如果未启动）
    4. 将文档内容转换为HTML
    5. 在浏览器中打开预览页面
    6. 同步光标位置到预览
  - 配置流程：
    1. 读取用户配置
    2. 应用配置到相应模块

## 6. 算法设计 (Algorithm Design)
- 6.1 关键算法 (Key Algorithms)
  - Markdown到HTML转换算法：
    - 使用Markdown-it库解析Markdown
    - 处理特殊语法和扩展
  - 编辑位置同步算法：
    - 将编辑器行号映射到HTML元素
    - 计算滚动位置
  - 图片路径解析算法：
    - 将相对路径转换为绝对路径
- 6.2 算法复杂度分析 (Algorithm Complexity Analysis)
  - Markdown解析：O(n)，其中n是文档大小
  - 位置同步：O(m)，其中m是文档中的元素数量
- 6.3 优化策略 (Optimization Strategies)
  - 缓存已解析的Markdown内容
  - 增量更新而非完全重新渲染
  - 延迟加载大型文档的部分内容

## 7. 错误处理 (Error Handling)
- 7.1 错误分类 (Error Classification)
  - 用户输入错误：如非Markdown文件
  - 系统错误：如无法启动服务器
  - 网络错误：如浏览器通信失败
- 7.2 错误处理策略 (Error Handling Strategies)
  - 使用try-catch捕获异常
  - 向用户提供清晰的错误消息
  - 在错误情况下优雅降级
- 7.3 日志记录 (Logging)
  - 使用VS Code的输出通道记录日志
  - 记录关键操作和错误
  - 提供调试信息

## 8. 安全设计 (Security Design)
- 8.1 输入验证 (Input Validation)
  - 验证文件路径和URI
  - 过滤不安全的HTML内容
- 8.2 通信安全 (Communication Security)
  - 使用令牌验证浏览器请求
  - 限制服务器只接受localhost请求
- 8.3 资源保护 (Resource Protection)
  - 限制文件访问范围
  - 防止资源泄漏

## 9. 用户界面设计 (User Interface Design)
- 9.1 命令界面 (Command Interface)
  - 命令面板集成
  - 上下文菜单项
  - 快捷键绑定
- 9.2 浏览器预览界面 (Browser Preview Interface)
  - 响应式布局
  - 主题支持
  - 导航控件

## 10. 附录 (Appendices)
- 10.1 开发环境设置
- 10.2 测试计划
- 10.3 部署指南