import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDocument, createWidget } from '../src/model/document';
import { addSubmenu } from '../src/model/menu';
import type { Document, Interaction, Widget } from '../src/model/types';
import { exportPrototype, prototypeStyles } from '../src/runtime/export';
import { documentFontAssets, documentUsesOpenSans, documentUsesRoboto, installEmbeddedFonts, OPEN_SANS_FACES, OPEN_SANS_FONT_CSS, OPEN_SANS_FONT_LICENSE, ROBOTO_FONT_CSS, ROBOTO_FONT_LICENSE } from '../src/runtime/embedded-fonts';

function nested(kind: 'table' | 'menu' | 'submenu' | 'tree'): { root: Widget; leaf: Widget } {
  let root = createWidget(kind === 'submenu' ? 'menu' : kind);
  if (kind === 'table') return { root, leaf: root.table!.cells[0] };
  if (kind === 'menu') return { root, leaf: root.menu!.table.table!.cells[0] };
  if (kind === 'submenu') {
    root = addSubmenu(root, root.menu!.table.table!.cells[0].id);
    return { root, leaf: root.menu!.submenus[0].menu!.table.table!.cells[0] };
  }
  root.tree!.nodes[0].treeNode!.expanded = false;
  return { root, leaf: root.tree!.nodes[0].treeNode!.children[0].treeNode!.label };
}

