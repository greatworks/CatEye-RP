// Explicitly SYNTHETIC decoded records for strict P71/P81 tests; never native write-back.
import {recoverStyle,recoverSelection,recoverInteractionStyles,recoverLocalAdaptiveStyles} from './scripts/read-rp-semantics.mjs';
export const map=o=>({$map:Object.entries(o)}),prop=(key,value,flags=0xc0000000)=>map({DOAName:key|flags,Value:value});
export function cornerFixture(){
 const zero='0'.repeat(32),def='a'.repeat(32),base='b'.repeat(32),guid=v=>({$guid:v});
 const local=[prop(0,guid(base))],defaults=[prop(71,8),prop(81,15)],ix=map({}),targets=new Map();local.push(prop(21,ix));
 const widget={id:'e'.repeat(32),type:'Axure:DiagramObject:VectorShape',properties:map({Selected:false,SelectedStyleGroup:'',Disabled:false,Error:false,AdaptiveStyles:[]})};
 const style={id:'c'.repeat(32),type:'Axure:Style',properties:map({MatchInfo:map({Id:guid(base),LibraryId:guid(zero)}),PropList:local})};
 const cache=(id,Props)=>map({Info:map({Id:guid(id),LibraryId:guid(zero)}),Props});
 const root={properties:map({StyleCache:map({Styles:[cache(def,defaults),cache(base,[])]})})};
 const candidate={type:'box',sourceShape:0,cornerRadii:[3,3,0,0],vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]},evidence:'SYNTHETIC existing rectangular snapshot'};
 const addStyle=properties=>{const id=(targets.size+1).toString(16).padStart(32,'d');targets.set(id,{id,type:'Axure:Style',properties:map({All:false,PropList:properties})});return {$reference:id,referenceTag:3};};
 const state=(name,properties)=>ix.$map.push([name,addStyle(properties)]);
 const adaptive=properties=>widget.properties.$map.find(([k])=>k==='AdaptiveStyles')[1].push(guid('f'.repeat(32)),addStyle(properties));
 const args=()=>[widget,style,root,def,ref=>targets.get(ref?.$reference),candidate];
 return {widget,style,root,candidate,defaults,local,state,adaptive,args,base:()=>recoverStyle(...args(),undefined,null,undefined,[11,0,0,0]),selected:()=>recoverSelection(...args(),[11,0,0,0]),states:()=>recoverInteractionStyles(...args(),[11,0,0,0]),views:()=>recoverLocalAdaptiveStyles(...args(),[11,0,0,0])};
}
