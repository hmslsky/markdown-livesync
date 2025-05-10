declare module 'markdown-it' {
  interface Token {
    type: string;
    tag: string;
    attrs: [string, string][];
    map: [number, number] | null;
    nesting: number;
    level: number;
    children: Token[] | null;
    content: string;
    markup: string;
    info: string;
    meta: any;
    block: boolean;
    hidden: boolean;
  }

  interface Renderer {
    rules: {
      [key: string]: (tokens: Token[], idx: number, options: any, env: any, self: Renderer) => string;
    };
    renderToken(tokens: Token[], idx: number, options: any): string;
  }

  interface CoreRuler {
    push(ruleName: string, fn: (state: any) => boolean): void;
  }

  interface Core {
    ruler: CoreRuler;
  }

  interface MarkdownItOptions {
    html?: boolean;
    xhtmlOut?: boolean;
    breaks?: boolean;
    langPrefix?: string;
    linkify?: boolean;
    typographer?: boolean;
    quotes?: string;
    highlight?: (str: string, lang: string) => string;
  }

  interface MarkdownItUtils {
    escapeHtml(html: string): string;
  }

  class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    render(markdown: string): string;
    utils: MarkdownItUtils;
    renderer: Renderer;
    core: Core;
  }

  namespace MarkdownIt {}
  export = MarkdownIt;
}
