import type { WidgetStyle } from './types';

type Data = Record<string, unknown>;
export const NATIVE_AUTHOR_PIN_KEYS = [106, 107, 108, 109] as const;
function fail(): never { throw new Error('原生作者缩放约束或来源未完整验证。'); }
function object(value: unknown, keys: string[]): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const data = value as Data;
  if (Object.keys(data).length !== keys.length || keys.some(key => !Object.hasOwn(data, key))) fail();
  return data;
}
function guid(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) fail(); return value; }
export function importNativeAuthorPin(key: number, value: unknown): Partial<WidgetStyle> {
  if (key === 106) {
    const map = new Map<number, NonNullable<WidgetStyle['pinHorizontal']>>([[0,'none'],[1,'left'],[4,'right'],[5,'both'],[256,'center']]);
    if (typeof value !== 'number' || !map.has(value)) fail();
    return { pinHorizontal: map.get(value)! };
  }
  if (key === 107) {
    const map = new Map<number, NonNullable<WidgetStyle['pinVertical']>>([[0,'none'],[2,'top'],[8,'bottom'],[10,'both'],[512,'center']]);
    if (typeof value !== 'number' || !map.has(value)) fail();
    return { pinVertical: map.get(value)! };
  }
  if (![108,109].includes(key) || typeof value !== 'boolean') fail();
  return key === 108 ? { fixedHeight: value } : { fixedWidth: value };
}

/** Revalidate the pin projection independently at the editable-project boundary.
 * Paint, selection and runtime SetStyle never supply these author constraints. */
export function importAuthorResizePins(value: unknown, sourceId: string, styleId: unknown): Partial<WidgetStyle> {
  if (value === undefined) return {};
  const data = value as Data;
  const r = object(value, ['schema','status','sourceId','styleId','packageVersion','cacheChainComplete','fields','inactive',...(data?.cacheChainComplete===false?['unlinkedStyle']:[])]);
  if (r.schema !== 1 || r.status !== 'supported-author-resize-pins' || r.sourceId !== sourceId || guid(r.styleId) !== styleId ||
      JSON.stringify(r.packageVersion) !== '[11,0,0,0]' || typeof r.cacheChainComplete !== 'boolean' || !Array.isArray(r.fields) || r.fields.length !== 4 ||
      !Array.isArray(r.inactive) || r.inactive.length > 4) fail();
  if (!r.cacheChainComplete) {
    const source=object(r.unlinkedStyle,['all','matchInfoAbsent','basePropertyAbsent']);
    if (source.all!==false || source.matchInfoAbsent!==true || source.basePropertyAbsent!==true) fail();
  }
  const result: Partial<WidgetStyle> = {}, inactive = new Set<number>();
  for (const item of r.inactive) {
    const p = object(item, ['key','rawDoaName','value']), key = Number(p.key), raw = p.rawDoaName;
    if (typeof p.key !== 'number' || !NATIVE_AUTHOR_PIN_KEYS.includes(key as 106) || inactive.has(key) || typeof raw !== 'number' || !Number.isInteger(raw) ||
        raw < -2147483648 || raw > 2147483647 || (raw & 0x3fffffff) !== key || (raw & 0x40000000) !== 0) fail();
    importNativeAuthorPin(key,p.value); inactive.add(key);
  }
  for (const [index,item] of r.fields.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail();
    const key = NATIVE_AUTHOR_PIN_KEYS[index], p = item as Data, source = p.source as Data;
    if (p.key !== key || !source || typeof source !== 'object') fail();
    const patch = importNativeAuthorPin(key,p.value);
    const isDefault = p.value === (key < 108 ? 0 : false);
    if (source.kind === 'native-default-table') {
      object(p,['key','value','source']);object(source,['kind','methodToken']);
      if (!isDefault || source.methodToken !== 100717199) fail();
    } else {
      object(p,['key','value','rawDoaName','source']);
      if (p.rawDoaName !== (key | 0xc0000000)) fail();
      if (source.kind === 'local-object-style') {
        object(source,['kind','objectId']);
        if (guid(source.objectId) !== r.styleId || inactive.has(key)) fail();
      } else if (source.kind === 'cached-document-default' || source.kind === 'cached-matched-base') {
        if (!r.cacheChainComplete) fail();
        object(source,['kind','styleId','libraryId']);guid(source.styleId);guid(source.libraryId);
      } else fail();
      // Keep explicit local None/false; inherited default values need no new
      // declaration in the independent Base document.
      if (source.kind === 'local-object-style' || !isDefault) Object.assign(result,patch);
    }
  }
  return result;
}
