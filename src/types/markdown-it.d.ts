declare module 'markdown-it' {
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
  }

  namespace MarkdownIt {}
  export = MarkdownIt;
}
