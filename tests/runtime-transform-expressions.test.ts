import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { evaluateExpression } from '../src/runtime/expressions';

const providers: Record<string, string | number | boolean | undefined> = { Count: '3', Code: '0012', Empty: '', FalseText: 'FALSE', 'track.width': 200, 'Window.width': 1280, 'This.x': 10, 'Target.x': 30, Missing: undefined };
for (const portable of [false, true]) {
  const evaluate: typeof evaluateExpression = portable ? runInNewContext(`(${evaluateExpression.toString()})`) : evaluateExpression;
  const motion = (expression: string) => evaluate(expression, name => providers[name], 'motion');
  describe(`${portable ? 'serialized' : 'module'} native motion expression semantics`, () => {
    // Original StringLiteral -> STO -> Move evidence: the final result is text,
    // while numeric/boolean provider identities remain available internally.
    it.each([
      ['0', '0'], ['"0"', '0'], ['false', 'false'], ['Code', '0012'], ['Missing', 'undefined'],
      ['"1" + "2"', '3'], ['"" + 2', '2'], ['"x" + 2', 'x2'], ['Count + 1', '4'],
      ['"10" < "2"', 'false'], ['"FALSE" && 8', 'false'], ['"TrUe" || 8', 'true'],
      ['"false" == false', 'true'], ['"TRUE" == true', 'true'], ['"0" == 0', 'true'],
      ['track.width + Window.width', '1480'], ['This.x - (This.x - Target.x)', '30'],
      ['0 / 0', 'NaN'], ['1 / 0', 'Infinity'], ['"no" - 2', 'NaN'], ['"" * 2', '0'],
      ['(100 / 3).toFixed(0)', '33'], ['(100 / 3).toFixed(2)', '33.33'], ['track.width.toFixed(1)', '200.0'], ['(12.25).toFixed()', '12'],
    ])('%s produces %s', (input, expected) => expect(motion(input)).toBe(expected));
    it('evaluates both STO logical operands, with observable read order', () => {
      const read = vi.fn((name: string) => { if (name === 'Explode') throw Error('provider failure'); return ''; });
      expect(() => evaluate('false && Explode', read, 'motion')).toThrow('provider failure'); expect(read).toHaveBeenCalledExactlyOnceWith('Explode');
      read.mockClear(); expect(() => evaluate('true || Explode', read, 'motion')).toThrow('provider failure'); expect(read).toHaveBeenCalledExactlyOnceWith('Explode');
    });
    it('distinguishes eager operand reads from short-circuit boolean coercion', () => {
      const read = vi.fn(() => undefined);
      expect(evaluate('false && Missing', read, 'motion')).toBe('false');
      expect(evaluate('true || Missing', read, 'motion')).toBe('true'); expect(read).toHaveBeenCalledTimes(2);
      for (const input of ['Missing || 10', '!Missing', 'Missing == 0', 'true && Missing']) {
        let failure: unknown; try { evaluate(input, read, 'motion'); } catch (error) { failure = error; }
        expect(failure).toMatchObject({ name: 'MotionEvaluationError' });
      }
      let unsafe: unknown; try { evaluate('process.exit()', read, 'motion'); } catch (error) { unsafe = error; }
      expect(unsafe).toMatchObject({ name: 'ExpressionError' });
    });
    it('accepts declared primitive providers only in motion mode', () => {
      expect(evaluate('Count + 1', () => 2, 'motion')).toBe('3'); expect(evaluate('FalseText', () => false, 'motion')).toBe('false');
      expect(() => evaluate('Count', () => 2)).toThrow('string or undefined');
      expect(() => evaluate('Count', () => 2, 'errorState')).toThrow('string or undefined');
      expect(() => evaluate('Count', () => ({ valueOf: () => 2 }) as never, 'motion')).toThrow('string or undefined');
    });
    it('keeps old text/error semantics and old rejection of motion-only paths/methods', () => {
      expect(evaluate('"1" + "2"', () => '')).toBe('12'); expect(evaluate('"10" < "2"', () => '')).toBe('true');
      expect(evaluate('false && Unknown', () => { throw Error('not evaluated'); })).toBe('false');
      expect(evaluate('0', () => '', 'errorState')).toBe('false'); expect(evaluate('"0"', () => '', 'errorState')).toBe('true');
      expect(() => evaluate('track.width', () => '1')).toThrow('unsupported variable path');
      expect(() => evaluate('(1).toFixed(0)', () => '')).toThrow(); expect(() => evaluate('1 / 0', () => '')).toThrow('division');
    });
    it('bounds numeric formatting and never dispatches arbitrary object methods', () => {
      expect(() => motion('Code.toFixed(0)')).toThrow('numeric receiver');
      expect(() => motion('(1).toFixed(101)')).toThrow('precision');
      expect(() => motion('(1).toFixed(-1)')).toThrow('precision');
      expect(() => motion('(1).constructor("evil")')).toThrow(); expect(() => motion('(1).toString()')).toThrow();
      const read = vi.fn(() => 'unexpected'); for (const input of ['track.constructor', 'Widget.constructor.text', 'globalThis.process', 'window.location', 'process.exit()', 'value("__proto__")']) expect(() => evaluate(input, read, 'motion')).toThrow(); expect(read).not.toHaveBeenCalled();
    });
    it('retains bounded input, output and parsing work in motion mode', () => {
      expect(() => motion('1'.repeat(4097))).toThrow('4096');
      expect(() => evaluate('TooBig', () => 'x'.repeat(100001), 'motion')).toThrow('100000');
      expect(() => motion('('.repeat(40) + '1' + ')'.repeat(40))).toThrow('nesting');
    });
  });
}
