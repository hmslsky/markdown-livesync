import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { MarkdownServer } from './server/markdownServer';

// 全局服务器实例
let server: MarkdownServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Markdown LiveSync 插件已激活（activate 函数已调用）');

  // 初始化服务器
  server = new MarkdownServer(context);
  console.log('Markdown LiveSync 服务器已初始化');

  // 注册命令
  registerCommands(context, server);
  console.log('Markdown LiveSync 命令已注册');

  // 注册事件处理
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.languageId === 'markdown') {
        server?.closePreviewForDocument(doc.uri.toString());
      }
    })
  );
}

export function deactivate() {
  // 关闭服务器
  if (server) {
    server.dispose();
    server = undefined;
  }
  console.log('Markdown LiveSync 插件已停用');
}
