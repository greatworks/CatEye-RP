import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { importAdaptiveStyles } from '../src/model/import-rp-adaptive';
import { parseDocument, serializeDocument } from '../src/model/document';

const recovered = JSON.parse(execFileSync(process.execPath, [
  fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url)),
  fileURLToPath(new URL('../research/samples/Default.rplib', import.meta.url)),
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
function source() {
  const input = structuredClone(recovered);
  input.diagrams = input.diagrams.filter((page: { widgets: { type: string }[] }) =>
    page.widgets.length === 1 && page.widgets[0].type === 'Axure:DiagramObject:Checkbox');
  expect(input.diagrams).toHaveLength(1);
  return input;
}
describe('native selection layout import', () => {
  it('imports the exact stored Checkbox spelling, text, rectangle and checked state without changing the recovery', () => {
    const input = source(), original = JSON.stringify(input), native = input.diagrams[0].widgets[0];
    expect(native.typeCandidate.type).toBe('checkbox');
    const { document, report } = importRpSemantics(input);
    expect(report).toMatchObject({ widgetsImported: 1, widgetsSkipped: 0 });
    const widget = document.pages[0].widgets[0];
    expect(widget).toMatchObject({
      id: `rp-w-${input.diagrams[0].packageId}-${native.id}`,
      type: 'checkbox', text: native.text.text, checked: native.selectionRecovery.selected,
      x: native.storedGeometry.location.value.X, y: native.storedGeometry.location.value.Y,
      width: native.storedGeometry.size.value.Width, height: native.storedGeometry.size.value.Height,
      selectionText: {
        autoFitWidth: native.storedFlags.AutoFitWidth,
        autoFitHeight: native.storedFlags.AutoFitHeight,
        alignRight: false,
      },
      style: { selectionButtonSize: native.selectionLayoutRecovery.buttonSize.value },
    });
    expect(widget.richText).toBeDefined();
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    expect(JSON.stringify(input)).toBe(original);
  });
  it.each([
    'status', 'sourceId', 'styleId', 'version', 'chain', 'size', 'sizeFlag', 'sizeSource',
    'fit', 'alignment', 'extra', 'inactive',
  ])('rejects inconsistent selection layout evidence: %s', mutation => {
    const input = source(), native = input.diagrams[0].widgets[0], layout = native.selectionLayoutRecovery;
    switch (mutation) {
      case 'status': layout.status = 'unsupported-selection-layout'; break;
      case 'sourceId': layout.sourceId = 'f'.repeat(32); break;
      case 'styleId': layout.styleId = 'f'.repeat(32); break;
      case 'version': layout.packageVersion = [10, 0, 0, 0]; break;
      case 'chain': layout.cacheChainComplete = false; break;
      case 'size': layout.buttonSize.value = -1; break;
      case 'sizeFlag': layout.buttonSize.rawDoaName = 94 | 0x80000000; break;
      case 'sizeSource': layout.buttonSize.source = { kind: 'guessed-default', value: 12 }; break;
      case 'fit': layout.sharedFields.AutoFitWidth = !native.storedFlags.AutoFitWidth; break;
      case 'alignment': layout.sharedFields['align-selection-button-right'] = false; break;
      case 'extra': layout.unrecognized = true; break;
      case 'inactive': layout.inactive = { rawDoaName: 94 | 0xc0000000, value: 12 }; break;
    }
    const { document, report } = importRpSemantics(input);
    expect(report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1 });
    expect(document.pages[0].widgets).toEqual([]);
    expect(report.issues.find(issue => issue.code === 'widget-skipped')?.message).toMatch(/选择控件布局/);
  });
  it.each([0, 18, 37.5])('keeps explicit P94 %s in normal selection and hover states without changing stored geometry', indicator => {
    const input = source(), native = input.diagrams[0].widgets[0];
    native.selectionRecovery.selectedStyle = {selectionButtonSize:indicator};
    native.interactionStyleRecovery.states.mouseover = {
      sourceState:'MouseOver',status:'supported-state-style',sourceStyleId:'d'.repeat(32),
      sourceProperties:[94],style:{selectionButtonSize:indicator},
      provenance:{selectionButtonSize:{kind:'stored-active-state-style',state:'MouseOver',objectId:'d'.repeat(32),property:'SELECTION_BUTTON_SIZE'}},
    };
    const {document,report} = importRpSemantics(input), widget = document.pages[0].widgets[0];
    expect(report.widgetsSkipped).toBe(0);
    expect(widget.selectedStyle).toEqual({selectionButtonSize:indicator});
    expect(widget.mouseOverStyle).toEqual({selectionButtonSize:indicator});
    expect(widget.width).toBe(native.storedGeometry.size.value.Width);
    expect(widget.height).toBe(native.storedGeometry.size.value.Height);
    expect(widget.selectionText?.autoFitWidth).toBe(native.storedFlags.AutoFitWidth);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
  it('rejects disagreement between ordinary P94 style and its dedicated source evidence', () => {
    const input = source(), native = input.diagrams[0].widgets[0];
    native.selectionRecovery.baseStyleRecovery.style.selectionButtonSize = 999;
    const {report} = importRpSemantics(input);
    expect(report.widgetsSkipped).toBe(1);
    expect(report.issues.find(issue=>issue.code==='widget-skipped')?.message).toMatch(/选择控件布局尺寸/);
  });
  it.each(['missing-size','missing-origin','different-origin','extra-origin'])(
    'rejects incomplete or inconsistent normal-style provenance: %s', mutation => {
      const input = source(), native = input.diagrams[0].widgets[0];
      const normal = native.selectionRecovery.baseStyleRecovery;
      if (mutation === 'missing-size') delete normal.style.selectionButtonSize;
      if (mutation === 'missing-origin') delete normal.provenance.selectionButtonSize;
      if (mutation === 'different-origin') native.selectionLayoutRecovery.buttonSize.source = {
        kind:'cached-document-default',styleId:'e'.repeat(32),libraryId:'f'.repeat(32),
      };
      if (mutation === 'extra-origin') normal.provenance.selectionButtonSize.guessed = true;
      const {document,report} = importRpSemantics(input);
      expect(report.widgetsSkipped).toBe(1);
      expect(document.pages[0].widgets).toEqual([]);
      expect(report.issues.find(issue=>issue.code==='widget-skipped')?.message).toMatch(/选择控件布局/);
    },
  );
  it.each([0, 12, 37.5])('projects normal and state adaptive P94 %s independently of shared fit data', value => {
    const input = source(), native = input.diagrams[0].widgets[0];
    const widget = importRpSemantics(input).document.pages[0].widgets[0], before = structuredClone(widget);
    const stateId = 'e'.repeat(32), viewId = 'c'.repeat(32);
    const expected = {style:{selectionButtonSize:value},stateStyles:{selected:{selectionButtonSize:value}}};
    const proof = {schema:1,status:'decoded-adaptive-styles',sourceId:native.id,entries:[{
      viewId,styleId:'d'.repeat(32),status:'supported-local-adaptive-style',patch:expected,
      source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],
        properties:[{rawDoaName:94|0xc0000000,value},{rawDoaName:21|0xc0000000,
          value:{$map:[['Selected',{$reference:stateId,referenceTag:3}]]}}],
        stateStyleSources:[{state:'selected',sourceId:stateId,properties:[{rawDoaName:94|0xc0000000,value}]}]},
    }]};
    const actual = importAdaptiveStyles(proof,2,native.id,widget,()=>{});
    expect(actual.get(`rp-av-${viewId}`)).toEqual(expected);
    expect(widget).toEqual(before);
    const inconsistent = structuredClone(proof); inconsistent.entries[0].source.properties[0].value = value + 1;
    expect(()=>importAdaptiveStyles(inconsistent,2,native.id,widget,()=>{})).toThrow(/投影与原生属性记录不一致/);
    expect(()=>importAdaptiveStyles(proof,2,native.id,{...widget,type:'box'},()=>{})).toThrow(/选择控件尺寸未验证/);
  });
  it.each(['Axure:DiagramObject:checkbox', 'Axure:DiagramObject:CheckboxUnknown', 'Axure:DiagramObject:RadioButton'])(
    'rejects a checkbox candidate with inconsistent source type %s', type => {
      const input = source(); input.diagrams[0].widgets[0].type = type;
      const { document, report } = importRpSemantics(input);
      expect(report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1 });
      expect(document.pages[0].widgets).toEqual([]);
      expect(report.issues.find(issue => issue.code === 'widget-skipped')?.message).toMatch(/类型候选与源类型不一致/);
    });
});
