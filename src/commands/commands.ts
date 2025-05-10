import * as vscode from 'vscode';
import { MarkdownServer } from '../server/markdownServer';

/**
 * 注册所有命令
 */
export function registerCommands(context: vscode.ExtensionContext, server: MarkdownServer) {
  // 注册在浏览器中打开Markdown的命令
  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-livesync.openMarkdownInBrowser', () => {
      openMarkdownInBrowser(server);
    })
  );
}

/**
 * 在浏览器中打开当前Markdown文件
 */
async function openMarkdownInBrowser(server: MarkdownServer) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('没有打开的编辑器');
    return;
  }

  const document = editor.document;

  if (document.languageId !== 'markdown') {
    vscode.window.showErrorMessage('当前文件不是Markdown文件');
    return;
  }

  try {
    // 获取当前光标位置
    const position = editor.selection.active;
    const lineNumber = position.line + 1; // 转为1-based索引

    // 打开浏览器预览
    await server.openPreview(document, lineNumber);

    vscode.window.setStatusBarMessage('在浏览器中打开Markdown预览', 3000);
  } catch (error) {
    vscode.window.showErrorMessage(`打开预览失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
