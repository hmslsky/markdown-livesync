# Mermaid图表测试

这是一个测试Mermaid图表渲染功能的文档，用于验证布局居中和图表尺寸修复。

## 测试说明

1. **布局测试**：当目录显示时，此内容应该在剩余空间中居中显示
2. **图表尺寸测试**：Mermaid图表应该占据容器的100%宽度，高度自适应

## 流程图

下面是一个简单的流程图，测试图表宽度和高度：

```mermaid
graph TD
    A[开始] --> B{是否有数据?}
    B -->|是| C[处理数据]
    B -->|否| D[获取数据]
    C --> E[显示结果]
    D --> C
    E --> F[结束]
    F --> G[清理资源]
    G --> H[记录日志]
    H --> I[发送通知]
    I --> J[完成]
```

## 序列图

这是一个序列图示例：

```mermaid
sequenceDiagram
    participant A as 用户
    participant B as 前端
    participant C as 后端
    participant D as 数据库

    A->>B: 发送请求
    B->>C: 转发请求
    C->>D: 查询数据
    D-->>C: 返回数据
    C-->>B: 返回响应
    B-->>A: 显示结果
```

## 甘特图

项目进度甘特图（测试高度自适应）：

```mermaid
gantt
    title 项目开发进度 - 测试高度自适应
    dateFormat  YYYY-MM-DD
    section 需求分析阶段
    需求收集           :done,    req1, 2024-01-01,2024-01-03
    需求分析           :done,    req2, 2024-01-04,2024-01-06
    需求评审           :done,    req3, 2024-01-07,2024-01-08
    section 设计阶段
    架构设计           :done,    des1, 2024-01-09,2024-01-12
    UI设计            :done,    des2, 2024-01-13, 2024-01-18
    数据库设计         :done,    des3, 2024-01-19, 2024-01-22
    section 开发阶段
    前端开发          :active,  dev1, 2024-01-23, 2024-02-15
    后端开发          :active,  dev2, 2024-01-25, 2024-02-18
    API开发           :         dev3, 2024-02-01, 2024-02-10
    section 测试阶段
    单元测试          :         test1, after dev1, 5d
    集成测试          :         test2, after dev2, 3d
    性能测试          :         test3, after test2, 2d
    section 部署阶段
    环境准备          :         dep1, after test3, 2d
    部署上线          :         dep2, after dep1, 1d
    监控配置          :         dep3, after dep2, 1d
```

## 类图

简单的类图示例：

```mermaid
classDiagram
    class MarkdownProcessor {
        -md: MarkdownIt
        +constructor()
        +convertToHtml(markdown: string): string
        +generateToc(markdown: string): TocItem[]
        +configurePlugins(): void
    }

    class MermaidPlugin {
        +mermaidPlugin(md: MarkdownIt): void
    }

    MarkdownProcessor --> MermaidPlugin : uses
```

## 状态图

用户登录状态图：

```mermaid
stateDiagram-v2
    [*] --> 未登录
    未登录 --> 登录中 : 点击登录
    登录中 --> 已登录 : 登录成功
    登录中 --> 未登录 : 登录失败
    已登录 --> 未登录 : 退出登录
    已登录 --> [*]
```

## 饼图

数据分布饼图：

```mermaid
pie title 编程语言使用分布
    "JavaScript" : 35
    "Python" : 25
    "Java" : 20
    "TypeScript" : 15
    "其他" : 5
```

这些图表应该能够正确渲染并显示在预览中。
