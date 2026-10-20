import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInlineFrameHost, type InlineFrameHost } from '../src/runtime/inline-frame-runtime';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { frameFileUrl } from '../src/model/inline-frame';
import { inlineFrameFixture } from './fixtures/inline-frames';
import { createWidget, uid } from '../src/model/document';
import type { FrameTarget } from '../src/model/types';
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });
function setup(extra = {}) {
  const listeners = new Map<string, (event: MessageEvent) => void>(), external = vi.fn();
  vi.stubGlobal('window', { addEventListener: (name: string, fn: (event: MessageEvent) => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name), location: { assign: vi.fn() }, open: vi.fn() });
  const doc = inlineFrameFixture(), runtime = createOfflineRuntime(doc), widget = doc.pages[0].widgets.find(w => w.id === 'frame-left')!;
  const host = createInlineFrameHost(doc, runtime, { bootstrap: 'function(){}', styles: '', base: 'file:///prototype/index.html', fileUrl: frameFileUrl, external, ...extra });
  cleanups.push(() => { host.dispose(); runtime.dispose(); });
  const attributes = new Map<string, string>(), messages: unknown[] = [], peer = { postMessage: (...args: unknown[]) => messages.push(args) };
  const frame = { title: '', src: '', srcdoc: '', dataset: {} as Record<string, string>, style: {}, contentWindow: peer, setAttribute: (key: string, value: string) => attributes.set(key, value), removeAttribute: (key: string) => attributes.delete(key) } as unknown as HTMLIFrameElement;
  return { doc, runtime, widget, host, frame, attributes, messages, peer, external, emit: (data: unknown, source: unknown = peer) => listeners.get('message')?.({ data, source } as MessageEvent) };
}
async function open(runtime: OfflineRuntime, target: FrameTarget) { await runtime.execute({ id: uid(), name: 'Open', enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: [{ id: uid(), type: 'openLinkInFrame', frameScope: 'widget', targetId: 'frame-left', frameTarget: target }] }); }
describe('isolated iframe host', () => {
  it('retains a browsing document for an unchanged revision', () => { const f = setup(); f.host.update(f.frame, f.widget); const html = f.frame.srcdoc; f.host.update(f.frame, f.widget); expect(f.frame.srcdoc).toBe(html); expect(f.attributes.get('sandbox')).toBe('allow-scripts allow-forms'); expect(f.attributes.get('frameborder')).toBe('0'); });
  it('keeps hostile project strings in escaped script JSON', () => { const f = setup(); f.doc.name = '</script><script>globalThis.injected=true</script>'; f.host.update(f.frame, f.widget); expect((f.frame.srcdoc.match(/<script>/g) ?? []).length).toBe(1); expect(f.frame.srcdoc).not.toContain(f.doc.name); expect(f.frame.srcdoc).toContain('\\u003c/script\\u003e'); });
  it('shows a missing-page error rather than loading an arbitrary page', async () => { const f = setup(); await open(f.runtime, { kind: 'page', pageId: 'missing' }); f.host.update(f.frame, f.widget); expect(f.frame.dataset.frameError).toMatch(/not found/); expect(f.frame.srcdoc).toContain('role="alert"'); });
  it('blocks direct recursive pages with an explicit limit message', async () => { const f = setup(); await open(f.runtime, { kind: 'page', pageId: f.doc.pages[0].id }); f.host.update(f.frame, f.widget); expect(f.frame.dataset.frameError).toMatch(/recursive page/); });
  it('validates URL schemes before any navigation sink', async () => { const f = setup(); await open(f.runtime, { kind: 'url', url: 'javascript:alert(1)' }); f.host.update(f.frame, f.widget); expect(f.frame.dataset.frameError).toMatch(/literal HTTP/); expect(f.frame.src).toBe(''); });
  it('resolves literal local filenames only against the exported file base', async () => { const f = setup(); await open(f.runtime, { kind: 'file', path: 'help file.html' }); f.host.update(f.frame, f.widget); expect(f.frame.src).toBe('file:///prototype/help%20file.html'); });
  it('keeps HTTP-hosted local-file failures visible', async () => { const f = setup({ base: 'http://127.0.0.1:5173/' }); await open(f.runtime, { kind: 'file', path: 'help.html' }); f.host.update(f.frame, f.widget); expect(f.frame.dataset.frameError).toMatch(/file-based/); });
  it('only sends a project after exact WindowProxy and token handshake, once', () => {
    const f = setup({ playerUrl: 'file:///app/frame-player.html' }); f.host.update(f.frame, f.widget); const token = new URL(f.frame.src).hash.slice(1), ready = { channel: 'rea-inline-frame', operation: 'ready', token };
    f.emit(ready, {}); f.emit({ ...ready, token: 'forged' }); expect(f.messages).toHaveLength(0);
    f.emit(ready); expect(f.messages).toHaveLength(1); expect((f.messages[0] as [unknown])[0]).toMatchObject({ channel: 'rea-inline-frame-init', token, pageId: 'frame-catalog' });
    f.emit(ready); expect(f.messages).toHaveLength(1);
  });
  it('same destination creates a fresh document URL and invalidates the previous token', async () => {
    const f = setup({ playerUrl: 'file:///app/frame-player.html' }); f.host.update(f.frame, f.widget); const old = new URL(f.frame.src), ready = { channel: 'rea-inline-frame', operation: 'ready', token: old.hash.slice(1) };
    await open(f.runtime, { kind: 'page', pageId: 'frame-catalog' }); f.host.update(f.frame, f.widget); expect(new URL(f.frame.src).search).not.toBe(old.search);
    f.emit(ready); expect(f.messages).toHaveLength(0);
  });
  it('nested fixed players reuse the hashed script without a file request and still require a fresh handshake', async () => {
    const html = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'sha256-fixed\'"></head><body><script>fixedCode()</script></body></html>';
    const f = setup({ playerUrl: 'file:///app/frame-player.html', playerHtml: html });
    f.host.update(f.frame, f.widget);
    const token = f.frame.srcdoc.match(/name="rea-frame-token" content="([^"]+)"/)![1];
    expect(f.frame.src).toBe(''); expect(f.frame.srcdoc).not.toContain(f.doc.name);
    expect(f.frame.srcdoc).toContain('<script>fixedCode()</script>'); expect(f.frame.srcdoc).toContain("script-src 'sha256-fixed'");
    f.emit({ channel: 'rea-inline-frame', operation: 'ready', token }, {}); expect(f.messages).toHaveLength(0);
    f.emit({ channel: 'rea-inline-frame', operation: 'ready', token }); expect(f.messages).toHaveLength(1);
    await open(f.runtime, { kind: 'page', pageId: 'frame-catalog' }); f.host.update(f.frame, f.widget);
    expect(f.frame.srcdoc).not.toContain(`content="${token}"`);
    f.emit({ channel: 'rea-inline-frame', operation: 'parent', token, target: { kind: 'page', pageId: 'frame-detail' } });
    expect(f.runtime.state().pageId).toBe('frame-home');
  });
  it('external frame messages cannot claim parent navigation authority', async () => {
    const f = setup(); await open(f.runtime, { kind: 'url', url: 'https://example.invalid/never-visited' }); f.host.update(f.frame, f.widget);
    f.emit({ channel: 'rea-inline-frame', operation: 'parent', token: 'forged', target: { kind: 'page', pageId: 'frame-detail' } }); expect(f.runtime.state().pageId).toBe('frame-home');
  });
  it('records removed by navigation no longer accept even the old valid token', () => {
    const f = setup({ playerUrl: 'file:///app/frame-player.html' }); f.host.update(f.frame, f.widget); const token = new URL(f.frame.src).hash.slice(1); f.host.prune(new Set());
    f.emit({ channel: 'rea-inline-frame', operation: 'external', token, url: 'https://example.invalid/', target: 'new' }); expect(f.external).not.toHaveBeenCalled();
  });
  it('reports failed parent page loading instead of leaking an unhandled rejection', async () => {
    const onError = vi.fn(), f = setup({ playerUrl: 'file:///app/frame-player.html', onError });
    vi.spyOn(f.runtime, 'navigate').mockRejectedValueOnce(new Error('Page Loaded failed'));
    f.host.update(f.frame, f.widget); const token = new URL(f.frame.src).hash.slice(1);
    f.emit({ channel: 'rea-inline-frame', operation: 'parent', token, target: { kind: 'page', pageId: 'frame-detail' } });
    await Promise.resolve(); expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Page Loaded failed' }));
  });
  it('does not charge a new page against thirty-one stale iframe records', async () => {
    const f = setup(); const fresh = () => ({ ...f.frame, dataset: {}, style: {} }) as HTMLIFrameElement;
    for (let index = 0; index < 31; index++) { const element = fresh(); f.host.update(element, f.widget); expect(element.dataset.frameError).toBeUndefined(); }
    await f.runtime.navigate('frame-detail');
    for (let index = 0; index < 2; index++) { const element = fresh(); f.host.update(element, f.widget); expect(element.dataset.frameError).toBeUndefined(); }
  });
});
