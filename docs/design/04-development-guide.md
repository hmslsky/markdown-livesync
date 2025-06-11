# 4. 开发指南

## 4.1 开发环境设置

### 4.1.1 环境要求
- **Node.js**: v16+ (推荐使用最新LTS版本)
- **VS Code**: v1.75.0+ (支持最新Extension API)
- **Git**: 用于版本控制
- **TypeScript**: v4.5+ (已包含在依赖中)

### 4.1.2 安装步骤
```bash
# 克隆项目
git clone https://github.com/hmslsky/markdown-livesync.git
cd markdown-livesync

# 安装依赖
npm install

# 编译项目
npm run compile

# 监视文件变化（开发时使用）
npm run watch
```

### 4.1.3 VSCode开发环境配置

#### 推荐的VSCode设置 (.vscode/settings.json)
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.updateImportsOnFileMove.enabled": "always",
  "files.exclude": {
    "out/": true,
    "node_modules/": true,
    "*.vsix": true
  }
}
```

#### 调试配置 (.vscode/launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "运行扩展",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ],
      "preLaunchTask": "${workspaceFolder}/.vscode/tasks.json:npm: compile"
    },
    {
      "name": "扩展测试",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/out/test/**/*.js"
      ],
      "preLaunchTask": "${workspaceFolder}/.vscode/tasks.json:npm: compile"
    }
  ]
}
```

#### 构建任务 (.vscode/tasks.json)
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "compile",
      "group": "build",
      "presentation": {
        "reveal": "silent"
      },
      "problemMatcher": [
        "$tsc"
      ]
    },
    {
      "type": "npm",
      "script": "watch",
      "group": "build",
      "presentation": {
        "reveal": "silent"
      },
      "isBackground": true,
      "problemMatcher": [
        "$tsc-watch"
      ]
    },
    {
      "type": "npm",
      "script": "lint",
      "group": "test",
      "presentation": {
        "reveal": "silent"
      }
    }
  ]
}
```

## 4.2 代码规范和最佳实践

### 4.2.1 TypeScript 编码规范

#### 命名规范
```typescript
// 类名使用PascalCase
export class MarkdownPreviewPanel {
  // 私有成员使用_前缀
  private _panel: vscode.WebviewPanel;
  
  // 常量使用UPPER_SNAKE_CASE
  private static readonly DEFAULT_TIMEOUT = 5000;
  
  // 方法和变量使用camelCase
  public updateContent(): void {
    const currentDocument = this.getCurrentDocument();
  }
}

// 接口使用PascalCase，可选择I前缀
export interface IPreviewConfig {
  showToc: boolean;
  syncScroll: boolean;
}

// 枚举使用PascalCase
export enum PreviewMode {
  Side = 'side',
  Window = 'window'
}
```

#### 类型安全规范
```typescript
// 明确的类型定义
interface MarkdownContent {
  content: string;
  lineCount: number;
  lastModified: Date;
}

// 使用泛型确保类型安全
export class ConfigurationManager {
  public get<T>(key: string, defaultValue?: T): T {
    return vscode.workspace.getConfiguration('markdown-livesync').get(key, defaultValue!);
  }
}

// 使用联合类型限制取值范围
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 使用类型守卫
function isValidMessage(message: any): message is WebViewMessage {
  return message && typeof message.type === 'string';
}
```

### 4.2.2 错误处理规范

#### 统一的错误处理模式
```typescript
export class OperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

// 错误处理装饰器
export function handleErrors(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      Logger.error(`${propertyKey} 操作失败: ${(error as Error).message}`);
      throw new OperationError(
        `${propertyKey} 操作失败`,
        propertyKey,
        error as Error
      );
    }
  };
  
  return descriptor;
}

// 使用示例
export class MarkdownProcessor {
  @handleErrors
  public async convertToHtml(markdown: string): Promise<string> {
    // 具体实现
  }
}
```

### 4.2.3 日志记录规范

#### 日志级别和格式
```typescript
export class Logger {
  private static readonly LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  } as const;

  private static currentLevel: keyof typeof Logger.LOG_LEVELS = 'info';

  public static setLevel(level: keyof typeof Logger.LOG_LEVELS): void {
    Logger.currentLevel = level;
  }

  private static shouldLog(level: keyof typeof Logger.LOG_LEVELS): boolean {
    return Logger.LOG_LEVELS[level] >= Logger.LOG_LEVELS[Logger.currentLevel];
  }

  public static debug(message: string, data?: any): void {
    if (Logger.shouldLog('debug')) {
      console.debug(`[${new Date().toISOString()}] [DEBUG] ${message}`, data || '');
    }
  }

  public static info(message: string, data?: any): void {
    if (Logger.shouldLog('info')) {
      console.log(`[${new Date().toISOString()}] [INFO] ${message}`, data || '');
    }
  }

  public static warn(message: string, data?: any): void {
    if (Logger.shouldLog('warn')) {
      console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, data || '');
    }
  }

  public static error(message: string, error?: Error | any): void {
    if (Logger.shouldLog('error')) {
      console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error || '');
    }
  }
}
```

## 4.3 开发流程

### 4.3.1 功能开发流程

#### 1. 创建功能分支
```bash
# 基于main分支创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

