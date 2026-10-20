import { describe, expect, it } from 'vitest';
import { parseWidgetStylePatch } from '../src/model/document';

const style = (color: string) => ({ outerShadow: { on: true, offsetX: 4, offsetY: 5, blurRadius: 6, color } });
describe('shadow color grammar', () => {
  it('rejects invalid paint that a browser would ignore and leave stale shadows', () => {
    for (const color of ['notacolor', 'inherit', 'initial', 'unset', 'revert', 'none', '#12345', '#1234567', 'rgb(1)', 'rgb(1 2)', 'rgba(1,2,3,)', 'rgb(1, 20%, 3)', 'hsl(20, 30, 40)', 'rgba(1 2 3 /)', 'rgb(1 2 3 / 1 / 2)', 'rgb(1,2,3 / 0.5)', 'rgb(1 2 3);color:red', 'url(a)', 'var(--shadow)']) {
      expect(() => parseWidgetStylePatch(style(color)), color).toThrow('outerShadow.color');
    }
  });
  it('accepts safe hex, named, transparent and supported RGB/HSL forms without rewriting input', () => {
    for (const color of ['#abc', '#abcd', '#ABCDEF', '#12345678', 'red', 'rebeccapurple', 'LightGoldenRodYellow', 'transparent', 'currentColor', 'rgb(12,34,56)', 'rgba(12, 34, 56, .4)', 'rgb(10% 20% 30% / 50%)', 'hsl(-30, 20%, 40%)', 'hsla(90, 50%, 40%, 0.5)', 'hsl(90 50% 40% / .5)']) {
      expect(parseWidgetStylePatch(style(color))).toEqual(style(color));
    }
  });
});
