// 简单的测试脚本来验证Mermaid插件功能
const MarkdownIt = require('markdown-it');
const { mermaidPlugin } = require('./out/markdown/mermaidPlugin');

// 创建MarkdownIt实例
const md = new MarkdownIt();

// 添加Mermaid插件
mermaidPlugin(md);

// 测试Markdown内容
const testMarkdown = `
# 测试标题

这是一个测试段落。

\`\`\`mermaid
graph TD
    A[开始] --> B{是否有数据?}
    B -->|是| C[处理数据]
    B -->|否| D[获取数据]
    C --> E[显示结果]
    D --> C
    E --> F[结束]
\`\`\`

这是另一个段落。

\`\`\`javascript
console.log('这是普通代码块');
\`\`\`
`;

// 渲染HTML
const html = md.render(testMarkdown);

console.log('渲染结果:');
console.log(html);

// 检查是否包含Mermaid相关的HTML
if (html.includes('class="mermaid-container"')) {
    console.log('\n✅ Mermaid插件工作正常 - 找到了mermaid-container类');
} else {
    console.log('\n❌ Mermaid插件可能有问题 - 未找到mermaid-container类');
}

if (html.includes('data-mermaid=')) {
    console.log('✅ Mermaid代码已正确编码到data-mermaid属性中');
} else {
    console.log('❌ 未找到data-mermaid属性');
}

if (html.includes('graph TD')) {
    console.log('✅ Mermaid代码内容已包含在HTML中');
} else {
    console.log('❌ 未找到Mermaid代码内容');
}
