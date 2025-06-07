import * as vscode from 'vscode';
import * as express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as crypto from 'crypto';
import * as WebSocket from 'ws';
import { MarkdownProcessor } from '../markdown/markdownProcessor';
import { openBrowser } from '../browser/browserIntegration';
import { Logger } from '../utils/logger';
import { debounce } from '../utils/debounce';

/**
 * Markdown服务器类，负责提供HTTP服务和管理预览
 */
export class MarkdownServer {
  private app: express.Express;
  private server: http.Server | null = null;
  private wsServer: WebSocket.WebSocketServer | null = null;
  private port: number = 0;
  private token: string;
  private markdownProcessor: MarkdownProcessor;
  private activeDocuments: Map<string, vscode.TextDocument> = new Map();
  private activeConnections: Map<string, Set<WebSocket.WebSocket>> = new Map();
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  // 使用防抖函数处理光标位置变化
  private debouncedCursorPositionChanged: (document: vscode.TextDocument, position: vscode.Position) => void;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.token = crypto.randomBytes(32).toString('hex');
    this.markdownProcessor = new MarkdownProcessor();
    this.app = express();

    // 初始化防抖函数，100毫秒延迟（减少延迟以提高响应速度）
    this.debouncedCursorPositionChanged = debounce(this.onCursorPositionChanged.bind(this), 100);

    this.setupServer();
    this.startServer();
    this.registerDocumentListeners();

