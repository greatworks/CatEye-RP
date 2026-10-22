import { describe, expect, it, vi } from 'vitest';
import { createWidget } from '../src/model/document';
import { planSelectionAuthorCommand } from '../src/model/selection-author-command';
import { selectionAuthorGeometry, unionSelectionAuthorRectangles } from '../src/model/selection-author-geometry';

function source() {
  const widget = createWidget('checkbox', 20, 30);
  Object.assign(widget, { width: 100, height: 16, text: 'Label',
    selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { textPadding: [0, 0, 0, 0], selectionButtonSize: 14,
    verticalAlign: 'middle', textAlign: 'left' });
  return widget;
}
const panel = { x: 14, y: 0, width: 86, height: 16 };
const services = () => ({ ...selectionAuthorGeometry, measureText: vi.fn(() => ({ width: 37.5, height: 16 })) });

describe('selection author commands', () => {
  it('fits from raw browser metrics with one source-derived rounding and leaves its source untouched', () => {
    const widget = source(), before = structuredClone(widget);
    const result = planSelectionAuthorCommand(widget, panel, { kind: 'fit', axis: 'width', value: true }, services());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual({ x: 20, y: 30, width: 52, height: 16 });
    expect(result.effects.filter(e => e.name === 'fit.flag')).toEqual([{ name: 'fit.flag', axis: 'width', value: true }]);
    expect(widget).toEqual(before);
  });
  it('moves an indicator using the existing panel without a font measurement when height stays the same', () => {
    const service = services();
    const result = planSelectionAuthorCommand(source(), panel, { kind: 'alignRight', value: true }, service);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(service.measureText).not.toHaveBeenCalled();
    expect(result.state.textPanelRect).toEqual({ ...panel, x: 0 });
    expect(result.effects.find(e => e.name === 'indicator.rect')?.rect).toEqual({ x: 106, y: 31, width: 14, height: 14 });
    expect(result.effects.at(-1)).toEqual({ name: 'VJm0', value: false, property: null });
  });
  it('does nothing for an unchanged indicator side', () => {
    const result = planSelectionAuthorCommand(source(), panel, { kind: 'alignRight', value: false }, services());
    expect(result.ok && result.effects).toEqual([]);
  });
  it('retains failure as a rejected atomic candidate', () => {
    const result = planSelectionAuthorCommand(source(), panel, { kind: 'fit', axis: 'width', value: true },
      { ...selectionAuthorGeometry, measureText() { throw Error('No font metrics'); } });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('state');
  });
  it('does not replace the previous panel with the requested owner size', () => {
    const widget = source(); widget.selectionText!.autoFitWidth = true;
    const result = planSelectionAuthorCommand(widget, { ...panel, width: 86 }, { kind: 'size', width: 800, allViews: true }, services());
    expect(result.ok).toBe(true);
    // The cached panel already fits the 100px owner, so the native Size setter
    // is a no-op. The requested 800px never becomes a new measurement panel.
    expect(result.effects.map(effect => effect.name)).toEqual(['minimum.read', 'minimum.read']);
    expect(result.measurementPasses).toBe(0);
  });
  it('rejects undeclared layout and rotation before attempting a transaction', () => {
    const widget = source(); delete widget.selectionText;
    expect(() => planSelectionAuthorCommand(widget, panel, { kind: 'alignRight', value: true }, services())).toThrow(/layout settings/);
    widget.selectionText = source().selectionText; widget.rotation = 10;
    expect(() => planSelectionAuthorCommand(widget, panel, { kind: 'fit', axis: 'height', value: true }, services())).toThrow(/rotated/);
  });
  it('expands P94 from the previous text panel before measuring the new declaration', () => {
    const widget=source(); widget.style.selectionButtonSize=150;
    const before=structuredClone(widget), service=services();
    const result=planSelectionAuthorCommand(widget,panel,{kind:'properties',indicatorChanged:true},service);
    expect(result.ok).toBe(true); if(!result.ok)return;
    expect(result.state.ownerRect).toMatchObject({width:236,height:150});
    expect(service.measureText).toHaveBeenCalled();
    expect(result.effects.filter(effect=>effect.name==='style.Size').every(effect=>!effect.allViews)).toBe(true);
    expect(widget).toEqual(before);
  });
  it('uses candidate rich text emptiness and its new metrics for the post-sync text entry', () => {
    const widget=source(); widget.selectionText!.autoFitWidth=true;
    widget.text='';widget.richText={paragraphs:[{runs:[{text:'Rich candidate'}]}]};
    const result=planSelectionAuthorCommand(widget,panel,{kind:'textChanged'},services());
    expect(result.ok).toBe(true); if(!result.ok)return;
    expect(result.state.ownerRect.width).toBe(52);
    expect(result.effects.at(-1)).toEqual({name:'VJm0',value:false,property:null});
  });
  it('rejects a style transaction if a later measurement fails after its first correction', () => {
    const widget=source();widget.selectionText!.autoFitWidth=true;
    const before=structuredClone(widget), service=services();
    service.measureText.mockImplementationOnce(()=>({width:80,height:16})).mockImplementationOnce(()=>{throw Error('Later font failure');});
    const result=planSelectionAuthorCommand(widget,panel,{kind:'properties',indicatorChanged:false},service);
    expect(result.ok).toBe(false);expect(result).not.toHaveProperty('state');expect(widget).toEqual(before);
  });
});

describe('finite author rectangle union', () => {
  const a = { x: 100, y: 200, width: 14, height: 14 };
  it('ignores a zero-width text panel without extending the indicator', () => {
    expect(unionSelectionAuthorRectangles(a, { x: -40, y: -100, width: 0, height: 16 })).toEqual(a);
  });
  it('retains the exact epsilon boundary and the ordinary rectangle extent', () => {
    const b = { x: 0, y: 0, width: 1e-5, height: 16 };
    expect(unionSelectionAuthorRectangles(a, b)).toEqual({ x: 0, y: 0, width: 114, height: 214 });
    expect(unionSelectionAuthorRectangles(a, { ...b, width: .000009 })).toEqual(a);
  });
  it('keeps the source ordering when both rectangles are empty', () => {
    const b = { x: 0, y: 0, width: 0, height: 40 }, c = { x: 10, y: 20, width: 10, height: 0 };
    expect(unionSelectionAuthorRectangles(b, c)).toEqual(c);
  });
  it('rejects sentinels that the product model cannot represent', () => {
    expect(() => unionSelectionAuthorRectangles(a, { ...a, x: NaN })).toThrow(/finite/);
    expect(() => unionSelectionAuthorRectangles(a, { ...a, height: -1 })).toThrow(/nonnegative/);
  });
});
