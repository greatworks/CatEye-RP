import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';
import type { Document, Widget } from '../src/model/types';
const diagramWidgets=(items:Widget[]):Widget[]=>items.flatMap(w=>[w,...(w.layer?diagramWidgets(w.layer.widgets):[])]);

const file = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const manifest = JSON.parse(fs.readFileSync(file('../research/rp-input-types-evidence.json'), 'utf8'));
const sample = manifest.samples.find((s: {file: string}) => s.file.endsWith('Sample form patterns.rplib'));
const readScript = "import {pathToFileURL} from 'node:url'; const reader=process.argv[1], file=process.argv[2]; process.argv[1]=''; const {inspectRpSemantics}=await import(pathToFileURL(reader).href); process.stdout.write(JSON.stringify(inspectRpSemantics(file)));";
const recovered = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', readScript, file('../research/scripts/read-rp-semantics.mjs'), sample.file], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024}));
const imported = importRpSemantics(recovered);
const baseline: Document = JSON.parse(fs.readFileSync(file('../research/native-caption-before.rea.json'), 'utf8'));
const page = imported.document.pages.find(p => p.name === 'Personal information form')!;
const before = baseline.pages.find(p => p.name === page.name)!;
const captions = ['First name*', 'Last name*', 'Email address*', 'Phone number', 'Date of birth', 'Country / Region', 'Street address', 'City', 'State / Province', 'ZIP / Postal'];

describe('real library caption inheritance', () => {
  it.each(captions)('%s keeps its stored rectangle and recovers explicit label text layout', text => {
    const w = diagramWidgets(page.widgets).find(w => w.text === text)!, old = before.widgets.find(item => item.id === w.id)!;
    expect(w).toBeDefined(); expect(old).toBeDefined();
    expect({x: w.x, y: w.y, width: w.width, height: w.height}).toEqual({x: old.x, y: old.y, width: old.width, height: old.height});
    expect(w.style).toMatchObject({fontFamily: 'Roboto', fontSize: 14, fontWeight: 400, strokeWidth: 0, textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal'});
    const raw = recovered.diagrams.find((d: {name: string}) => d.name === page.name).widgets.find((item: {id: string}) => w.id.endsWith(item.id));
    expect(raw.styleRecovery).toMatchObject({cacheChainComplete: true, defaultStyleId: '627587b6038d43cca051c114ac41ad32', defaultStyleLibraryId: '61e3924b25c44f18a45c876a031974fd'});
    expect(old.style.textPadding).toBeUndefined(); expect(old.style.strokeWidth).toBe(1);
  });
  it('persists recovered styles without mutating the semantic input', () => {
    const before = JSON.stringify(recovered); importRpSemantics(recovered);
    expect(JSON.stringify(recovered)).toBe(before);
    expect(parseDocument(serializeDocument(imported.document))).toEqual(imported.document);
  });
});
