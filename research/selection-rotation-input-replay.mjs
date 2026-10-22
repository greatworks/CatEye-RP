// Retained CIL interpretation only. No target assembly or product code is loaded.
import fs from 'node:fs';
const old = fs.readFileSync('research/selection-input-grid-replay.mjs', 'utf8');
let bootstrap = old.slice(0, old.indexOf('const api=await import'));
const extension = String.raw`
const newFiles=['research/selection-rotation-input-initialization-cil.json','research/selection-rotation-input-down-setter-cil.json','research/selection-input-grid-coordinate-cil.json','research/selection-pointer-modifiers-entry-cil.json','research/selection-pointer-modifiers-key-tests-cil.json'];
for(const file of newFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [token,n]of [[100682795,2],[100682801,1],[100682802,2],[100686238,2],[100686243,4],[100686233,1],[100686234,2],[100686235,1],[100686227,1],[100686246,5],[100691307,2],[100691309,1],[100691310,1],[100691311,1],[100691312,1],[100686269,2]])cil(token,n);
cil(100691324,1);cil(100691331,1);
const inputEvent=(name,data={})=>context.events.push({name,...data});
bind(100710378,1,()=>context.input.keys??131072);
bind(100686219,2,([c])=>c.targets);
bind(100686218,1,([c])=>c.targets);
bind(100686082,1,([c])=>c.editor);
bind(100686240,1,([c])=>c.members);
bind(100686241,1,([c])=>c.snapshots);
bind(100686242,1,([c])=>{c.members=[];c.snapshots=[];inputEvent('gbN2.reset');return VOID;});
bind(100686186,1,()=>false); // ordinary selection, no active special selection owner
bind(100686216,2,([c,v])=>{inputEvent('cbNl',{value:v});return VOID;});
bind(100686207,1,([w])=>({owner:w})); // snapshot constructor service, downstream geometry excluded
bind(721422064,2,([a])=>a.map(owner=>({owner})));
bind(721422060,2,([a])=>a.map(n=>n.owner));
bind(721422065,2,([a,d])=>{for(const item of a)execute(d.token,[d.object,item]);return VOID;});
bind(167785185,2,([object,token])=>({object,token}));
bind(167785183,2,([a,v])=>{a.push(v);return VOID;});
bind(167774362,2,([a,v])=>{a.push(v);return VOID;});
bind(167774268,2,([a,b])=>{a.push(...b);return VOID;});
bind(100686239,2,([c,a])=>a.map(n=>n.owner)); // no nested layers in this ordinary-selection contract
bind(100695934,1,([a])=>{inputEvent('SJYh.union',{ids:a.map(w=>w.id)});const x=Math.min(...a.map(w=>w.rect.x)),y=Math.min(...a.map(w=>w.rect.y));return rect(x,y,Math.max(...a.map(w=>w.rect.x+w.rect.width))-x,Math.max(...a.map(w=>w.rect.y+w.rect.height))-y);}); // original union getter is an explicit bound service
bind(100695937,1,([a])=>{inputEvent('KJYm.snapshot',{ids:a.map(w=>w.id)});return {ids:a.map(w=>w.id)};});
bind(100695975,1,([a])=>a);
bind(721421700,1,([a])=>a.slice());
bind(100682391,2,([e,v])=>{inputEvent('YFfM',{value:v});return VOID;});
bind(100696864,0,()=>({transaction:true}));
bind(100682625,2,([e,v])=>{e.tx=v;return VOID;});
bind(100682624,1,([e])=>e.tx);
bind(100696819,1,()=>({dispose:true}));
bind(100696830,2,()=>VOID);
bind(100682238,1,()=>({page:true}));
bind(100686245,1,()=>{throw Error('dbNa resize-only initialization unexpectedly entered');});
bind(100686183,2,()=>3);bind(100686225,2,()=>true);
// kF4c ordinary active-handle hit-test and virtual override dispatch.
bind(100682411,2,([e])=>e.controller);
bind(100682478,1,()=>false);bind(100686089,1,()=>false);
bind(100682792,2,([e,c])=>{e.controller=c;return VOID;});
bind(100708590,1,()=>1048576);bind(100708294,1,()=>true);
bind(100686090,1,args=>execute(100686266,args));
bind(100686124,2,args=>execute(100686238,args));
// Actual obNM gate is constant true for both modes. Final controller effects are a recording sink.
bind(100686096,1,args=>execute(100686227,args));
bind(100686116,5,args=>execute(100686246,args));
bind(100686248,8,([c,dx,dy,p,flag,shift,orientation,tail])=>{
 context.dispatched={delta:{x:dx,y:dy},rawPoint:{x:p.x,y:p.y},flag:!!flag,shift:!!shift,orientation,tail:!!tail,mode:c[67119116]};return VOID;
});
const fieldWrite=fieldSet;
fieldSet=(o,k,v)=>{if([67117547,67119115,67119117,67119118,67119119].includes(k))inputEvent('field.write',{field:k,value:copy(v)});fieldWrite(o,k,v);};
export function beginRotation(input){
 const e=setup(input);context.events=[];
 const c=e.controller;c.editor=e;c.targets=(input.targets??[{id:'a',rect:input.rect},{id:'b',rect:input.rect}]).map(w=>({...w,kind:'SelectionButton'}));c.members=[];c.snapshots=[];c[67119110]={};
 execute(100686265,[c,rect(input.rect.x,input.rect.y,input.rect.width,input.rect.height),7]);
 execute(100682802,[e,point(input.down.x,input.down.y)]);
 const accepted=execute(100682795,[e,{}]);
 return {accepted:!!accepted,mode:execute(100686233,[c]),logicalStart:e[67117547],down:c[67119115],initialBounds:c[67119117],members:c.members.map(w=>w.id),snapshotIds:c.snapshots.map(n=>n.owner.id),events:context.events,trace:context.trace};
}
export function rotationInput(input){
 const e=setup(input);context.events=[];const c=e.controller;c.editor=e;c[67119116]=2;
 e[67117539]=true;e[67117567]=point(input.point.x,input.point.y);e[67117547]=point(input.start.x,input.start.y);
 let candidateRect=null,correctionPoint=point(0,0);
 const oldCandidate=callSpecs.get(100682729),oldCorrection=callSpecs.get(100682731);
 bind(100682729,2,args=>{candidateRect=execute(100682729,args);return candidateRect;});
 bind(100682731,6,args=>{correctionPoint=execute(100682731,args);return correctionPoint;});
 try{execute(100682868,[e,{}, {zoom:input.zoom??1}]);}finally{callSpecs.set(100682729,oldCandidate);callSpecs.set(100682731,oldCorrection);}
 return {candidate:candidateRect,correction:{x:correctionPoint.x,y:correctionPoint.y},...context.dispatched,liveReads:context.liveReads,events:context.events,trace:context.trace};
}
export const rotationFiles=[...files,...newFiles];
`;
bootstrap += '\nsource=source.replace("else if(op===\'ldnull\')", "else if(op===\'ldftn\'){stack.push(v);} else if(op===\'ldnull\')")' +
 '\n.replace("t===33557056 ?", "t===33556128 ? v.kind===\'ResizeController\' : t===33557056 ?")' +
 '\n.replace("else if(v===67134719)", "else if(v===67119127||v===67119128)stack.push({cachedDelegate:v}); else if(v===67134719)");\n';
bootstrap += `source+=${JSON.stringify(extension)};\nconst api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));export const {beginRotation,rotationInput,rotationFiles}=api;`;
const api=await import('data:text/javascript;base64,'+Buffer.from(bootstrap).toString('base64'));
export const {beginRotation,rotationInput,rotationFiles}=api;
