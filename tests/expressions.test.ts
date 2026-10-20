import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { evaluateExpression } from '../src/runtime/expressions';

const values: Record<string, string> = { Count: '3', Price: '12.5', Name: 'Alex', Code: '0012', Enabled: 'false', Blank: '', Nested: '[[Count + 1]]', 中文: '你好', 'Item.Name': 'First row', 'Item.Price': '4', 'First Name': 'Robin' };
const read = (name: string) => Object.hasOwn(values, name) ? values[name] : '';
const evaluate = (expression: string) => evaluateExpression(expression, read);

describe('expression arithmetic, logic and literals', () => {
  it('applies arithmetic precedence, parentheses, exponent associativity and unary signs', () => {
    expect(evaluate('1 + 2 * 3')).toBe('7'); expect(evaluate('(1 + 2) * 3')).toBe('9');
    expect(evaluate('Count + 1')).toBe('4'); expect(evaluate('Price * 2 - 5')).toBe('20');
    expect(evaluate('17 % 5')).toBe('2'); expect(evaluate('2 ** 3 ** 2')).toBe('512');
    expect(evaluate('-2 ** 2')).toBe('-4'); expect(evaluate('2 ** -2')).toBe('0.25');
    expect(evaluate('-.5 + +1.5e2')).toBe('149.5');
  });

  it('supports numeric/string comparison, strict and coercing equality, and logical operators', () => {
    expect(evaluate('Count > 2 && Count <= 3')).toBe('true');
    expect(evaluate('Count == "3"')).toBe('true'); expect(evaluate('Count === "3"')).toBe('false');
    expect(evaluate('Count != 4 && Count !== "3"')).toBe('true');
    expect(evaluate('"apple" < "banana"')).toBe('true'); expect(evaluate('!Enabled && !Blank')).toBe('true');
    expect(evaluate('false || "fallback"')).toBe('fallback'); expect(evaluate('0 && "unreachable"')).toBe('0');
  });

  it('supports string literals, Unicode and escapes without interpreting their contents as code', () => {
    expect(evaluate('"hello " + Name')).toBe('hello Alex');
    expect(evaluate('"1" + "2"')).toBe('12');
    expect(evaluate("'line\\n\\t\\u4f60\\u597d'")).toBe('line\n\t你好');
    expect(evaluate('"\\x41\\\\\\\""')).toBe('A\\"');
    expect(evaluate('中文 + "，世界"')).toBe('你好，世界');
    expect(evaluate('"<script>window.evil()</script>"')).toBe('<script>window.evil()</script>');
  });

  it('short-circuits only evaluation, not syntax validation, including lazy if branches', () => {
    const lookup = vi.fn(read);
    expect(evaluateExpression('true || Unknown', lookup)).toBe('true'); expect(lookup).not.toHaveBeenCalled();
    expect(evaluate('false && (1 / 0)')).toBe('false'); expect(evaluate('if(Count > 2, "yes", 1 / 0)')).toBe('yes');
    expect(evaluate('if(false, Unknown, "no")')).toBe('no');
    expect(() => evaluate('true || unknownFunction()')).toThrow('unknown function');
    expect(() => evaluate('if(true, "ok", window.alert(1))')).toThrow('unknown function');
  });
});

