import type { Locator, Page } from '@playwright/test';
export const ROW_BOX: { width:number; height:number; gapX:number; gapY:number; padding:number[]; borders:number[]; wrap:number; growWidth:number; growHeight:number; trimWidth:number; trimHeight:number };
export function exerciseRepeaterRows(scope: Locator | Page): Promise<void>;
