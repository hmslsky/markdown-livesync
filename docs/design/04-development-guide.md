# 4. 开发指南

## 4.1 开发环境设置

### 4.1.1 环境要求
- Node.js (v16+)
- VS Code/Cursor
- Git
- TypeScript

### 4.1.2 安装步骤
```bash
# 克隆项目
git clone [项目地址]
cd markdown-livesync

# 安装依赖
npm install

# 编译项目
npm run compile
```

### 4.1.3 开发工具配置
1. VS Code 设置
   ```json
   {
     "typescript.tsdk": "node_modules/typescript/lib",
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

2. 调试配置
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Run Extension",
         "type": "extensionHost",
         "request": "launch",
         "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
       }
     ]
   }
   ```

## 4.2 开发流程

### 4.2.1 代码规范
1. TypeScript 规范
   - 使用严格模式
   - 类型注解
   - 接口定义
   - 命名规范

2. 代码风格
   - ESLint 规则
   - Prettier 格式化
   - 注释规范

3. 提交规范
   ```
   feat: 新功能
   fix: 修复
   docs: 文档
   style: 格式
   refactor: 重构
   test: 测试
   chore: 构建
   ```

### 4.2.2 开发流程
1. 功能开发
   - 创建功能分支
   - 编写代码
   - 单元测试
   - 代码审查

2. 测试流程
   - 单元测试
   - 集成测试
   - 性能测试
   - 兼容性测试

3. 发布流程
   - 版本更新
   - 更新日志
   - 打包发布
   - 文档更新

## 4.3 调试指南

### 4.3.1 本地调试
1. 启动调试
   - 按 F5 启动调试
   - 选择 "Run Extension" 配置
   - 新窗口打开

2. 断点调试
   - 设置断点
   - 查看变量
   - 单步执行
   - 调用栈分析

3. 日志调试
   ```typescript
   // 信息日志
   vscode.window.showInformationMessage('信息');
   
   // 警告日志
   vscode.window.showWarningMessage('警告');
   
   // 错误日志
   vscode.window.showErrorMessage('错误');
   ```

### 4.3.2 性能调试
1. 性能分析
   - CPU 分析
   - 内存分析
   - 网络分析

2. 性能优化
   - 代码优化
   - 资源优化
   - 缓存优化

## 4.4 测试指南

### 4.4.1 单元测试
1. 测试框架
   ```typescript
   import * as assert from 'assert';
   import * as vscode from 'vscode';
   
   suite('Extension Test Suite', () => {
     test('测试用例', () => {
       assert.strictEqual(1 + 1, 2);
     });
   });
   ```

2. 测试覆盖
   - 功能测试
   - 边界测试
   - 错误测试

### 4.4.2 集成测试
1. 端到端测试
   - 用户操作模拟
   - 功能流程测试
   - 性能测试

2. 兼容性测试
   - 浏览器兼容性
   - 编辑器兼容性
   - 系统兼容性

## 4.5 发布指南

### 4.5.1 版本管理
1. 版本号规则
   - 主版本号：不兼容的 API 修改
   - 次版本号：向下兼容的功能性新增
   - 修订号：向下兼容的问题修正

2. 更新日志
   ```markdown
   # 更新日志
   
   ## [版本号] - 日期
   - 新功能
   - 修复
   - 改进
   ```

### 4.5.2 打包发布
1. 打包
   ```bash
   # 安装 vsce
   npm install -g @vscode/vsce
   
   # 打包
   vsce package
   ```

2. 发布
   ```bash
   # 发布到市场
   vsce publish
   ```

## 4.6 贡献指南

### 4.6.1 代码贡献
1. 提交流程
   - Fork 项目
   - 创建分支
   - 提交代码
   - 发起 PR

2. 代码审查
   - 功能完整性
   - 代码质量
   - 测试覆盖
   - 文档更新

### 4.6.2 文档贡献
1. 文档类型
   - 使用文档
   - API 文档
   - 开发文档
   - 示例文档

2. 文档规范
   - Markdown 格式
   - 结构清晰
   - 示例完整
   - 及时更新 