describe('variable lookup compatibility', () => {
  it('preserves pure variable values including leading zeroes, whitespace and nested interpolation markers', () => {
    expect(evaluate('Code')).toBe('0012'); expect(evaluate('Nested')).toBe('[[Count + 1]]');
    expect(evaluate('Unknown')).toBe(''); expect(evaluate(' Name ')).toBe('Alex'); expect(evaluate('')).toBe('');
    expect(evaluateExpression('Name', () => '  Alex  ')).toBe('  Alex  ');
  });

  it('treats Item fields and UUID Widget text paths as opaque names supplied to read', () => {
    const path = 'Widget.123e4567-e89b-12d3-a456-426614174000.text', lookup = vi.fn((name: string) => name === path ? '8' : read(name));
    expect(evaluateExpression(path, lookup)).toBe('8'); expect(evaluateExpression(`${path} * 2 + Item.Price`, lookup)).toBe('20');
    expect(lookup).toHaveBeenCalledWith(path); expect(evaluate('Item.Name')).toBe('First row');
    expect(evaluate('value("First Name")')).toBe('Robin'); expect(evaluate('value("Missing Name")')).toBe('');
    expect(evaluate('number(value("Code")) + 1')).toBe('13');
  });

  it('rejects forbidden name segments before calling read and never visits globals', () => {
    const lookup = vi.fn(() => 'unexpected');
    for (const expression of ['constructor', 'prototype', '__proto__', 'window', 'globalThis', 'document', 'process', 'Item.constructor', 'Widget.constructor.text', 'value("Item.__proto__")', 'value("window.location")', `value("globalThis['process']")`, `value("x['constructor']")`]) {
      expect(() => evaluateExpression(expression, lookup)).toThrow('forbidden');
    }
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('whitelisted string and math functions', () => {
  it('applies bounded string operations with literal replacement semantics', () => {
    expect(evaluate('len("abc")')).toBe('3'); expect(evaluate('upper(Name)')).toBe('ALEX'); expect(evaluate('lower("ABC")')).toBe('abc');
    expect(evaluate('trim("  x  ")')).toBe('x'); expect(evaluate('contains(Name, "le")')).toBe('true');
    expect(evaluate('startsWith(Name, "Al") && endsWith(Name, "ex")')).toBe('true');
    expect(evaluate('concat("Hi ", Name, " #", Count)')).toBe('Hi Alex #3');
    expect(evaluate('substring("abcdef", 1, 4)')).toBe('bcd'); expect(evaluate('substring("abcdef", 3)')).toBe('def');
    expect(evaluate('replace("ab ab", "ab", "$&")')).toBe('$& ab');
    expect(evaluate('replace("ab", "missing", "x")')).toBe('ab');
    expect(evaluate('string(Count) + " items"')).toBe('3 items');
  });

  it('supports a finite whitelist of math functions and explicit Math aliases', () => {
    expect(evaluate('abs(-3)')).toBe('3'); expect(evaluate('Math.abs(-3)')).toBe('3');
    expect(evaluate('round(3.14159, 2)')).toBe('3.14'); expect(evaluate('round(149, -1)')).toBe('150');
    expect(evaluate('floor(2.9) + ceil(2.1)')).toBe('5'); expect(evaluate('Math.floor(2.9)')).toBe('2');
    expect(evaluate('min(8, 3, -2)')).toBe('-2'); expect(evaluate('max(8, 3, -2)')).toBe('8');
    expect(evaluate('sqrt(16) + pow(2, 3)')).toBe('12'); expect(evaluate('Math.pow(2, 4)')).toBe('16');
    expect(evaluate('number("12.5") + 1')).toBe('13.5');
  });

  it('rejects unknown functions, invalid arity, invalid numeric input and nonfinite math', () => {
    for (const expression of ['unknown(1)', 'Math.random()', 'Name.toUpperCase()', 'constructor()']) expect(() => evaluate(expression)).toThrow('unknown function');
    for (const expression of ['len()', 'pow(2)', 'min()', 'if(true, 1)', 'substring("abc")']) expect(() => evaluate(expression)).toThrow('argument');
    for (const expression of ['1 / 0', '1 % 0', 'sqrt(-1)', 'pow(10, 400)', '1e400', 'number("no")', 'number("")', 'round(1, 13)', 'round(1, 1.5)']) expect(() => evaluate(expression)).toThrow(/Expression error/);
  });
});

describe('expression grammar and resource safety', () => {
  it('rejects property access, calls on values, indexing, assignments, statements and malformed syntax', () => {
    for (const expression of ['Name.length', 'Item.Name.length', '"x".constructor', 'Name[0]', 'Count = 4', '1; 2', '(() => 1)()', 'new Date()', '1 +', '(1 + 2', '1 2', 'concat("x",)', '`template`', '"unterminated', '"\\q"', '"\\uZZZZ"']) {
      expect(() => evaluate(expression), expression).toThrow(/Expression error/);
    }
  });

  it('enforces input, token, parse-depth, evaluation-depth, output and cumulative work budgets', () => {
    expect(() => evaluate(' '.repeat(4097))).toThrow('4096');
    expect(() => evaluate('1+'.repeat(600) + '1')).toThrow('1024');
    expect(() => evaluate('('.repeat(40) + '1' + ')'.repeat(40))).toThrow('32');
    expect(() => evaluate(Array.from({ length: 40 }, () => '1').join('+'))).toThrow('depth');
    expect(() => evaluateExpression('Huge', () => 'x'.repeat(100_001))).toThrow('100000');
    expect(() => evaluateExpression('concat(Large,Large)', () => 'x'.repeat(60_000))).toThrow('100000');
    expect(() => evaluateExpression(`concat(${Array.from({ length: 12 }, () => 'len(Large)').join(',')})`, () => 'x'.repeat(100_000))).toThrow('budget');
    expect(() => evaluateExpression('Name', (() => 5) as unknown as (name: string) => string)).toThrow('must resolve to a string');
  });

  it('runs from its serialized function in an isolated context without module-level dependencies', () => {
    const serialized = evaluateExpression.toString();
    const result = runInNewContext(`(${serialized})(expression, read)`, { expression: 'if(Count > 2, upper(Name), "no")', read }, { timeout: 1000 });
    expect(result).toBe('ALEX');
    expect(serialized).not.toMatch(/\beval\s*\(|\bnew\s+Function\s*\(/);
    expect(() => runInNewContext(`(${serialized})(expression, read)`, { expression: 'globalThis.process', read }, { timeout: 1000 })).toThrow(/Expression error/);
  });
});

const serializedEvaluate: typeof evaluateExpression = (expression, read) => runInNewContext(
  `(${evaluateExpression.toString()})(expression, read)`, { expression, read }, { timeout: 1000 },
) as string;

describe.each([
  { implementation: 'module', evaluate: evaluateExpression },
  { implementation: 'serialized', evaluate: serializedEvaluate },
])('$implementation provider-supplied missing values', ({ evaluate }) => {
  const stored: Record<string, string> = { 'Item.Empty': '', 'Item.Text': 'hello', 'Item.Nested': '[[Item.Missing]]', 'Item.Padded': ' 0012 ' };
  const lookup = (name: string): string | undefined => Object.hasOwn(stored, name) ? stored[name] : undefined;

  it('distinguishes missing properties from empty strings and does not introduce an undefined literal', () => {
    expect(evaluate('Item.Missing', lookup)).toBe('undefined'); expect(evaluate('Item.Empty', lookup)).toBe('');
    expect(evaluate('Item.Nested', lookup)).toBe('[[Item.Missing]]'); expect(evaluate('Item.Padded', lookup)).toBe(' 0012 ');
    expect(evaluate('value("Item.Missing")', lookup)).toBe('undefined');
    const provider = vi.fn(() => 'provided');
    expect(evaluate('undefined', provider)).toBe('provided'); expect(provider).toHaveBeenCalledExactlyOnceWith('undefined');
  });

  it('uses false missing-value truthiness with lazy logical and conditional branches', () => {
    expect(evaluate('!Item.Missing', lookup)).toBe('true'); expect(evaluate('!!Item.Missing', lookup)).toBe('false');
    expect(evaluate('Item.Missing || "fallback"', lookup)).toBe('fallback'); expect(evaluate('Item.Missing || Item.Text', lookup)).toBe('hello');
    expect(evaluate('if(Item.Missing, 1 / 0, "absent")', lookup)).toBe('absent');
    expect(evaluate('if(!Item.Missing, "absent", 1 / 0)', lookup)).toBe('absent');
    const provider = vi.fn(lookup);
    expect(evaluate('Item.Missing && Unreachable', provider)).toBe('undefined'); expect(provider).toHaveBeenCalledExactlyOnceWith('Item.Missing');
    provider.mockClear(); expect(evaluate('true || Item.Missing', provider)).toBe('true'); expect(provider).not.toHaveBeenCalled();
  });

  it('compares missing values only equal to other missing values, symmetrically for both equality modes', () => {
    for (const operator of ['==', '===']) {
      expect(evaluate(`Item.Missing ${operator} Item.OtherMissing`, lookup)).toBe('true');
      for (const other of ['Item.Empty', '""', '"undefined"', 'false', 'true', '0', '1', 'Item.Text']) {
        expect(evaluate(`Item.Missing ${operator} ${other}`, lookup), `${operator} ${other}`).toBe('false');
        expect(evaluate(`${other} ${operator} Item.Missing`, lookup), `${other} ${operator}`).toBe('false');
      }
    }
    for (const operator of ['!=', '!==']) {
      expect(evaluate(`Item.Missing ${operator} Item.OtherMissing`, lookup)).toBe('false');
      expect(evaluate(`Item.Missing ${operator} Item.Empty`, lookup)).toBe('true');
    }
  });

  it('converts missing values to explicit text in string operations', () => {
    expect(evaluate('string(Item.Missing)', lookup)).toBe('undefined');
    expect(evaluate('concat("[", Item.Missing, "]", Item.Empty)', lookup)).toBe('[undefined]');
    expect(evaluate('"missing: " + Item.Missing', lookup)).toBe('missing: undefined');
    expect(evaluate('Item.Missing + ":missing"', lookup)).toBe('undefined:missing');
    expect(evaluate('len(Item.Missing)', lookup)).toBe('9'); expect(evaluate('upper(Item.Missing)', lookup)).toBe('UNDEFINED');
    expect(evaluate('contains(Item.Missing, "defined")', lookup)).toBe('true');
  });

  it('rejects missing numeric operands through controlled errors instead of nonfinite results', () => {
    for (const expression of ['number(Item.Missing)', '+Item.Missing', '-Item.Missing', 'Item.Missing + 1', '1 - Item.Missing', 'Item.Missing * 2', 'Item.Missing / 2', '2 % Item.Missing', '2 ** Item.Missing', 'abs(Item.Missing)', 'Math.floor(Item.Missing)', 'ceil(Item.Missing)', 'sqrt(Item.Missing)', 'pow(2, Item.Missing)', 'min(1, Item.Missing)', 'max(Item.Missing, 1)', 'round(Item.Missing)', 'round(1, Item.Missing)', 'substring("abc", Item.Missing)']) {
      expect(() => evaluate(expression, lookup), expression).toThrow('Expression error: operation requires a numeric value');
    }
  });

  it('still rejects every provider value other than string or undefined', () => {
    for (const value of [null, 0, false, NaN, Infinity, {}, [], () => 'x', Symbol('x'), 1n]) {
      const provider = (() => value) as unknown as (name: string) => string | undefined;
      for (const expression of ['Item.Bad', 'string(Item.Bad)', 'value("Item.Bad")']) expect(() => evaluate(expression, provider)).toThrow('must resolve to a string');
    }
  });

  it('passes only the five whitelisted This.Repeater counters as opaque provider paths', () => {
    const provider = vi.fn(() => '3');
    for (const counter of ['dataCount', 'itemCount', 'visibleItemCount', 'pageCount', 'pageIndex']) {
      expect(evaluate(`This.Repeater.${counter}`, provider)).toBe('3'); expect(provider).toHaveBeenLastCalledWith(`This.Repeater.${counter}`);
      expect(evaluate(`This.Repeater.${counter} + 1`, provider)).toBe('4'); expect(evaluate(`This.${counter}`, provider)).toBe('3');
    }
    expect(evaluate('This.text', provider)).toBe('3');
    provider.mockClear();
    for (const expression of ['This.Repeater', 'This.Repeater.text', 'This.Repeater.pageIndex.extra', 'This.Repeater.constructor', 'This.Repeater.__proto__', 'This.Repeater["pageIndex"]', 'This.Repeater.pageIndex()']) expect(() => evaluate(expression, provider)).toThrow('Expression error');
    expect(provider).not.toHaveBeenCalled();
  });

  it('retains input, token, depth, output and work limits with missing-value conversion', () => {
    expect(() => evaluate(' '.repeat(4097), lookup)).toThrow('4096');
    expect(() => evaluate('1+'.repeat(600) + '1', lookup)).toThrow('1024');
    expect(() => evaluate('('.repeat(40) + 'Item.Missing' + ')'.repeat(40), lookup)).toThrow('32');
    const provider = (name: string) => name === 'Large' ? 'x'.repeat(100_000) : undefined;
    expect(() => evaluate('concat(Item.Missing, Large)', provider)).toThrow('100000');
    expect(() => evaluate(`concat(Item.Missing,${Array.from({ length: 12 }, () => 'len(Large)').join(',')})`, provider)).toThrow('budget');
  });
});

describe.each([
  { implementation: 'module', evaluate: evaluateExpression },
  { implementation: 'serialized', evaluate: serializedEvaluate },
])('$implementation geometry path whitelist', ({ evaluate }) => {
  const roots = ['This', 'Target', 'This.Repeater', 'Target.Repeater', 'Item.Repeater', 'TargetItem.Repeater'];
  const properties = ['x', 'y', 'width', 'height', 'left', 'right', 'top', 'bottom'];

  it('passes every supported geometry path to the provider without evaluating object members', () => {
    const provider = vi.fn(() => ' 0012.5 ');
    for (const root of roots) for (const property of properties) {
      const path = `${root}.${property}`;
      expect(evaluate(path, provider), path).toBe(' 0012.5 ');
      expect(provider).toHaveBeenLastCalledWith(path);
      expect(evaluate(`${path} + 2`, provider), path).toBe('14.5');
    }
  });

  it('keeps provider lookup fresh and preserves missing-value semantics', () => {
    let width = '30';
    const provider = vi.fn((path: string) => path === 'This.width' ? width : undefined);
    expect(evaluate('This.width + 1', provider)).toBe('31'); width = '45';
    expect(evaluate('This.width + 1', provider)).toBe('46');
    expect(evaluate('Target.x', provider)).toBe('undefined');
    expect(evaluate('if(Target.x, 1 / 0, "absent")', provider)).toBe('absent');
    expect(() => evaluate('number(Target.x)', provider)).toThrow('numeric value');
    expect(evaluate('This.width', () => '[[Target.x]]')).toBe('[[Target.x]]');
  });

  it('rejects unsupported geometry chains, property calls, casing and Widget geometry before lookup', () => {
    const provider = vi.fn(() => 'unexpected');
    for (const path of [
      'This.Width', 'Target.X', 'This.pagex', 'Target.Rotation', 'This.opacity', 'Target.text',
      'This.Repeater.text', 'Target.Repeater.itemCount', 'Item.Repeater.width.extra', 'This.Repeater.Repeater.width',
      'This.width()', 'This.width.toString()', 'Target["width"]', 'This.Repeater["x"]',
      'Widget.abc.width', 'Widget.123e4567-e89b-12d3-a456-426614174000.width',
    ]) expect(() => evaluate(path, provider), path).toThrow('Expression error');
    expect(provider).not.toHaveBeenCalled();
  });

  it('allows the native live rotation getter on This and Target without widening other property chains', () => {
    const provider = vi.fn((name: string) => name === 'This.rotation' ? '720' : name === 'Target.rotation' ? '0.5' : undefined);
    expect(evaluate('This.rotation - Target.rotation', provider)).toBe('719.5');
    expect(() => evaluate('This.Repeater.rotation', provider)).toThrow('Expression error');
    expect(() => evaluate('Target.rotation()', provider)).toThrow('Expression error');
  });

  it('keeps dangerous prototype and global paths blocked, including explicit value names', () => {
    const provider = vi.fn(() => 'unexpected');
    for (const root of roots) for (const field of ['constructor', '__proto__', 'prototype', 'window', 'globalThis']) {
      expect(() => evaluate(`${root}.${field}`, provider)).toThrow('forbidden');
      expect(() => evaluate(`value("${root}.${field}.width")`, provider)).toThrow('forbidden');
    }
    expect(provider).not.toHaveBeenCalled();
  });
});
