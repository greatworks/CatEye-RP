import { parseWidgetStylePatch } from './document';
import type { Widget, WidgetStyle } from './types';

type Data = Record<string, unknown>;
const fail = (): never => { throw new Error('选择控件布局数据、尺寸来源或共享字段未可靠恢复。'); };
function dataRecord(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Data;
}
function object(value: unknown, keys: readonly string[]): Data {
  const result = dataRecord(value);
  if (Object.keys(result).some(key => !keys.includes(key))) return fail();
  return result;
}
function guid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) return fail();
  return value;
}
function size(value: unknown): number {
  // The editor's finite storage limit, not a claim about native UI validation.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) return fail();
  return value;
}

/** Native P94 belongs to checkbox/radio even though the independent project
 * style/action schema is generic. Preserve that source type boundary here. */
export function parseNativeSelectionStylePatch(value: unknown, type: Widget['type']): Partial<WidgetStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const input = value as Data;
  if (Object.hasOwn(input,'selectionButtonSize') && type !== 'checkbox' && type !== 'radio') return fail();
  return parseWidgetStylePatch(input);
}

/** Retain the supplied shared fields and identified normal-style P94 without
 * measuring text or changing the original stored rectangle. Old recovery
 * protocols without this new record retain their previous representation. */
export function importSelectionLayout(
  value: unknown, type: Widget['type'], sourceId: string, styleId: unknown, flags: Data, normalRecovery: unknown,
): { selectionText: NonNullable<Widget['selectionText']>; selectionButtonSize: number } | undefined {
  if (value === undefined) return undefined;
  if (type !== 'checkbox' && type !== 'radio') return fail();
  const record = object(value, ['schema','status','sourceId','styleId','packageVersion','sharedFields','cacheChainComplete','buttonSize','inactive']);
  if (record.schema !== 1 || record.status !== 'supported-selection-layout' || guid(record.sourceId) !== sourceId
    || guid(record.styleId) !== styleId || record.cacheChainComplete !== true
    || JSON.stringify(record.packageVersion) !== '[11,0,0,0]') return fail();
  const shared = object(record.sharedFields, ['AutoFitWidth','AutoFitHeight','align-selection-button-right']);
  const autoFitWidth = shared.AutoFitWidth, autoFitHeight = shared.AutoFitHeight;
  const alignRight = shared['align-selection-button-right'];
  if (typeof autoFitWidth !== 'boolean' || typeof autoFitHeight !== 'boolean'
    || autoFitWidth !== flags.AutoFitWidth || autoFitHeight !== flags.AutoFitHeight
    || alignRight !== 'False' && alignRight !== 'True') return fail();
  const indicator = object(record.buttonSize, ['key','value','rawDoaName','source']);
  if (indicator.key !== 94 || indicator.rawDoaName !== (94 | 0xc0000000)) return fail();
  const selectionButtonSize = size(indicator.value);
  const origin = object(indicator.source, ['kind','objectId','styleId','libraryId']);
  if (origin.kind === 'local-object-style') {
    object(origin, ['kind','objectId']);
    if (guid(origin.objectId) !== styleId || record.inactive !== undefined) return fail();
  } else if (origin.kind === 'cached-document-default' || origin.kind === 'cached-matched-base') {
    object(origin, ['kind','styleId','libraryId']); guid(origin.styleId); guid(origin.libraryId);
  } else return fail();
  // Two projections of the same native P94 must agree on value and identity.
  // A syntactically valid but unrelated cache GUID is not source evidence.
  const normal = dataRecord(normalRecovery);
  const normalOrigin = object(dataRecord(normal.provenance).selectionButtonSize, [...Object.keys(origin),'property']);
  if (dataRecord(normal.style).selectionButtonSize !== selectionButtonSize
    || normalOrigin.property !== 'SELECTION_BUTTON_SIZE'
    || Object.keys(origin).some(key => normalOrigin[key] !== origin[key])) {
    throw new Error('选择控件布局尺寸与普通样式来源不一致。');
  }
  if (record.inactive !== undefined) {
    const inactive = object(record.inactive, ['rawDoaName','value']), raw = inactive.rawDoaName;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < -2147483648 || raw > 2147483647
      || (raw & 0x3fffffff) !== 94 || (raw & 0x40000000) !== 0) return fail();
    size(inactive.value);
  }
  return { selectionText: { autoFitWidth, autoFitHeight, alignRight: alignRight === 'True' }, selectionButtonSize };
}
