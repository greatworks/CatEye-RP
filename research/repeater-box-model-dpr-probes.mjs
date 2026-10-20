import assert from 'node:assert/strict';

/** Additional research matrices, with host CSS measurements rather than DPR formulas. */
export async function runDprProbes({page,init,refresh,resize,dpr,scaleMode}) {
 const outcomes=[];
 const fixtures=[
  {name:'integer-asymmetric',border:[3,5,7,2],padding:[7,4,9,6]},
  {name:'fractional-asymmetric',border:[0.1,0.5,1.25,2.9],padding:[7,4,9,6]},
  {name:'thin-boundaries',border:[0,0.01,0.99,1.01],padding:[0,0,0,0]},
  {name:'subpixel-insets',border:[1.1,2.2,3.3,4.4],padding:[0.1,1.2,2.3,3.4]},
  {name:'fractional-none',border:[0.1,0.5,1.25,2.9],padding:[7,4,9,6],borderStyle:'none'},
 ];
 for(const fixture of fixtures)for(const vertical of [true,false]) {
  const f={...fixture,ids:[1],boxSizing:'border-box',vertical,width:100,height:20,gapX:8,gapY:4};
  const initial=await init(f),computedBorders=initial.root.border.map(parseFloat);
  const rawXY=[f.padding[3]-computedBorders[3],f.padding[0]-computedBorders[0]];
  // The native initializer writes these precise expressions; inline serialization
  // and used layout positions may be separately quantized by the host browser.
  const expectedInline=await page.evaluate(values=>{
   const e=document.createElement('div');e.style.left=values[0]+'px';e.style.top=values[1]+'px';return [e.style.left,e.style.top];
  },rawXY);
  assert.deepEqual(initial.rows[0].inlineXY,expectedInline,'native offset subtracts computed border '+fixture.name);
  const steps=[];
  for(const dimensions of [[130,35],[100,20],[130.1,35.2],[100.1,20.2],[100,20]]) {
   steps.push({requested:dimensions,...await resize(1,...dimensions)});
  }
  // Independently exercise the host CSS setter/readback on plain elements.
  // The control contains no Axure function; it predicts root/row results from
  // current CSS reads, requested deltas and measured primary-border widths.
  const controls=await page.evaluate(({fixture,raw,requests})=>{
   const root=document.createElement('div'),row=document.createElement('div');
   Object.assign(root.style,{position:'absolute',left:'-10000px',top:'0',boxSizing:'border-box',borderStyle:fixture.borderStyle??'solid',borderWidth:fixture.border.map(v=>v+'px').join(' '),padding:'0'});
   Object.assign(row.style,{position:'absolute',left:'0',top:'0',border:'0',padding:'0',width:fixture.width+'px',height:fixture.height+'px'});
   document.body.append(root);root.append(row);jQuery(root).css({width:raw.width,height:raw.height});
   const read=el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();return {inline:[el.style.width,el.style.height],css:[cs.width,cs.height],rect:[r.width,r.height]};};
   const border=getComputedStyle(root),primary=fixture.vertical?parseFloat(border.borderTopWidth)+parseFloat(border.borderBottomWidth):parseFloat(border.borderLeftWidth)+parseFloat(border.borderRightWidth);
   let size=[fixture.width,fixture.height];const results=[];
   for(const request of requests){const deltas=request.map((value,i)=>value-size[i]);
    for(let axis=0;axis<2;axis++)if(deltas[axis]!==0){const prop=axis?'height':'width';jQuery(row).css(prop,parseFloat(jQuery(row).css(prop))+deltas[axis]);jQuery(root).css(prop,parseFloat(jQuery(root).css(prop))+deltas[axis]+primary);}
    results.push({request,deltas,primary,root:read(root),row:read(row)});size=request;
   }
   root.remove();return results;
  },{fixture:f,raw:initial.rawEnvelope,requests:steps.map(s=>s.requested)});
  for(let index=0;index<steps.length;index++) {
   const actual=steps[index].snapshot,expected=controls[index];
   assert.deepEqual({inline:actual.root.inline,css:actual.root.jqueryCss,rect:[actual.root.rect.width,actual.root.rect.height]},expected.root,'native root versus host CSS control '+fixture.name+'/'+index);
   assert.deepEqual({inline:actual.rows[0].inline,css:actual.rows[0].jqueryCss,rect:[actual.rows[0].rect.width,actual.rows[0].rect.height]},expected.row,'native row versus host CSS control '+fixture.name+'/'+index);
   assert.deepEqual(actual.cache.r,{width:parseFloat(expected.root.css[0]),height:parseFloat(expected.root.css[1])});
   assert.deepEqual(actual.cache['r-1'],{width:parseFloat(expected.row.css[0]),height:parseFloat(expected.row.css[1])});
  }
  const restored=await refresh(f);assert.deepEqual(restored,initial,'same root refresh '+fixture.name);
  outcomes.push({name:fixture.name+'-'+(vertical?'vertical':'horizontal')+'-origin-and-growth',fixture:f,computedBorders,rawOrigin:rawXY,initial,steps,independentCssControls:controls,restored,pass:true});
  const emptyFixture={...f,ids:[],wrap:2,padding:[1,1,1,1]},empty=await init(emptyFixture);
  assert.deepEqual(empty.rawEnvelope,{width:-6,height:-2});assert.deepEqual(empty.root.inline,['0px','0px']);assert.deepEqual(empty.cache.r,{width:-6,height:-2});
  assert.deepEqual(empty.root.jqueryCss,empty.root.computed);
  outcomes.push({name:fixture.name+'-'+(vertical?'vertical':'horizontal')+'-empty-minimum',fixture:emptyFixture,empty,pass:true});
 }
 const controls=await page.evaluate(()=>{
  const widths=[0,0.001,0.01,0.1,0.24,0.25,0.49,0.5,0.66,0.6666667,0.75,0.99,1,1.01,1.1,1.25,1.49,1.5,1.99,2,2.9,3,3.3,5,7];
  return widths.map(width=>{
   const el=document.createElement('div');Object.assign(el.style,{position:'absolute',left:'20px',top:'20px',boxSizing:'border-box',width:'0',height:'0',borderStyle:'solid',borderWidth:width+'px'});document.body.append(el);
   const cs=getComputedStyle(el),r=el.getBoundingClientRect();const out={specified:width,computedBorder:cs.borderLeftWidth,computedWidth:cs.width,rectWidth:r.width,offsetWidth:el.offsetWidth};el.remove();return out;
  });
 });
 outcomes.push({name:'specified-border-versus-computed-border-sweep',pass:true,controls});
 const quantization=await page.evaluate(()=>{
  return [0,0.001,0.01,0.1,0.2,0.3,0.49,0.5,0.6666667,1.01,4.33333,4.66667,130.1,130.123456].map(value=>{
   const el=document.createElement('div');Object.assign(el.style,{position:'absolute',left:value+'px',top:value+'px',width:value+'px',height:value+'px',border:'0',padding:'0',margin:'0'});document.body.append(el);
   const cs=getComputedStyle(el),r=el.getBoundingClientRect();const out={specified:value,inline:[el.style.left,el.style.width],computed:[cs.left,cs.width],rect:[r.x,r.width]};el.remove();return out;
  });
 });
 outcomes.push({name:'position-and-size-layout-quantization-controls',pass:true,quantization});
 return outcomes;
}