#### 2. 开发功能
```typescript
// 1. 在相应模块中添加接口定义
export interface NewFeatureConfig {
  enabled: boolean;
  options: Record<string, any>;
}

// 2. 更新配置管理器
export class ConfigurationManager {
  public getNewFeatureConfig(): NewFeatureConfig {
    const config = vscode.workspace.getConfiguration('markdown-livesync.newFeature');
    return {
      enabled: config.get('enabled', false),
      options: config.get('options', {})
    };
  }
}

// 3. 实现功能逻辑
export class NewFeatureHandler {
  private config: NewFeatureConfig;

  constructor() {
    this.config = ConfigurationManager.getInstance().getNewFeatureConfig();
  }

  @handleErrors
  public async executeFeature(): Promise<void> {
    if (!this.config.enabled) {
      Logger.debug('新功能未启用');
      return;
    }

    Logger.info('执行新功能...');
    // 功能实现
  }
}

// 4. 集成到主要模块
export class Extension {
  private newFeatureHandler: NewFeatureHandler;

  public async activate(): Promise<void> {
    // ... 其他初始化代码
    this.newFeatureHandler = new NewFeatureHandler();
  }
}
```

#### 3. 添加配置项到package.json
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "markdown-livesync.newFeature.enabled": {
          "type": "boolean",
          "default": false,
          "description": "启用新功能"
        },
        "markdown-livesync.newFeature.options": {
          "type": "object",
          "default": {},
          "description": "新功能配置选项"
        }
      }
    }
  }
}
```

### 4.3.2 测试驱动开发

#### 单元测试示例
```typescript
// test/unit/markdown-processor.test.ts
import * as assert from 'assert';
import { MarkdownProcessor } from '../../src/markdown/markdown-processor';

suite('MarkdownProcessor Tests', () => {
  let processor: MarkdownProcessor;

  setup(() => {
    processor = MarkdownProcessor.getInstance();
  });

  test('应该正确转换基本Markdown', () => {
    const markdown = '# 标题\n\n这是一个段落。';
    const html = processor.convertToHtml(markdown);
    
    assert.ok(html.includes('<h1'));
    assert.ok(html.includes('标题'));
    assert.ok(html.includes('<p>'));
    assert.ok(html.includes('这是一个段落。'));
  });

  test('应该处理Mermaid图表', () => {
    const markdown = '```mermaid\ngraph TD\n  A --> B\n```';
    const html = processor.convertToHtml(markdown);
    
    assert.ok(html.includes('class="mermaid"'));
    assert.ok(html.includes('graph TD'));
  });

  test('应该添加行号属性', () => {
    const markdown = '# 标题\n\n段落内容';
    const html = processor.convertToHtml(markdown);
    
    assert.ok(html.includes('data-line="0"'));
    assert.ok(html.includes('data-line="2"'));
  });
});
```

#### 集成测试示例
```typescript
// test/integration/preview-panel.test.ts
import * as vscode from 'vscode';
import * as assert from 'assert';
import { MarkdownPreviewPanel } from '../../src/preview/markdown-preview-panel';

