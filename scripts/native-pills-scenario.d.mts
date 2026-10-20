import type {Locator,Page} from '@playwright/test';
export function checkNativePillsPlayer(scope:Locator,page:Page,options?:{capture?:()=>Promise<unknown>;samplePixel?:(widget:Locator,x:number,y:number)=>Promise<number[]>}):Promise<{originalCapsules:number;resize:boolean;independentActions:boolean;stateComposition:boolean;pixelChecks:number}>;
