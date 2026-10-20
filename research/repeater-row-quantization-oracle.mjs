// Independent research model. DOM supplies CSS quantization; no DPR formula.
// This is test evidence only, not product code or a vendor implementation.
export function installRowOracle() {
 const px=value=>parseFloat(value),jq=element=>window.jQuery(element);
 let f,root,ids,groups,logical,geometry,moved,rootGeometry,events,rootWrites;
 const sum=(group,axis)=>group.reduce((total,id,index)=>total+(index?axis===0?f.gapX:f.gapY:0)+logical[id][axis],0);
 const max=(group,axis)=>Math.max(0,...group.map(id=>logical[id][axis]));
 const row=id=>document.getElementById('o-'+id);
 function box(element){const s=getComputedStyle(element),r=element.getBoundingClientRect();return {inline:[element.style.width,element.style.height],css:[s.width,s.height],inlineXY:[element.style.left,element.style.top],cssXY:[s.left,s.top],rect:[r.x,r.y,r.width,r.height]};}
 function snapshot(){return {root:box(root),logical:Object.fromEntries(ids.map(id=>[id,{itemId:id,width:logical[id][0],height:logical[id][1]}])),geometry:{r:rootGeometry,...Object.fromEntries(ids.map(id=>['r-'+id,geometry[id]]))},moved:Object.fromEntries(ids.map(id=>['r-'+id,moved[id]])),rows:ids.map(id=>({id,...box(row(id))})),events:[...events],rootWrites:[...rootWrites]};}
 function init(input){
  f=structuredClone(input);ids=f.ids;groups=[];for(let i=0;i<ids.length;i+=f.wrap===-1?ids.length:f.wrap)groups.push(ids.slice(i,i+(f.wrap===-1?ids.length:f.wrap)));
  document.getElementById('o')?.remove();root=document.createElement('div');root.id='o';
  Object.assign(root.style,{position:'absolute',left:'40px',top:'40px',visibility:'hidden',pointerEvents:'none',boxSizing:'border-box',borderStyle:'solid',borderWidth:f.border.map(v=>v+'px').join(' '),padding:'0',margin:'0'});document.body.append(root);
  const main=f.vertical?1:0,cross=1-main,padding=f.padding,b=getComputedStyle(root),origin=[padding[3]-px(b.borderLeftWidth),padding[0]-px(b.borderTopWidth)];
  const initial=[f.width,f.height],gaps=[f.gapX,f.gapY],extent=[0,0];
  extent[main]=initial[main]*groups[0].length+gaps[main]*(groups[0].length-1);extent[cross]=initial[cross]*groups.length+gaps[cross]*(groups.length-1);
  rootGeometry={width:extent[0]+padding[1]+padding[3],height:extent[1]+padding[0]+padding[2]};
  // Preserve the native initial arithmetic order for the raw envelope, where
  // rounding itself is under investigation (n*w+(n-1)*g need not be bit-identical).
  const primary=f.wrap===-1?ids.length:Math.min(ids.length,f.wrap),secondary=f.wrap===-1?1:Math.ceil(ids.length/f.wrap);
  rootGeometry.width=padding[1]+padding[3]+(f.width+((f.vertical?secondary:primary)-1)*(f.width+f.gapX));
  rootGeometry.height=padding[0]+padding[2]+(f.height+((f.vertical?primary:secondary)-1)*(f.height+f.gapY));
  logical={};geometry={};moved={};events=[];rootWrites=[];
  let left=origin[0],top=origin[1],index=0;
  for(const id of ids){const el=document.createElement('div');el.id='o-'+id;Object.assign(el.style,{position:'absolute',left:left+'px',top:top+'px',width:f.width+'px',height:f.height+'px'});root.append(el);
   logical[id]=[f.width,f.height];geometry[id]={width:f.width,height:f.height};moved[id]={x:left,y:top};
   index++;if(f.wrap!==-1&&index%f.wrap===0){if(f.vertical){top=origin[1];left+=f.width+f.gapX;}else{left=origin[0];top+=f.height+f.gapY;}}
   else if(f.vertical)top+=f.height+f.gapY;else left+=f.width+f.gapX;
  }
  jq(root).css(rootGeometry);return snapshot();
 }
 function resize(id,width,height){
  const wanted=[width,height],deltas=wanted.map((v,axis)=>v-logical[id][axis]);
  if(!deltas[0]&&!deltas[1])return {changed:false,snapshot:snapshot()};
  const main=f.vertical?1:0,groupIndex=groups.findIndex(group=>group.includes(id)),group=groups[groupIndex],index=group.indexOf(id);
  for(let axis=0;axis<2;axis++){
   const delta=deltas[axis];if(!delta)continue;const prop=axis?'height':'width',location=axis?'top':'left',el=row(id);
   jq(el).css(prop,px(jq(el).css(prop))+delta);geometry[id]={width:px(jq(el).css('width')),height:px(jq(el).css('height'))};
   // Predict root growth and sibling movement from group extents. This model
   // does not call/copy _pushItems. It retains nominal += delta and operation
   // order because exact repeated-request behavior is part of the question.
   let rootDelta,shift,affected;
   if(axis===main){
    const before=sum(group,axis),after=before+delta,other=Math.max(0,...groups.filter((_,i)=>i!==groupIndex).map(g=>sum(g,axis)));
    rootDelta=groups.length===1?delta:Math.max(after,other)-Math.max(before,other);shift=delta;affected=group.slice(index+1);
    logical[id][axis]+=delta;
   }else{
    const before=max(group,axis);logical[id][axis]+=delta;const after=max(group,axis);shift=after-before;
    rootDelta=f.wrap===-1&&ids.length===1?delta:shift;affected=groups.slice(groupIndex+1).flat();
   }
   if(rootDelta!==0){const cs=getComputedStyle(root),primary=f.vertical?px(cs.borderTopWidth)+px(cs.borderBottomWidth):px(cs.borderLeftWidth)+px(cs.borderRightWidth);
    const value=px(jq(root).css(prop))+rootDelta+primary;jq(root).css(prop,value);rootGeometry={width:px(jq(root).css('width')),height:px(jq(root).css('height'))};rootWrites.push({axis:prop,delta:rootDelta,value,geometry:{...rootGeometry}});
   }
   if(shift!==0)for(const sibling of affected){const element=row(sibling);jq(element).css(location,px(jq(element).css(location))+shift);moved[sibling]={x:px(jq(element).css('left')),y:px(jq(element).css('top'))};}
  }
  events.push({id,event:'onItemResize',geometry:{...geometry[id]},rootGeometry:{...rootGeometry}});return {changed:true,snapshot:snapshot()};
 }
 window.__rowOracle={init,resize,snapshot};
}