    Logger.initialize();
    Logger.info('MarkdownServer initialized');
  }

  /**
   * 注册文档变更监听器
   */
  private registerDocumentListeners(): void {
    // 监听文档保存事件
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'markdown') {
          this.onDocumentSaved(document);
        }
      })
    );

    // 监听编辑器选择变化事件
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        const document = event.textEditor.document;
        if (document.languageId === 'markdown') {
          Logger.info(`编辑器选择变化: ${document.uri.toString()}, 行: ${event.selections[0].active.line + 1}`);
          // 使用防抖函数处理光标位置变化
          this.debouncedCursorPositionChanged(document, event.selections[0].active);
        }
      })
    );

    // 监听活动编辑器变化事件
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'markdown') {
          // 活动编辑器变化时立即同步位置，不使用防抖
          this.onCursorPositionChanged(editor.document, editor.selection.active);
        }
      })
    );
  }

  /**
   * 处理光标位置变化事件
   */
  private onCursorPositionChanged(document: vscode.TextDocument, position: vscode.Position): void {
    const documentUri = document.uri.toString();

    // 添加详细日志
    Logger.info(`光标位置变化触发: ${documentUri}, 行: ${position.line + 1}`);

    // 检查是否有活跃的连接
    if (this.activeConnections.has(documentUri)) {
      const connections = this.activeConnections.get(documentUri)!;

      Logger.info(`找到活跃连接: ${connections.size}个连接`);

      if (connections.size > 0) {
        // 获取当前行号 (1-based)
        const lineNumber = position.line + 1;

        // 向所有连接的客户端发送光标位置
        const positionMessage = JSON.stringify({
          type: 'cursorMove',
          lineNumber
        });

        Logger.info(`发送光标位置消息: 行 ${lineNumber}`);

        let sentCount = 0;
        connections.forEach(client => {
          try {
            if (client.readyState === WebSocket.WebSocket.OPEN) {
              client.send(positionMessage);
              sentCount++;
            } else {
              Logger.info(`客户端连接状态不是OPEN: ${client.readyState}`);
            }
          } catch (error) {
            Logger.error(`发送消息时出错: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        Logger.info(`成功发送到 ${sentCount}/${connections.size} 个客户端`);
      } else {
        Logger.info(`没有活跃的WebSocket连接`);
      }
    } else {
      Logger.info(`没有找到文档的活跃连接: ${documentUri}`);
    }
  }

  /**
   * 处理文档保存事件
   */
  private onDocumentSaved(document: vscode.TextDocument): void {
    const documentUri = document.uri.toString();

    // 检查是否有活跃的连接
    if (this.activeConnections.has(documentUri)) {
      const connections = this.activeConnections.get(documentUri)!;

      if (connections.size > 0) {
        Logger.info(`Document saved: ${documentUri}, notifying ${connections.size} connections`);

        // 获取更新后的HTML和目录
        const html = this.markdownProcessor.convertToHtml(document.getText());
        const toc = this.markdownProcessor.generateToc(document.getText());

        // 向所有连接的客户端发送更新
        const updateMessage = JSON.stringify({
          type: 'update',
          html,
          toc
        });

        connections.forEach(client => {
          if (client.readyState === WebSocket.WebSocket.OPEN) {
            client.send(updateMessage);
          }
        });
      }
    }
  }

  /**
   * 配置Express服务器
   */
  private setupServer() {
    // 静态文件服务
    const webviewPath = path.join(this.context.extensionPath, 'webview');
    Logger.info(`静态文件路径: ${webviewPath}`);

    // 添加中间件记录静态文件请求
    this.app.use('/static', (req, _res, next) => {
      Logger.info(`请求静态文件: ${req.path}`);
      next();
    }, express.static(webviewPath));

    // API路由
    this.app.get('/api/markdown', (req, res) => {
      const { documentUri, token } = req.query;

      // 验证令牌
      if (token !== this.token) {
        return res.status(403).send('无效的访问令牌');
      }

      if (!documentUri || typeof documentUri !== 'string') {
        return res.status(400).send('缺少文档URI参数');
      }

      const document = this.activeDocuments.get(documentUri);
      if (!document) {
        return res.status(404).send('找不到请求的文档');
      }

      // 处理Markdown内容
      const html = this.markdownProcessor.convertToHtml(document.getText());
      const toc = this.markdownProcessor.generateToc(document.getText());

      return res.json({
        html,
        toc,
        title: path.basename(document.fileName)
      });
    });

    // 主页
    this.app.get('/', (req, res) => {
      const { documentUri, line, token, showToc } = req.query;

      // 验证令牌
      if (token !== this.token) {
        return res.status(403).send('无效的访问令牌');
      }

      if (!documentUri || typeof documentUri !== 'string') {
        return res.status(400).send('缺少文档URI参数');
      }

      // 获取配置
      const config = vscode.workspace.getConfiguration('markdown-livesync');
      const defaultShowToc = config.get<boolean>('showToc', true);
      const highlightOnScroll = config.get<boolean>('highlightOnScroll', false);

      // 使用查询参数或默认配置
      const shouldShowToc = showToc !== undefined ? showToc === 'true' : defaultShowToc;

      // 渲染预览页面
      return res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Markdown预览</title>
          <link rel="stylesheet" href="/static/markdown.css">
          <script src="https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"></script>
          <script>
            // 存储文档URI和令牌
            window.documentUri = "${documentUri}";
            window.accessToken = "${this.token}";
            window.initialLine = ${line || 1};
            window.showToc = ${shouldShowToc};
            window.highlightOnScroll = ${highlightOnScroll};
            window.wsUrl = "ws://localhost:${this.port}/ws?documentUri=${encodeURIComponent(documentUri)}&token=${encodeURIComponent(this.token)}";
          </script>
        </head>
        <body>
          <div class="container ${shouldShowToc ? 'with-toc' : ''}">
            <div id="toc-container" class="${shouldShowToc ? '' : 'hidden'}">
              <div class="toc-header">
                <h3>TOC</h3>
                <button id="toggle-toc" title="切换目录显示">×</button>
              </div>
              <div id="toc-content"></div>
            </div>
            <div id="content-container">
              <div class="toolbar">
                <button id="show-toc" class="${shouldShowToc ? 'hidden' : ''}" title="显示目录">☰</button>
              </div>
              <div id="markdown-content"></div>
            </div>
          </div>
          <script src="/static/preview.js"></script>
          <!-- 调试工具脚本会在需要时动态加载 -->
        </body>
        </html>
      `);
    });
  }

  /**
   * 启动HTTP服务器和WebSocket服务器
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(0, 'localhost', () => {
        const address = this.server?.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
          Logger.info(`Markdown服务器运行在端口: ${this.port}`);

          // 创建WebSocket服务器
          this.setupWebSocketServer();

          resolve();
        } else {
          reject(new Error('无法获取服务器地址'));
        }
      });

      this.server.on('error', (err) => {
        Logger.error('服务器错误:', err);
        reject(err);
      });
    });
  }

  /**
   * 设置WebSocket服务器
   */
  private setupWebSocketServer(): void {
    if (!this.server) {
      Logger.error('无法设置WebSocket服务器: HTTP服务器未初始化');
      return;
    }

    // 创建WebSocket服务器
    this.wsServer = new WebSocket.WebSocketServer({
      server: this.server,
      path: '/ws'
    });

    Logger.info('WebSocket服务器已创建');

    this.wsServer.on('connection', (ws: WebSocket.WebSocket, req: http.IncomingMessage) => {
      Logger.info(`收到WebSocket连接请求: ${req.url}`);

      // 解析URL查询参数
      let documentUri: string | null = null;
      let token: string | null = null;

      try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        documentUri = url.searchParams.get('documentUri');
        token = url.searchParams.get('token');

        Logger.info(`解析WebSocket URL: documentUri=${documentUri}, token存在=${!!token}`);
      } catch (error) {
        Logger.error(`解析WebSocket URL失败: ${error instanceof Error ? error.message : String(error)}`);

        // 尝试手动解析查询参数
        const queryString = req.url?.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        documentUri = params.get('documentUri');
        token = params.get('token');

        Logger.info(`手动解析WebSocket URL: documentUri=${documentUri}, token存在=${!!token}`);
      }

      // 验证令牌和文档URI
      if (!documentUri || token !== this.token) {
        Logger.error(`WebSocket连接验证失败: 无效的令牌或文档URI`);
        ws.close(1008, '无效的访问令牌或文档URI');
        return;
      }

      // 检查文档是否存在
      if (!this.activeDocuments.has(documentUri)) {
        Logger.error(`WebSocket连接验证失败: 找不到文档 ${documentUri}`);
        ws.close(1008, '找不到请求的文档');
        return;
      }

      Logger.info(`WebSocket连接已建立: ${documentUri}`);

      // 将连接添加到活跃连接列表
      if (!this.activeConnections.has(documentUri)) {
        this.activeConnections.set(documentUri, new Set());
        Logger.info(`为文档创建新的连接集合: ${documentUri}`);
      }

      const connections = this.activeConnections.get(documentUri)!;
      connections.add(ws);
      Logger.info(`当前连接数: ${connections.size}`);

      // 发送初始光标位置
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.uri.toString() === documentUri) {
        const position = editor.selection.active;
        const lineNumber = position.line + 1;

        Logger.info(`发送初始光标位置: 行 ${lineNumber}`);

        const positionMessage = JSON.stringify({
          type: 'cursorMove',
          lineNumber
        });

        ws.send(positionMessage);
      }

      // 监听连接关闭
      ws.on('close', (code: number, reason: Buffer) => {
        Logger.info(`WebSocket连接已关闭: ${documentUri}, 代码: ${code}, 原因: ${reason.toString()}`);
        connections.delete(ws);

        // 如果没有更多连接，清理资源
        if (connections.size === 0 && documentUri) {
          this.activeConnections.delete(documentUri);
          Logger.info(`已删除文档的连接集合: ${documentUri}`);
        } else {
          Logger.info(`剩余连接数: ${connections.size}`);
        }
      });

      // 监听错误
      ws.on('error', (error: Error) => {
        Logger.error(`WebSocket错误: ${error.message}`);
      });

      // 监听消息
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          // 将数据转换为字符串
          const dataStr = data.toString();
          const message = JSON.parse(dataStr);
          Logger.info(`收到WebSocket消息: ${JSON.stringify(message)}`);

          // 处理来自客户端的消息
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          Logger.error(`处理WebSocket消息时出错: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    });
  }

  /**
   * 打开Markdown预览
   */
  public async openPreview(document: vscode.TextDocument, line: number = 1): Promise<void> {
    if (!this.server) {
      throw new Error('服务器未启动');
    }

    const documentUri = document.uri.toString();
    this.activeDocuments.set(documentUri, document);

    Logger.info(`打开预览: ${documentUri}, 初始行: ${line}`);

    // 构建预览URL
    const previewUrl = `http://localhost:${this.port}/?documentUri=${encodeURIComponent(documentUri)}&line=${line}&token=${this.token}`;

    // 打开浏览器
    await openBrowser(previewUrl);

    // 确保有一个空的连接集合准备好接收WebSocket连接
    if (!this.activeConnections.has(documentUri)) {
      this.activeConnections.set(documentUri, new Set());
      Logger.info(`为文档创建新的连接集合: ${documentUri}`);
    }
  }

  /**
   * 关闭指定文档的预览
   */
  public closePreviewForDocument(documentUri: string): void {
    this.activeDocuments.delete(documentUri);
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    // 关闭WebSocket服务器
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // 关闭HTTP服务器
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // 清理文档和连接
    this.activeDocuments.clear();
    this.activeConnections.clear();

    // 清理事件监听器
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    Logger.info('MarkdownServer disposed');
  }
}
