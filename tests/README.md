# 测试文件说明

本目录包含所有测试相关的文件，按功能模块分类组织。

## 目录结构

```
tests/
├── mermaid/          # Mermaid图表相关测试
│   ├── test-mermaid.md              # 基本功能测试
│   ├── test-mermaid-fix.md          # 修复验证测试
│   ├── test-mermaid-fixes.md        # 综合功能测试
│   └── test-mermaid-enhanced.md     # 增强功能测试
│
└── layout/           # 布局相关测试
    └── test-layout-fixes.md         # 布局修复测试
```

## 测试文件说明

### Mermaid测试

1. **test-mermaid.md**
   - 基本功能测试
   - 包含各种图表类型的示例
   - 验证基本渲染功能

2. **test-mermaid-fix.md**
   - 修复验证测试
   - 针对特定问题的测试用例
   - 验证修复效果

3. **test-mermaid-fixes.md**
   - 综合功能测试
   - 包含多个修复点的测试
   - 验证整体功能

4. **test-mermaid-enhanced.md**
   - 增强功能测试
   - 新功能验证
   - 性能测试用例

### 布局测试

1. **test-layout-fixes.md**
   - 布局修复测试
   - 验证布局居中问题
   - 测试响应式布局

## 使用说明

1. 运行测试前，请确保：
   - 已安装所有依赖
   - 开发环境配置正确
   - 相关服务已启动

2. 测试文件命名规范：
   - 基本测试：`test-{功能}.md`
   - 修复测试：`test-{功能}-fix.md`
   - 综合测试：`test-{功能}-fixes.md`
   - 增强测试：`test-{功能}-enhanced.md`

3. 测试文件内容规范：
   - 清晰的测试目的说明
   - 详细的测试步骤
   - 预期结果描述
   - 实际结果记录

## 注意事项

1. 测试文件不会被包含在发布包中
2. 测试文件使用`.md`格式，便于阅读和维护
3. 每个测试文件都应该有明确的测试目的和验证标准
4. 测试用例应该覆盖正常和异常情况 