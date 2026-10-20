import type {Locator,Page} from '@playwright/test';
export function checkNativeCornersPlayer(scope:Locator,page:Page,options?:{capture?:()=>Promise<unknown>;samplePixel?:(widget:Locator,x:number,y:number)=>Promise<number[]>}):Promise<{maskCases:number;independentActions:boolean;stateComposition:boolean;rowIsolation:boolean;pixelChecks:number}>;
