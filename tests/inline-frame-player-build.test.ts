import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderFramePlayerHtml } from '../scripts/frame-player-build';
import { exportPrototype } from '../src/runtime/export';
import { inlineFrameFixture } from './fixtures/inline-frames';

const template = readFileSync(new URL('../public/frame-player.html', import.meta.url), 'utf8');
describe('fixed inline-frame player HTML', () => {
  it('authorizes exactly its inline classic script without external script resources or unsafe-inline', () => {
    const html = renderFramePlayerHtml('globalThis.started = true;', template);
    const script = html.match(/<script>([^]*?)<\/script>/)![1];
    expect(html).toContain(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`);
    expect(html).not.toMatch(/<script[^>]+(?:src|type)=/);
    expect(html).not.toMatch(/script-src[^;]*(?:unsafe-inline|unsafe-eval|'self')/);
    expect(html).not.toContain('__REA_PLAYER_');
    expect(html).toContain("connect-src 'none'");
    const context: { started?: boolean } = {}; new Script(script).runInNewContext(context); expect(context.started).toBe(true);
  });
  it('normalizes line endings before hashing and escapes HTML script end tags without altering string values', () => {
    const code = 'globalThis.text = "</ScRiPt><script>bad()</script>";\r\n// end\r';
    const html = renderFramePlayerHtml(code, template), script = html.match(/<script>([^]*?)<\/script>/)![1];
    expect((html.match(/<\/script>/gi) ?? []).length).toBe(1);
    expect(script).not.toContain('\r');
    expect(html).toContain(`sha256-${createHash('sha256').update(script).digest('base64')}`);
    const context: { text?: string } = {}; new Script(script).runInNewContext(context); expect(context.text).toBe('</ScRiPt><script>bad()</script>');
  });
  it('rejects a template that could duplicate or omit the script/hash boundary', () => {
    expect(() => renderFramePlayerHtml('void 0', template.replace('__REA_PLAYER_SCRIPT__', ''))).toThrow(/template/);
    expect(() => renderFramePlayerHtml('void 0', template + '__REA_PLAYER_CSP_HASH__')).toThrow(/template/);
  });
  it('embeds each licensed font only once while giving child frame hosts the root stylesheet', () => {
    const doc = inlineFrameFixture(); doc.pages[1].widgets[0].style.fontFamily = 'Roboto';
    const html = exportPrototype(doc);
    expect((html.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(12);
    expect(html).toContain('<style id="prototype-styles">');
    expect(html).toContain("styles:document.getElementById('prototype-styles').textContent");
    const css = html.match(/<style id="prototype-styles">([^]*?)<\/style>/)![1];
    expect((css.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(12);
  });
});
