# Markdown LiveSync 开发文档

## 开发环境设置

1. 确保已安装以下工具：
   - Node.js (推荐 v16 或更高版本)
   - Visual Studio Code
   - Git

2. 克隆项目并安装依赖：
   ```bash
   git clone [项目地址]
   cd markdown-livesync
   npm install
   ```

## 调试指南

### 本地调试

1. 启动调试模式：
   - 在 VS Code 中按 F5 或点击调试按钮
   - 选择 "Run Extension" 配置
   - 这将打开一个新的 VS Code 窗口（扩展开发主机）

2. 调试配置：
   - 在 `launch.json` 中可以配置调试参数
   - 支持断点调试
   - 可以在调试控制台查看日志输出

3. 实时调试：
   - 修改代码后，按 F5 重新启动调试会话
   - 或使用 "Reload Window" 命令刷新扩展

### 日志调试

1. 使用内置的日志系统：
   ```typescript
   import * as vscode from 'vscode';
   
   // 输出信息日志
   vscode.window.showInformationMessage('信息');
   
   // 输出警告日志
   vscode.window.showWarningMessage('警告');
   
   // 输出错误日志
   vscode.window.showErrorMessage('错误');
   ```

2. 控制台日志：
   - 在调试控制台中查看 `console.log()` 输出
   - 使用 `console.error()` 输出错误信息

## 测试指南

### 单元测试

1. 运行测试：
   ```bash
   npm test
   ```

2. 测试文件位置：
   - 测试文件位于 `tests` 目录
   - 测试文件命名格式：`*.test.ts`

3. 编写测试：
   ```typescript
   import * as assert from 'assert';
   import * as vscode from 'vscode';
   
   suite('Extension Test Suite', () => {
     test('测试用例', () => {
       assert.strictEqual(1 + 1, 2);
     });
   });
   ```

### 集成测试

1. 端到端测试：
   - 在 `tests` 目录下创建集成测试文件
   - 使用 VS Code 测试 API 模拟用户操作

2. 测试场景：
   - 文件打开/保存
   - 命令执行
   - 配置更改
   - 用户交互

### 性能测试

1. 内存使用：
   - 使用 VS Code 的性能分析工具
   - 监控内存泄漏

2. 响应时间：
   - 测试命令执行时间
   - 测试文件处理性能

## 发布流程

1. 版本更新：
   - 更新 `package.json` 中的版本号
   - 更新 `CHANGELOG.md`

2. 打包：
   ```bash
   vsce package
   ```

3. 发布：
   - 使用 `vsce publish` 发布到 VS Code 市场
   - 或手动上传 `.vsix` 文件

## 常见问题

1. 调试问题：
   - 确保已安装所有依赖
   - 检查 VS Code 版本兼容性
   - 查看调试控制台输出

2. 测试问题：
   - 确保测试环境配置正确
   - 检查测试覆盖率
   - 验证测试用例的完整性

## 贡献指南

1. 代码规范：
   - 遵循 TypeScript 编码规范
   - 使用 ESLint 进行代码检查
   - 编写清晰的注释

2. 提交规范：
   - 使用清晰的提交信息
   - 遵循 Git Flow 工作流
   - 确保代码通过所有测试

3. 文档维护：
   - 及时更新文档
   - 添加必要的注释
   - 保持文档的准确性 