suite('MarkdownPreviewPanel Integration Tests', () => {
  let panel: MarkdownPreviewPanel;

  setup(() => {
    panel = MarkdownPreviewPanel.getInstance();
  });

  teardown(async () => {
    if (panel.isVisible()) {
      panel.dispose();
    }
  });

  test('应该能够显示预览面板', async () => {
    // 创建测试文档
    const document = await vscode.workspace.openTextDocument({
      content: '# 测试文档',
      language: 'markdown'
    });

    // 显示预览
    await panel.show(document, vscode.ViewColumn.Beside);

    // 验证面板已创建
    assert.ok(panel.isVisible());
  });

  test('应该响应内容更新', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '# 原始内容',
      language: 'markdown'
    });

    await panel.show(document, vscode.ViewColumn.Beside);

    // 模拟内容更新
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, new vscode.Range(0, 0, 0, 8), '# 更新内容');
    await vscode.workspace.applyEdit(edit);

    // 验证预览已更新（这里需要添加实际的验证逻辑）
    assert.ok(panel.isCurrentDocument(document));
  });
});
```

## 4.4 调试指南

### 4.4.1 本地调试

#### 启动调试会话
1. **打开项目**: 在VSCode中打开项目目录
2. **编译代码**: 运行 `npm run compile` 或启动 `npm run watch`
3. **启动调试**: 按 `F5` 或使用调试面板启动"运行扩展"配置
4. **测试功能**: 在新打开的VSCode窗口中测试插件功能

#### 调试技巧
```typescript
// 1. 使用条件断点
export class MarkdownPreviewPanel {
  public updateContent(): void {
    // 在这里设置断点，条件：document.languageId === 'markdown'
    const content = this.currentDocument?.getText();
    
    if (content) {
      // 使用调试控制台检查变量
      console.log('Document content length:', content.length);
      debugger; // 程序会在这里暂停
    }
  }
}

// 2. 使用调试输出
export class Extension {
  private logDebugInfo(): void {
    const activeEditor = vscode.window.activeTextEditor;
    Logger.debug('Active editor info', {
      fileName: activeEditor?.document.fileName,
      languageId: activeEditor?.document.languageId,
      lineCount: activeEditor?.document.lineCount
    });
  }
}
```

#### 常见调试场景
```typescript
// WebView消息调试
export class MarkdownPreviewPanel {
  private handleWebviewMessage(message: any): void {
    // 记录所有收到的消息
    Logger.debug('Received webview message', {
      type: message.type,
      data: message,
      timestamp: new Date().toISOString()
    });

    // 验证消息格式
    if (!this.validateMessage(message)) {
      Logger.warn('Invalid message format', message);
      return;
    }

    // 处理消息...
  }