describe('font bytes survive nested offline export', () => {
  it('embeds Open Sans in the standalone export and the shared nested-player stylesheet', () => {
    const doc = createDocument(), text = createWidget('text'); text.style.fontFamily = 'Open Sans'; doc.pages[0].widgets = [text];
    const before = JSON.stringify(doc), html = exportPrototype(doc);
    expect(html.match(/@font-face\{font-family:"Open Sans";/g)).toHaveLength(10);
    expect(html).not.toContain(ROBOTO_FONT_CSS);
    expect(prototypeStyles(doc).match(/@font-face\{font-family:"Open Sans";/g)).toHaveLength(10);
    expect(JSON.stringify(doc)).toBe(before);
  });

  for (const family of ['Roboto', 'Open Sans']) for (const kind of ['table', 'menu', 'submenu', 'tree'] as const) {
    it(`embeds ${family} used only by a ${kind} descendant, including unopened or collapsed content`, () => {
      const doc = createDocument(), { root, leaf } = nested(kind); leaf.style.fontFamily = family; doc.pages[0].widgets = [root];
      const before = JSON.stringify(doc), html = exportPrototype(doc);
      expect(html.match(new RegExp(`@font-face\\{font-family:"${family}";`, 'g'))).toHaveLength(family === 'Roboto' ? 12 : 10);
      expect(JSON.stringify(doc)).toBe(before);
    });
  }
});

// Pinned independent hashes from retained version 1.10, before product copies.
const sourceHashes: Record<string, string> = {
  Light: '80d5513e21af52eeac6e5893ad47c3f7d74b2464987ad669d28690d45eeafa23',
  Regular: '037236ed4bf58a85f67074c165d308260fd6be01c86d7df4e79ea16eb273f8c5',
  SemiBold: '5e8d9e1a89083cd1b0849993fe2f3acc9aa33b7f439f7e8616872f6897f30684',
  Bold: 'f7916a37377e38527d4306303cfe89b653b49b0a6b0b05c6b7593f7ab0248da8',
  ExtraBold: '4b2dc1f55b7b457c181d8ab3c2d34225f6eefac0b018d6e9abdd775a0eb29db6',
  LightItalic: '6554c38667bbc301ff5cbf6b724aea6815b8219b1a8086181377d4e54a6dc666',
  Italic: 'df8cd21a27b100aeb75454d0c4cb04bbf5d1cc54676cc35718189bf07b774000',
  SemiBoldItalic: 'c740413a1c59286e42a49467844a990819ba37f78ef687d21581e941708055d5',
  BoldItalic: 'b08b454c8e47e7ba3cbb59c0e6a8344174363c034d581fe12cb3c6fc3942b6d3',
  ExtraBoldItalic: '44356028d1a5a617da6804c3f7e3bc4595b38556da9f6c6bb171f6d53eb23a48',
};

describe('unmodified Open Sans font payload and registration', () => {
  it.each(OPEN_SANS_FACES)('embeds the real $name weight $weight $style face', face => {
    const encoded = face.url.match(/^data:font\/ttf;base64,([A-Za-z0-9+/=]+)$/); expect(encoded).not.toBeNull();
    const bytes = Buffer.from(encoded![1], 'base64');
    expect(bytes).toEqual(readFileSync(new URL(`../src/assets/fonts/open-sans/OpenSans-${face.name}.ttf`, import.meta.url)));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sourceHashes[face.name]);
    expect(bytes.readUInt32BE(0)).toBe(0x10000);
    const tables = new Map<string, number>();
    for (let index = 0; index < bytes.readUInt16BE(4); index++) {
      const entry = 12 + index * 16, offset = bytes.readUInt32BE(entry + 8), length = bytes.readUInt32BE(entry + 12);
      expect(offset + length).toBeLessThanOrEqual(bytes.length); tables.set(bytes.toString('ascii', entry, entry + 4), offset);
    }
    const os2 = tables.get('OS/2')!, italic = face.style === 'italic';
    expect(bytes.readUInt16BE(os2 + 4)).toBe(face.weight); expect(bytes.readUInt16BE(os2 + 8)).toBe(0);
    expect(Boolean(bytes.readUInt16BE(os2 + 62) & 1)).toBe(italic);
    expect(Boolean(bytes.readUInt16BE(tables.get('head')! + 44) & 2)).toBe(italic);
    expect(bytes.readInt32BE(tables.get('post')! + 4) / 65536).toBe(italic ? -12 : 0);
    const name = tables.get('name')!, strings = name + bytes.readUInt16BE(name + 4), values = new Map<number, string>();
    for (let i = 0; i < bytes.readUInt16BE(name + 2); i++) {
      const at = name + 6 + i * 12; if (bytes.readUInt16BE(at) !== 3 || bytes.readUInt16BE(at + 4) !== 1033) continue;
      const offset = strings + bytes.readUInt16BE(at + 10), length = bytes.readUInt16BE(at + 8);
      values.set(bytes.readUInt16BE(at + 6), Buffer.from(bytes.subarray(offset, offset + length)).swap16().toString('utf16le'));
    }
    expect(values.get(6)).toBe(`OpenSans-${face.name}`); expect(values.get(13)).toBe('Licensed under the Apache License, Version 2.0');
    expect(OPEN_SANS_FONT_CSS).toContain(`font-style:${face.style};font-weight:${face.weight};font-display:block;src:url("${face.url}")`);
  });

  it('registers ten unique faces without a duplicate 400 italic or host/network font dependency', () => {
    for (const style of ['normal', 'italic']) expect(OPEN_SANS_FACES.filter(face => face.style === style).map(face => face.weight)).toEqual([300, 400, 600, 700, 800]);
    expect(new Set(OPEN_SANS_FACES.map(face => face.url)).size).toBe(10);
    expect(readdirSync(new URL('../src/assets/fonts/open-sans/', import.meta.url)).filter(file => file.endsWith('.ttf'))).toHaveLength(10);
    expect(OPEN_SANS_FACES.some(face => (face.name as string) === 'RegularItalic')).toBe(false);
    expect(OPEN_SANS_FONT_CSS).not.toMatch(/local\(|https?:|\/src\//);
    expect((OPEN_SANS_FONT_CSS.match(/@font-face/g) ?? []).length).toBe(10);
  });

  it('installs both families once, including when Roboto was installed earlier', () => {
    const elements = new Map<string, { id: string; textContent: string }>([['rea-embedded-roboto', { id: 'rea-embedded-roboto', textContent: ROBOTO_FONT_CSS }]]);
    const target = { getElementById: (id: string) => elements.get(id), createElement: () => ({ id: '', textContent: '' }), head: { append: (element: { id: string; textContent: string }) => { expect(elements.has(element.id)).toBe(false); elements.set(element.id, element); } } };
    installEmbeddedFonts(target as unknown as globalThis.Document); installEmbeddedFonts(target as unknown as globalThis.Document);
    expect(elements.size).toBe(2); expect(elements.get('rea-embedded-open-sans')!.textContent).toBe(OPEN_SANS_FONT_CSS);
  });
});

describe('exact family discovery across saved style carriers', () => {
  it.each(['Open Sans', 'open sans', '"Open Sans", Arial', "'Open Sans', sans-serif", 'Arial, Open Sans', 'Open   Sans', 'Open\t\nSans'])('recognizes %s', fontFamily => {
    const doc = createDocument(), widget = createWidget('text'); widget.style.fontFamily = fontFamily; doc.pages[0].widgets = [widget]; expect(documentUsesOpenSans(doc)).toBe(true);
  });
  it.each(['OpenSansCondensed', 'Open Sans Condensed', 'Not Open Sans', '"Open Sans,Roboto"', '"Open   Sans"', 'Arial, sans-serif'])('does not embed a substring or quoted composite family %s', fontFamily => {
    const doc = createDocument(), widget = createWidget('text'); widget.style.fontFamily = fontFamily; doc.pages[0].widgets = [widget];
    expect(documentUsesOpenSans(doc)).toBe(false); expect(documentUsesRoboto(doc)).toBe(false); expect(documentFontAssets(doc)).toEqual({ css: '', license: '' });
  });

  const event = (targetId: string): Interaction => ({ id: 'font-event', name: 'Later font', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'font-action', type: 'setStyle', targetId, style: { fontFamily: 'Open Sans' } }] });
  const carriers: [string, (doc: Document, widget: Widget) => void][] = [
    ...(['selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'disabledStyle', 'errorStyle', 'hintStyle'] as const).map(key => [key, (_doc: Document, w: Widget) => { w[key] = { fontFamily: 'Open Sans' }; }] as [string, (doc: Document, widget: Widget) => void]),
    ['widget action', (_doc, w) => { w.interactions = [event(w.id)]; }],
    ['page action', (doc, w) => { doc.pages[0].interactions = [event(w.id)]; doc.pages[0].interactions[0].event = 'load'; }],
    ['adaptive override', (doc, w) => { doc.pages[0].adaptiveViews = [{ id: 'font-view', name: 'Small', width: 400, overrides: { [w.id]: { style: { fontFamily: 'Open Sans' } } } }]; }],
    ['shared style', (doc, w) => { doc.styles = [{ id: 'font-shared', name: 'Later font', style: { ...w.style, fontFamily: 'Open Sans' } }]; }],
    ['component definition', doc => { const table = createWidget('table'); table.table!.cells[0].style.fontFamily = 'Open Sans'; doc.components = [{ id: 'font-component', name: 'Unused component', width: table.width, height: table.height, widgets: [table] }]; }],
    ['inactive panel state and repeater template', doc => { const panel = createWidget('panel'), repeater = createWidget('repeater'); repeater.repeater!.template[0].style.fontFamily = 'Open Sans'; panel.states!.push({ id: 'font-state', name: 'Later', widgets: [repeater] }); doc.pages[0].widgets.push(panel); }],
  ];
  it.each(carriers)('includes deferred %s without changing the design', (_name, apply) => {
    const doc = createDocument(), w = createWidget('input'); doc.pages[0].widgets = [w]; apply(doc, w);
    const before = JSON.stringify(doc); expect(documentUsesOpenSans(doc)).toBe(true); expect(exportPrototype(doc)).toContain(OPEN_SANS_FONT_CSS); expect(JSON.stringify(doc)).toBe(before);
  });
  it.each(['run', 'link hover', 'link down', 'link action'])('includes fonts found only in a rich %s', location => {
    const doc = createDocument(), w = createWidget('text'); w.text = 'Link';
    w.richText = { paragraphs: [{ runs: [{ text: w.text, linkId: 'font-link' }] }], links: [{ id: 'font-link', name: 'Link', interactions: [] }] };
    if (location === 'run') w.richText.paragraphs[0].runs[0].style = { fontFamily: 'Open Sans' };
    if (location === 'link hover') w.richText.links![0].mouseOverStyle = { fontFamily: 'Open Sans' };
    if (location === 'link down') w.richText.links![0].mouseDownStyle = { fontFamily: 'Open Sans' };
    if (location === 'link action') w.richText.links![0].interactions = [event(w.id)];
    doc.pages[0].widgets = [w]; expect(documentUsesOpenSans(doc)).toBe(true); expect(exportPrototype(doc)).toContain(OPEN_SANS_FONT_CSS);
  });

  it('omits unused family payloads, even when names occur as literal text or variables', () => {
    const doc = createDocument(), w = createWidget('text'); w.text = 'Open Sans Roboto'; w.notes = 'Open Sans'; doc.variables.fontFamily = 'Open Sans'; doc.pages[0].widgets = [w];
    const html = exportPrototype(doc); expect(html).not.toContain('@font-face'); expect(html).not.toContain('data:font/ttf'); expect(html).not.toContain('Apache License');
  });
  it('exports both families and full attribution while retaining font sizes, geometry and document bytes', () => {
    const doc = createDocument(), w = createWidget('text'), other = createWidget('text'); w.style.fontFamily = 'Open Sans'; w.style.fontSize = 28; w.width = 95; w.height = 27; other.style.fontFamily = 'Roboto'; doc.pages[0].widgets = [w, other];
    const before = JSON.stringify(doc), html = exportPrototype(doc);
    expect(html).toContain(OPEN_SANS_FONT_CSS); expect(html).toContain(ROBOTO_FONT_CSS); expect((html.match(/@font-face\{/g) ?? []).length).toBe(22);
    expect(html).toContain(OPEN_SANS_FONT_LICENSE.replace(/--/g, '- -')); expect(html).toContain(ROBOTO_FONT_LICENSE.replace(/--/g, '- -'));
    for (const expected of ['Google Corporation', 'Ascender Corporation', 'version 1.10', '4. Redistribution.', '9. Accepting Warranty or Additional Liability.', 'END OF TERMS AND CONDITIONS']) expect(OPEN_SANS_FONT_LICENSE).toContain(expected);
    const openLicense = readFileSync(new URL('../src/assets/fonts/open-sans/LICENSE.txt', import.meta.url));
    expect(createHash('sha256').update(openLicense).digest('hex')).toBe('c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4');
    expect(html).toContain('font-src data:'); expect(html).toContain("connect-src 'none'"); expect(html).not.toMatch(/<link[^>]+href=/);
    const saved = JSON.parse(html.match(/<script id="prototype-data" type="application\/json">([^]*?)<\/script>/)![1]);
    expect(saved).toEqual(doc); expect(JSON.stringify(doc)).toBe(before);
  });
});
