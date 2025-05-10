import * as vscode from 'vscode';
import * as open from 'open';

/**
 * 在浏览器中打开URL
 */
export async function openBrowser(url: string): Promise<void> {
  try {
    // 获取用户配置的浏览器
    const config = vscode.workspace.getConfiguration('markdown-livesync');
    const browserPath = config.get<string>('browser', '');

    if (browserPath) {
      // 使用指定的浏览器
      await open(url, { app: { name: browserPath } });
    } else {
      // 使用默认浏览器
      await open(url);
    }
  } catch (error) {
    console.error('打开浏览器失败:', error);
    throw new Error(`无法打开浏览器: ${error instanceof Error ? error.message : String(error)}`);
  }
}
