import type { VectorCommand, VectorPath } from './types';

export const VECTOR_LIMITS = { commands: 4096, coordinate: 10000 } as const;

/** Strict, bounded data-only schema. SVG markup and arbitrary path strings are never accepted. */
export function parseVectorPath(value: unknown): VectorPath {
  const record = (value: unknown, allowed: string[], at: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${at}: expected a plain object`);
    const result = value as Record<string, unknown>;
    if (Object.keys(result).some(key => !allowed.includes(key))) throw new Error(`${at}: unknown property`);
    return result;
  };
  const path = record(value, ['fillRule', 'commands'], 'vectorPath');
  if (path.fillRule !== 'nonzero' && path.fillRule !== 'evenodd') throw new Error('vectorPath.fillRule: expected nonzero or evenodd');
  if (!Array.isArray(path.commands) || !path.commands.length || path.commands.length > VECTOR_LIMITS.commands) throw new Error('vectorPath.commands: expected 1..4096 commands');
  let open = false;
  const commands = path.commands.map((value, index): VectorCommand => {
    const at = `vectorPath.commands[${index}]`;
    const command = record(value, ['op', 'x', 'y', 'x1', 'y1', 'x2', 'y2'], at);
    const op = command.op;
    if (op !== 'M' && op !== 'L' && op !== 'C' && op !== 'Z') throw new Error(`${at}.op: expected M, L, C or Z`);
    const fields = op === 'Z' ? [] : op === 'C' ? ['x1', 'y1', 'x2', 'y2', 'x', 'y'] : ['x', 'y'];
    record(command, ['op', ...fields], at);
    if (op !== 'M' && !open) throw new Error(`${at}: a subpath must start with M`);
    open = op !== 'Z';
    const result: Record<string, string | number> = { op };
    for (const field of fields) {
      const number = command[field];
      if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > VECTOR_LIMITS.coordinate) throw new Error(`${at}.${field}: expected a finite coordinate between -10000 and 10000`);
      result[field] = number;
    }
    return result as VectorCommand;
  });
  return { fillRule: path.fillRule, commands };
}

/** Self-contained: injected into offline HTML via toString(), with no module dependencies. */
export function vectorPathData(path: VectorPath, width: number, height: number): string {
  if (![width, height].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Vector dimensions must be finite and nonnegative');
  const coordinate = (value: number, extent: number): string => {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('Invalid vector coordinate');
    return String(value * extent);
  };
  if (!Array.isArray(path.commands) || !path.commands.length || path.commands.length > 4096) throw new Error('Invalid vector command count');
  return path.commands.map(command => {
    if (command.op === 'Z') return 'Z';
    if (command.op === 'M' || command.op === 'L') return `${command.op} ${coordinate(command.x, width)} ${coordinate(command.y, height)}`;
    if (command.op === 'C') return `C ${coordinate(command.x1, width)} ${coordinate(command.y1, height)} ${coordinate(command.x2, width)} ${coordinate(command.y2, height)} ${coordinate(command.x, width)} ${coordinate(command.y, height)}`;
    throw new Error('Invalid vector command');
  }).join(' ');
}
