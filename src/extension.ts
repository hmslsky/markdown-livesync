import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { MarkdownServer } from './server/markdownServer';

// 全局服务器实例
let server: MarkdownServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Markdown LiveSync 插件已激活');

  // 初始化服务器
  server = new MarkdownServer(context);

  // 注册命令
  registerCommands(context, server);

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
