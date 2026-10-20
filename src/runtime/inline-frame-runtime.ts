import type { Document, FrameTarget, Widget } from '../model/types';
import type { OfflineRuntime, RowContext } from './export-runtime';

export interface InlineFrameOptions {
  bootstrap: string;
  styles: string;
  base: string;
  fileUrl: (path: string, base: string) => string;
  depth?: number;
  token?: string;
  pages?: string[];
  budget?: number;
  playerUrl?: string;
  /** Fixed player markup, captured before mounting. Nested opaque file frames
   * reuse its identical CSP-hashed script instead of fetching another file. */
  playerHtml?: string;
  /** Child documents cannot invoke the editor's navigation or desktop bridge. */
  external?: (url: string, target: 'current' | 'new') => void;
  onError?: (error: unknown) => void;
}
export interface InlineFrameHost {
  update(element: HTMLIFrameElement, widget: Widget, context?: RowContext): void;
  prune(elements: ReadonlySet<HTMLIFrameElement>): void;
  dispose(): void;
}

/** Self-contained portable host. All child documents get a separate JS realm.
 * Only this generated document's WindowProxy and private token may request a
 * parent navigation; arbitrary remote frame messages have no authority. */
export function createInlineFrameHost(doc: Document, runtime: OfflineRuntime, options: InlineFrameOptions): InlineFrameHost {
  type Record = { signature: string; token?: string; init?: { doc: Document; options: Omit<InlineFrameOptions, 'fileUrl' | 'external' | 'onError'>; pageId: string } };
  const records = new Map<HTMLIFrameElement, Record>();
  const countFrames = (widgets: Widget[]): number => widgets.reduce((sum, widget) => Math.min(33, sum + (widget.inlineFrame ? 1 : 0) + (widget.layer ? countFrames(widget.layer.widgets) : 0) + (widget.states ?? []).reduce((n, state) => n + countFrames(state.widgets), 0) + (widget.repeater ? Math.min(33, widget.repeater.rows.length * countFrames(widget.repeater.template)) : 0)), 0);
  const branchCount = Math.max(1, ...doc.pages.map(page => countFrames(page.widgets)));
  let disposed = false;
  let currentPage = runtime.state().pageId;
  const reportError = (error: unknown) => {
    if (disposed) return;
    if (options.onError) { options.onError(error); return; }
    let output = document.querySelector<HTMLOutputElement>('[data-frame-navigation-error]');
    if (!output) { output = document.createElement('output'); output.dataset.frameNavigationError = ''; output.setAttribute('role', 'alert'); document.body.prepend(output); }
    output.textContent = error instanceof Error ? error.message : String(error);
  };
  const safeJSON = (value: unknown) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const validate = (target: FrameTarget): FrameTarget => {
    if (!target || typeof target !== 'object') throw new Error('Invalid inline frame target');
    if (target.kind === 'page' && typeof target.pageId === 'string' && doc.pages.some(page => page.id === target.pageId)) return { kind: 'page', pageId: target.pageId };
    if (target.kind === 'url' && typeof target.url === 'string') {
      const value = target.url;
      if (value.length > 4096 || value !== value.trim() || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value) || value.includes('[[')) throw new Error('Use a literal HTTP or HTTPS URL');
      const url = new URL(value);
      if (!url.hostname || url.username || url.password) throw new Error('Invalid inline frame URL');
      return { kind: 'url', url: value };
    }
    if (target.kind === 'file' && typeof target.path === 'string') return { kind: 'file', path: options.fileUrl(target.path, options.base) };
    throw new Error(target.kind === 'page' ? 'Inline frame page was not found' : 'Invalid inline frame target');
  };
  const external = (url: string, target: 'current' | 'new') => {
    const safe = validate({ kind: 'url', url }) as { kind: 'url'; url: string };
    if (options.token && target === 'current') window.location.assign(safe.url);
    else if (options.token) window.parent.postMessage({ channel: 'rea-inline-frame', token: options.token, operation: 'external', url: safe.url, target }, '*');
    else if (options.external) options.external(safe.url, target);
    else if (target === 'current') window.location.assign(safe.url);
    else window.open(safe.url, '_blank', 'noopener,noreferrer');
  };
  const navigateParent = (target: FrameTarget) => {
    const safe = validate(target);
    if (options.token) window.parent.postMessage({ channel: 'rea-inline-frame', token: options.token, operation: 'parent', target: safe }, '*');
    else if (safe.kind === 'page') void runtime.navigate(safe.pageId).catch(reportError);
    else if (safe.kind === 'url') external(safe.url, 'current');
    else if (!options.external) window.location.assign(safe.path);
    else throw new Error('A local file cannot replace the author preview. Open the exported HTML directly.');
  };
  runtime.bindParentFrame(navigateParent);
  if (options.token) runtime.bindNavigation(external);
  const receive = (event: MessageEvent) => {
    if (disposed || !event.data || event.data.channel !== 'rea-inline-frame') return;
    const record = [...records].find(([element, item]) => element.contentWindow === event.source && item.token && event.data.token === item.token);
    if (!record) return;
    try {
      if (event.data.operation === 'ready' && record[1].init) {
        const payload = record[1].init; delete record[1].init;
        record[0].contentWindow?.postMessage({ channel: 'rea-inline-frame-init', token: record[1].token, ...payload }, '*');
      } else if (event.data.operation === 'parent') {
        const target = validate(event.data.target);
        // A child requests its immediate enclosing document, never the top app.
        if (target.kind === 'page') void runtime.navigate(target.pageId).catch(reportError);
        else if (target.kind === 'url') {
          if (options.token) { records.clear(); window.location.assign(target.url); }
          else external(target.url, 'current');
        } else if (options.token || !options.external) window.location.assign(target.path);
        else throw new Error('A local file cannot replace the author preview. Open the exported HTML directly.');
      } else if (event.data.operation === 'external' && ['current', 'new'].includes(event.data.target)) external(event.data.url, event.data.target);
    } catch (error) {
      record[0].setAttribute('data-frame-error', error instanceof Error ? error.message : String(error));
      reportError(error);
    }
  };
  window.addEventListener('message', receive);
  const errorDocument = (message: string) => `<!doctype html><meta charset="utf-8"><body><p role="alert">${message.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))}</p></body>`;
  return {
    update: (element, widget, context = []) => {
      if (disposed || !widget.inlineFrame) return;
      if (currentPage !== runtime.state().pageId) { records.clear(); currentPage = runtime.state().pageId; }
      const state = runtime.frame(widget.id, context); if (!state) return;
      element.title = widget.name; element.dataset.inlineFrame = widget.id;
      element.setAttribute('scrolling', widget.inlineFrame.scrolling);
      element.setAttribute('frameborder', widget.inlineFrame.hideBorders ? '0' : '1');
      element.setAttribute('sandbox', 'allow-scripts allow-forms');
      element.setAttribute('referrerpolicy', 'no-referrer');
      Object.assign(element.style, { width: '100%', height: '100%', display: 'block', boxSizing: 'border-box', border: widget.inlineFrame.hideBorders ? '0' : '2px inset' });
      const signature = JSON.stringify([state.revision, state.target]);
      if (records.get(element)?.signature === signature) return;
      const record: Record = { signature }; records.set(element, record);
      element.removeAttribute('data-frame-error');
      try {
        if (!state.target) { element.removeAttribute('srcdoc'); element.src = 'about:blank'; return; }
        const target = validate(state.target);
        if (target.kind !== 'page') { element.removeAttribute('srcdoc'); element.src = target.kind === 'url' ? target.url : target.path; return; }
        // Lazy construction permits real nested documents without recursive HTML
        // expansion. The finite bound is a product safety limit, not Axure parity.
        const budget = options.budget ?? 32, pages = [...(options.pages ?? []).slice(0, -1), runtime.state().pageId];
        if ((options.depth ?? 0) >= 6 || records.size > Math.min(32, budget) || pages.includes(target.pageId)) throw new Error('Inline frame nesting limit reached (recursive page / 6 levels / 32-frame budget)');
        const bytes = new Uint32Array(4); crypto.getRandomValues(bytes); record.token = [...bytes].map(value => value.toString(16)).join('-');
        const child = { bootstrap: options.bootstrap, styles: options.styles, base: options.base, depth: (options.depth ?? 0) + 1, token: record.token, pages: [...pages, target.pageId], budget: Math.max(0, Math.floor(budget / Math.max(branchCount, records.size)) - 1), playerUrl: options.playerUrl };
        if (options.playerHtml || options.playerUrl) {
          record.init = { doc, options: child, pageId: target.pageId };
          if (options.playerHtml) {
            element.removeAttribute('src');
            element.srcdoc = options.playerHtml.replace('<head>', `<head><meta name="rea-frame-token" content="${record.token}">`);
            return;
          }
          const player = new URL(options.playerUrl!); player.searchParams.set('frame', record.token); player.hash = record.token;
          element.removeAttribute('srcdoc'); element.src = player.href; return;
        }
        const script = `(${options.bootstrap})(${safeJSON(doc)},${safeJSON(child)},${safeJSON(target.pageId)})`;
        element.removeAttribute('src');
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src about: https: http: file:; base-uri 'none'; form-action 'none'"><style>${options.styles.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="prototype"></div>${'<' + 'script>'}${script.replace(/<\/script/gi, '<\\/script')}${'<' + '/script>'}</body></html>`;
        element.srcdoc = html;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error); element.dataset.frameError = message;
        element.removeAttribute('src'); element.srcdoc = errorDocument(message);
      }
    },
    prune: elements => { for (const element of records.keys()) if (!elements.has(element)) records.delete(element); },
    dispose: () => { disposed = true; records.clear(); window.removeEventListener('message', receive); runtime.bindParentFrame(undefined); },
  };
}
