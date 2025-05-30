# Mermaid图表增强功能测试

这个文档用于测试Mermaid图表的增强功能，包括节点尺寸自适应、视窗适配和交互功能。

## 测试说明

### 新增功能
1. **节点尺寸自适应**：根据节点数量自动调整节点大小
2. **视窗适配优化**：确保图表在一个屏幕内完整显示
3. **交互功能增强**：
   - 🔍+ 放大按钮
   - 🔍- 缩小按钮
   - ↻ 重置按钮
   - ⛶ 全屏按钮
   - 鼠标滚轮缩放
   - 拖拽平移（放大后）

### 复杂度分类
- **简单图表**：≤3个节点，≤3个连接
- **中等图表**：≤8个节点，≤10个连接
- **复杂图表**：>8个节点或>10个连接

## 简单流程图测试

这是一个简单的流程图，应该显示较小的节点：

```mermaid
graph LR
    A[开始] --> B[处理]
    B --> C[结束]
```

## 中等复杂度流程图测试

这是一个中等复杂度的流程图：

```mermaid
graph TD
    A[用户登录] --> B{验证身份}
    B -->|成功| C[进入系统]
    B -->|失败| D[显示错误]
    C --> E[选择功能]
    E --> F[数据处理]
    E --> G[报表生成]
    F --> H[保存结果]
    G --> H
    H --> I[完成]
```

## 复杂流程图测试

这是一个复杂的流程图，节点较多：

```mermaid
graph TD
    A[开始] --> B[初始化系统]
    B --> C{检查配置}
    C -->|配置正确| D[加载模块]
    C -->|配置错误| E[显示错误]
    D --> F[模块A]
    D --> G[模块B]
    D --> H[模块C]
    F --> I[处理数据A]
    G --> J[处理数据B]
    H --> K[处理数据C]
    I --> L{验证结果A}
    J --> M{验证结果B}
    K --> N{验证结果C}
    L -->|通过| O[存储A]
    L -->|失败| P[重试A]
    M -->|通过| Q[存储B]
    M -->|失败| R[重试B]
    N -->|通过| S[存储C]
    N -->|失败| T[重试C]
    P --> I
    R --> J
    T --> K
    O --> U[汇总结果]
    Q --> U
    S --> U
    U --> V[生成报告]
    V --> W[发送通知]
    W --> X[清理资源]
    X --> Y[结束]
    E --> Z[退出系统]
```

## 简单序列图测试

```mermaid
sequenceDiagram
    participant A as 用户
    participant B as 系统
    A->>B: 请求
    B-->>A: 响应
```

## 复杂序列图测试

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant G as 网关
    participant A as 认证服务
    participant B as 业务服务
    participant D as 数据库
    participant C as 缓存
    participant M as 消息队列

    U->>F: 发起请求
    F->>G: 转发请求
    G->>A: 验证令牌
    A->>D: 查询用户信息
    D-->>A: 返回用户信息
    A-->>G: 验证成功
    G->>B: 调用业务服务
    B->>C: 检查缓存
    C-->>B: 缓存未命中
    B->>D: 查询数据库
    D-->>B: 返回数据
    B->>C: 更新缓存
    B->>M: 发送异步消息
    B-->>G: 返回结果
    G-->>F: 返回响应
    F-->>U: 显示结果
    M->>B: 处理异步任务
```

## 简单甘特图测试

```mermaid
gantt
    title 简单项目
    dateFormat YYYY-MM-DD
    section 开发
    任务1 :2024-01-01, 5d
    任务2 :2024-01-06, 3d
```

## 复杂甘特图测试

```mermaid
gantt
    title 复杂软件开发项目
    dateFormat YYYY-MM-DD
    
    section 需求分析
    需求收集    :req1, 2024-01-01, 2024-01-05
    需求分析    :req2, after req1, 5d
    需求评审    :req3, after req2, 2d
    需求确认    :req4, after req3, 1d
    
    section 系统设计
    架构设计    :des1, after req4, 7d
    详细设计    :des2, after des1, 10d
    接口设计    :des3, after des1, 8d
    数据库设计  :des4, after des1, 6d
    设计评审    :des5, after des2, 2d
    
    section 开发阶段
    环境搭建    :dev1, after des5, 3d
    前端开发    :dev2, after dev1, 20d
    后端开发    :dev3, after dev1, 25d
    数据库开发  :dev4, after dev1, 15d
    接口开发    :dev5, after dev3, 10d
    集成开发    :dev6, after dev2, 8d
    
    section 测试阶段
    单元测试    :test1, after dev3, 8d
    集成测试    :test2, after dev6, 10d
    系统测试    :test3, after test2, 12d
    性能测试    :test4, after test3, 5d
    安全测试    :test5, after test3, 5d
    用户测试    :test6, after test4, 8d
    
    section 部署上线
    预生产部署  :dep1, after test6, 3d
    生产部署    :dep2, after dep1, 2d
    监控配置    :dep3, after dep2, 2d
    文档整理    :dep4, after dep2, 3d
```

## 测试验证点

### 节点尺寸自适应
- [ ] 简单图表的节点显示较小
- [ ] 中等图表的节点显示适中
- [ ] 复杂图表的节点显示较大

### 视窗适配
- [ ] 所有图表都能在一个屏幕内完整显示
- [ ] 不同设备上都有良好的显示效果
- [ ] 图表不会出现不必要的滚动条

### 交互功能
- [ ] 鼠标悬停时显示控制按钮
- [ ] 放大/缩小按钮正常工作
- [ ] 重置按钮能恢复默认大小
- [ ] 全屏按钮能切换全屏模式
- [ ] 鼠标滚轮缩放功能正常
- [ ] 放大后可以拖拽平移
- [ ] ESC键能退出全屏模式

### 性能测试
- [ ] 图表渲染速度正常
- [ ] 交互操作响应流畅
- [ ] 不影响页面其他功能

## 使用说明

1. **缩放操作**：
   - 使用鼠标滚轮进行缩放
   - 点击🔍+/🔍-按钮进行缩放
   - 缩放范围：50%-300%

2. **平移操作**：
   - 当图表放大超过100%时，可以拖拽平移
   - 鼠标按下并拖动即可平移图表

3. **全屏模式**：
   - 点击⛶按钮进入全屏模式
   - 按ESC键或再次点击按钮退出全屏

4. **重置功能**：
   - 点击↻按钮恢复图表到默认状态
   - 重置缩放比例和位置
