# 架构设计文档 (Architecture Design)

## 1. 引言 (Introduction)
- 1.1 目的 (Purpose)
  - 本文档旨在描述KRobot个人助手VS Code/Cursor插件的架构设计
- 1.2 范围 (Scope)
  - 本文档涵盖插件的整体架构、组件设计和技术选择
- 1.3 定义与缩写 (Definitions and Abbreviations)
  - VS Code: Visual Studio Code
  - API: Application Programming Interface
  - UI: User Interface
- 1.4 参考文献 (References)
  - VS Code Extension API: https://code.visualstudio.com/api
  - Markdown-it: https://github.com/markdown-it/markdown-it

## 2. 架构目标与约束 (Architectural Goals and Constraints)
- 2.1 技术栈选择 (Technology Stack Selection)
  - TypeScript: 主要开发语言
  - VS Code Extension API: 插件开发框架
  - Node.js: 运行时环境
  - Markdown-it: Markdown解析库
- 2.2 质量属性 (Quality Attributes)
  - 性能: 插件应当轻量化，不影响编辑器性能
  - 可用性: 提供简单直观的用户界面
  - 可扩展性: 设计应支持未来功能的扩展
- 2.3 架构约束 (Architectural Constraints)
  - 必须兼容VS Code和Cursor编辑器
  - 必须遵循VS Code扩展开发规范

## 3. 系统架构 (System Architecture)
- 3.1 整体架构 (Overall Architecture)
  - KRobot插件采用模块化架构，主要包含以下组件：
    - 核心模块：负责插件的初始化和生命周期管理
    - 命令模块：注册和处理用户命令
    - Markdown处理模块：解析和处理Markdown文件
    - 浏览器集成模块：负责与浏览器通信，实现Markdown预览
    - 状态同步模块：同步编辑器和浏览器预览的位置
- 3.2 物理部署视图 (Physical Deployment View)
  - 插件部署在用户的VS Code或Cursor编辑器中
  - 浏览器预览在用户的默认浏览器中运行
  - 插件与浏览器通过本地HTTP服务器通信
- 3.3 逻辑架构视图 (Logical Architecture View)
  - 插件遵循VS Code扩展的MVC架构模式：
    - 模型(Model)：Markdown文档数据和状态
    - 视图(View)：浏览器中的Markdown渲染结果
    - 控制器(Controller)：处理用户命令和同步编辑位置

## 4. 接口设计 (Interface Design)
- 4.1 用户接口 (User Interface)
  - 编辑器命令：通过命令面板或快捷键触发Markdown预览
  - 状态栏：显示预览状态和同步信息
  - 上下文菜单：右键菜单中添加Markdown预览选项
- 4.2 程序接口 (Programming Interface)
  - VS Code API：与编辑器交互的接口
  - 浏览器通信接口：与浏览器预览页面通信的接口

## 5. 数据架构 (Data Architecture)
- 5.1 数据模型 (Data Model)
  - Markdown文档模型：表示当前编辑的Markdown文件
  - 位置模型：表示编辑器中的光标位置和滚动位置
  - 配置模型：存储用户配置信息
- 5.2 数据流 (Data Flow)
  - 编辑器 -> 插件：获取Markdown内容和光标位置
  - 插件 -> 浏览器：发送Markdown内容和位置信息
  - 浏览器 -> 插件：发送用户在预览中的交互信息
- 5.3 数据存储 (Data Storage)
  - 配置存储：使用VS Code的扩展配置存储机制
  - 临时数据：运行时内存中的临时数据

## 6. 安全架构 (Security Architecture)
- 6.1 认证与授权 (Authentication and Authorization)
  - 插件不需要特殊的认证机制，依赖VS Code的权限系统
- 6.2 数据安全 (Data Security)
  - 所有数据处理在本地进行，不传输用户数据到外部服务器
- 6.3 通信安全 (Communication Security)
  - 本地HTTP服务器仅监听localhost，减少外部访问风险
  - 使用随机端口和令牌验证浏览器请求的合法性

## 7. 性能与可扩展性 (Performance and Scalability)
- 7.1 性能考量 (Performance Considerations)
  - 异步处理Markdown解析，避免阻塞主线程
  - 增量更新预览内容，减少完整重新渲染的频率
  - 延迟加载非核心功能，减少启动时间
- 7.2 扩展策略 (Scaling Strategies)
  - 模块化设计，便于添加新功能
  - 插件API设计，支持未来功能扩展
- 7.3 资源管理 (Resource Management)
  - 合理管理内存使用，避免内存泄漏
  - 在不需要时释放资源，如关闭HTTP服务器

## 8. 风险与缓解策略 (Risks and Mitigation Strategies)
- 8.1 兼容性风险
  - 风险：VS Code和Cursor版本更新可能导致API变化
  - 缓解：使用稳定API，定期测试兼容性
- 8.2 性能风险
  - 风险：大型Markdown文件可能导致性能问题
  - 缓解：实现虚拟滚动和延迟加载机制
- 8.3 安全风险
  - 风险：本地服务器可能被恶意利用
  - 缓解：限制只接受localhost请求，使用令牌验证

## 9. 附录 (Appendices)
- 9.1 技术选型详情
  - VS Code Extension API v1.60+
  - TypeScript 4.5+
  - Node.js 14+
  - Express.js (用于本地HTTP服务器)
  - Markdown-it (用于Markdown解析)
- 9.2 项目目录结构
  - src/: 源代码目录
    - extension.ts: 插件入口点
    - commands/: 命令实现
    - markdown/: Markdown处理逻辑
    - server/: 本地HTTP服务器
    - browser/: 浏览器集成
    - utils/: 工具函数
  - webview/: 浏览器预览页面资源
  - package.json: 插件配置
  - tsconfig.json: TypeScript配置