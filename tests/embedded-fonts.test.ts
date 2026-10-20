import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDocument, createLayer, createWidget } from '../src/model/document';
import { ROBOTO_FACES, ROBOTO_FONT_CSS, ROBOTO_FONT_LICENSE, documentUsesRoboto } from '../src/runtime/embedded-fonts';
import { exportPrototype } from '../src/runtime/export';

describe('portable Roboto font bytes and weight registration', () => {
  it.each(ROBOTO_FACES)('embeds the unmodified $name binary for CSS weight $weight', face => {
    const match = face.url.match(/^data:font\/ttf;base64,([A-Za-z0-9+/=]+)$/); expect(match).not.toBeNull();
    const embedded = Buffer.from(match![1], 'base64'), original = readFileSync(new URL(`../src/assets/fonts/roboto/Roboto-${face.name}.ttf`, import.meta.url));
    expect(embedded).toEqual(original); expect(createHash('sha256').update(embedded).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
    expect(embedded.readUInt32BE(0)).toBe(0x00010000); // TrueType SFNT, not a URL or a stub string.
    expect(ROBOTO_FONT_CSS).toContain(`font-style:${face.style};font-weight:${face.weight};font-display:block;src:url("${face.url}")`);
  });
  it('registers six normal and six italic weights with no dependency on host fonts or network', () => {
    for (const style of ['normal', 'italic']) expect(ROBOTO_FACES.filter(face => face.style === style).map(face => face.weight)).toEqual([100, 300, 400, 500, 700, 900]);
    expect((ROBOTO_FONT_CSS.match(/@font-face/g) ?? []).length).toBe(12);
    expect((ROBOTO_FONT_CSS.match(/font-style:normal/g) ?? []).length).toBe(6);
    expect((ROBOTO_FONT_CSS.match(/font-style:italic/g) ?? []).length).toBe(6);
    expect(ROBOTO_FONT_CSS).not.toMatch(/local\(|https?:|\/src\//);
    // Thin.ttf has native OS/2 weight 250. The CSS 100 registration above is an
    // explicit family choice; preserve and verify the source metadata as well.
    const thin = readFileSync(new URL('../src/assets/fonts/roboto/Roboto-Thin.ttf', import.meta.url));
    let os2 = -1;
    for (let index = 0; index < thin.readUInt16BE(4); index++) { const entry = 12 + index * 16; if (thin.toString('ascii', entry, entry + 4) === 'OS/2') os2 = thin.readUInt32BE(entry + 8); }
    expect(os2).toBeGreaterThan(0); expect(thin.readUInt16BE(os2 + 4)).toBe(250);
  });
  it.each(ROBOTO_FACES.filter(face => face.style === 'italic'))('uses real $name outlines with embeddable font metadata', face => {
    const bytes = readFileSync(new URL(`../src/assets/fonts/roboto/Roboto-${face.name}.ttf`, import.meta.url)), tables = new Map<string, number>();
    for (let index = 0; index < bytes.readUInt16BE(4); index++) { const entry = 12 + index * 16; tables.set(bytes.toString('ascii', entry, entry + 4), bytes.readUInt32BE(entry + 8)); }
    expect(bytes.readUInt16BE(tables.get('OS/2')! + 8)).toBe(0);
    expect(bytes.readUInt16BE(tables.get('OS/2')! + 62) & 1).toBe(1);
    expect(bytes.readUInt16BE(tables.get('head')! + 44) & 2).toBe(2);
    expect(bytes.readInt32BE(tables.get('post')! + 4) / 65536).toBe(-12);
  });
});

describe('document font use and self-contained export', () => {
  it('finds a font used only inside nested Layers', () => {
    const doc = createDocument(), text = createWidget('text');
    text.style.fontFamily = 'Roboto';
    doc.pages[0].widgets = [createLayer([createLayer([text])])];
    expect(documentUsesRoboto(doc)).toBe(true);
    expect(exportPrototype(doc)).toContain('data:font/ttf;base64,');
  });
  it('embeds Roboto when only a rich run uses it', () => {
    const doc = createDocument(), widget = createWidget('text'); widget.style.fontFamily = 'Arial'; widget.text = 'Run font';
    widget.richText = { paragraphs: [{ runs: [{ text: widget.text, style: { fontFamily: 'Roboto', fontStyle: 'italic' } }] }] }; doc.pages[0].widgets = [widget];
    expect(documentUsesRoboto(doc)).toBe(true); expect(exportPrototype(doc)).toContain('data:font/ttf;base64,');
    widget.richText.paragraphs[0].runs[0].style!.fontFamily = 'Arial'; expect(documentUsesRoboto(doc)).toBe(false);
  });
  it('omits font payloads and license blocks for an unrelated document without modifying it', () => {
    const doc = createDocument(), text = createWidget('text'); text.style.fontFamily = 'Arial'; text.text = 'Roboto'; text.notes = 'Roboto'; doc.variables.fontFamily = 'Roboto'; doc.pages[0].widgets.push(text);
    const before = JSON.stringify(doc); expect(documentUsesRoboto(doc)).toBe(false);
    const html = exportPrototype(doc); expect(html).not.toContain('data:font/ttf;base64,'); expect(html).not.toContain('@font-face'); expect(JSON.stringify(doc)).toBe(before);
  });
  it.each(['Roboto', 'roboto', '"Roboto", Arial', "'Roboto', sans-serif"] )('recognizes the exact family in %s', fontFamily => {
    const doc = createDocument(), text = createWidget('text'); text.style.fontFamily = fontFamily; doc.pages[0].widgets.push(text); expect(documentUsesRoboto(doc)).toBe(true);
  });
  it.each(['Roboto Condensed', 'NotRoboto', 'Arial, sans-serif'])('does not alias %s to the bundled family', fontFamily => {
    const doc = createDocument(), text = createWidget('text'); text.style.fontFamily = fontFamily; doc.pages[0].widgets.push(text); expect(documentUsesRoboto(doc)).toBe(false);
  });
  it('finds nested inactive states, repeater templates, style effects, components, adaptive overrides and actions', () => {
    const doc = createDocument(), panel = createWidget('panel'), nested = createWidget('text'); panel.states![0].widgets.push(nested); doc.pages[0].widgets.push(panel);
    nested.errorStyle = { fontFamily: 'Roboto' }; expect(documentUsesRoboto(doc)).toBe(true); delete nested.errorStyle;
    const repeater = createWidget('repeater'); panel.states![0].widgets.push(repeater); repeater.repeater!.template[0].hintStyle = { fontFamily: 'Roboto' }; expect(documentUsesRoboto(doc)).toBe(true); delete repeater.repeater!.template[0].hintStyle;
    doc.components.push({ id: 'component', name: 'Component', width: 100, height: 100, widgets: [{ ...nested, style: { ...nested.style, fontFamily: 'Roboto' } }] }); expect(documentUsesRoboto(doc)).toBe(true); doc.components = [];
    doc.pages[0].adaptiveViews.push({ id: 'narrow', name: 'Narrow', width: 400, overrides: { [nested.id]: { style: { fontFamily: 'Roboto' } } } }); expect(documentUsesRoboto(doc)).toBe(true); doc.pages[0].adaptiveViews = [];
    doc.pages[0].interactions.push({ id: 'event', name: 'Load', event: 'load', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: 'action', type: 'setStyle', targetId: nested.id, style: { fontFamily: 'Roboto' } }] }); expect(documentUsesRoboto(doc)).toBe(true); doc.pages[0].interactions = [];
    nested.interactions.push({ id: 'event', name: 'Click', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: 'action', type: 'setStyle', targetId: nested.id, style: { fontFamily: 'Roboto' } }] }); expect(documentUsesRoboto(doc)).toBe(true); nested.interactions = [];
    expect(documentUsesRoboto(doc)).toBe(false);
  });
  it('embeds all twelve CSS faces and complete license/notice while preserving authored font and geometry', () => {
    const doc = createDocument(), text = createWidget('text'); text.style.fontFamily = 'Roboto'; text.width = 78; text.height = 16; doc.pages[0].widgets.push(text);
    const before = JSON.stringify(doc), html = exportPrototype(doc);
    expect(html).toContain(ROBOTO_FONT_CSS); expect(html).toContain(ROBOTO_FONT_LICENSE.replace(/--/g, '- -'));
    expect(ROBOTO_FONT_LICENSE).toContain('Apache License'); expect(ROBOTO_FONT_LICENSE).toContain('TERMS AND CONDITIONS'); expect(ROBOTO_FONT_LICENSE).toContain('Google');
    expect(html).toContain('font-src data:'); expect(html).toContain("connect-src 'none'"); expect(html).not.toMatch(/<link[^>]+href=/);
    const saved = JSON.parse(html.match(/<script id="prototype-data" type="application\/json">([^]*?)<\/script>/)![1]);
    expect(saved.pages[0].widgets[0]).toEqual(text); expect(JSON.stringify(doc)).toBe(before);
  });
});