  private validateMessage(message: any): boolean {
    const requiredFields = ['type'];
    return requiredFields.every(field => field in message);
  }
}
```

### 4.4.2 性能调试

#### 性能分析工具
```typescript
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();

  public static start(label: string): void {
    this.timers.set(label, performance.now());
  }

  public static end(label: string): number {
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      Logger.warn(`Performance timer '${label}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);
    
    Logger.debug(`Performance: ${label} took ${duration.toFixed(2)}ms`);
    return duration;
  }

  public static measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      return fn();
    } finally {
      this.end(label);
    }
  }

  public static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}

// 使用示例
export class MarkdownProcessor {
  public convertToHtml(markdown: string): string {
    return PerformanceMonitor.measure('markdown-conversion', () => {
      return this.md.render(markdown);
    });
  }
}
```

#### 内存使用监控
```typescript
export class MemoryMonitor {
  public static logMemoryUsage(label: string): void {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      Logger.debug(`Memory usage (${label}):`, {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`,
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`
      });
    }
  }
}
```

## 4.5 测试指南

### 4.5.1 测试策略

#### 测试金字塔
```
    E2E Tests (少量)
      ↑
  Integration Tests (适量)
      ↑  
   Unit Tests (大量)
```

#### 测试文件组织
```
tests/
├── unit/                    # 单元测试
│   ├── markdown/
│   │   ├── processor.test.ts
│   │   └── plugins.test.ts
│   ├── preview/
│   │   └── toc-provider.test.ts
│   └── utils/
│       └── logger.test.ts
├── integration/             # 集成测试
│   ├── preview-panel.test.ts
│   └── extension.test.ts
└── e2e/                     # 端到端测试
    └── full-workflow.test.ts
```

### 4.5.2 模拟和测试工具

#### VSCode API模拟
```typescript
// test/mocks/vscode-mock.ts
export const mockVSCode = {
  workspace: {
    getConfiguration: (section?: string) => ({
      get: (key: string, defaultValue?: any) => defaultValue,
      update: jest.fn()
    }),
    onDidChangeConfiguration: jest.fn(),
    onDidChangeTextDocument: jest.fn(),
    onDidCloseTextDocument: jest.fn()
  },
  window: {
    createWebviewPanel: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn(),
    onDidChangeTextEditorSelection: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  }
};

// 在测试中使用
jest.mock('vscode', () => mockVSCode, { virtual: true });
```

#### 测试辅助工具
```typescript
// test/helpers/test-helpers.ts
export class TestHelpers {
  public static createMockDocument(content: string, languageId: string = 'markdown'): vscode.TextDocument {
    return {
      fileName: 'test.md',
      languageId,
      getText: () => content,
      lineCount: content.split('\n').length,
      uri: vscode.Uri.file('test.md'),
      version: 1,
      isDirty: false,
      isClosed: false,
      save: jest.fn(),
      eol: vscode.EndOfLine.LF,
      isUntitled: false,
      lineAt: (line: number) => ({
        text: content.split('\n')[line] || '',
        lineNumber: line,
        range: new vscode.Range(line, 0, line, content.split('\n')[line]?.length || 0),
        rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: false
      }),
      offsetAt: jest.fn(),
      positionAt: jest.fn(),
      validateRange: jest.fn(),
      validatePosition: jest.fn(),
      getWordRangeAtPosition: jest.fn()
    } as any;
  }

  public static createMockWebviewPanel(): vscode.WebviewPanel {
    return {
      webview: {
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(),
        asWebviewUri: jest.fn(),
        cspSource: 'self'
      },
      viewType: 'markdownPreview',
      title: 'Test Preview',
      viewColumn: vscode.ViewColumn.Beside,
      active: true,
      visible: true,
      onDidDispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn()
    } as any;
  }
}
```

## 4.6 持续集成和部署

### 4.6.1 GitHub Actions 配置

#### 基本CI流程 (.github/workflows/ci.yml)
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x]
        vscode-version: [1.75.0, latest]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint
      run: npm run lint
    
    - name: Compile
      run: npm run compile
    
    - name: Run tests
      run: npm test
      env:
        VSCODE_VERSION: ${{ matrix.vscode-version }}

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build VSIX
      run: |
        npm install -g @vscode/vsce
        vsce package
    
    - name: Upload VSIX
      uses: actions/upload-artifact@v3
      with:
        name: extension-vsix
        path: '*.vsix'
```

### 4.6.2 发布流程

#### 版本发布脚本
```bash
#!/bin/bash
# scripts/release.sh

set -e

# 检查是否在main分支
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
  echo "错误: 必须在main分支上进行发布"
  exit 1
fi

# 检查工作目录是否干净
if [ -n "$(git status --porcelain)" ]; then
  echo "错误: 工作目录不干净，请先提交或储藏更改"
  exit 1
fi

# 获取版本号
echo "当前版本: $(node -p "require('./package.json').version")"
read -p "请输入新版本号 (或按回车键自动递增补丁版本): " new_version

if [ -z "$new_version" ]; then
  npm version patch
else
  npm version "$new_version"
fi

# 编译和测试
npm run compile
npm test
npm run lint

# 构建VSIX
vsce package

# 推送到Git
git push origin main --tags

echo "发布完成! 请在GitHub上创建Release并上传VSIX文件。"
```

## 4.7 贡献指南

### 4.7.1 代码贡献流程

1. **Fork项目** - 在GitHub上fork本项目
2. **创建分支** - 基于main创建功能分支
3. **开发功能** - 按照代码规范开发新功能
4. **编写测试** - 为新功能编写相应测试
5. **提交代码** - 使用规范的commit message
6. **发起PR** - 创建Pull Request并填写详细描述
7. **代码审查** - 响应审查意见并修改代码
8. **合并代码** - 审查通过后合并到主分支

### 4.7.2 Commit Message 规范
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type类型**:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建工具、依赖管理等

**示例**:
```bash
feat(preview): 添加目录折叠功能

- 实现目录项的展开/折叠功能
- 添加记忆折叠状态的配置选项
- 更新目录渲染逻辑

Closes #123
```

### 4.7.3 文档贡献
- API文档更新
- 使用指南完善
- 示例代码添加
- 错误处理说明
- 性能优化建议

### 4.7.4 问题反馈
- 使用GitHub Issues报告bug
- 提供详细的复现步骤
- 包含环境信息和错误日志
- 建议解决方案（如果有）

## 4.8 发布和维护

### 4.8.1 版本管理策略
- **主版本号**: API破坏性变更
- **次版本号**: 新功能添加（向后兼容）
- **修订版本号**: Bug修复和小改进

### 4.8.2 维护清单
- [ ] 定期更新依赖包
- [ ] 修复已知bug
- [ ] 性能优化
- [ ] 文档更新
- [ ] 用户反馈处理
- [ ] VSCode API兼容性检查

通过遵循这些开发指南，可以确保Markdown LiveSync插件的代码质量、性能和可维护性。 