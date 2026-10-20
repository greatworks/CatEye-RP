import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { inspectStaticPng, inspectRpSemantics, recoverEmbeddedImage, property as get, IMAGE_LIMITS } from './read-rp-semantics.mjs';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { inspectRpFile } from './read-rp-container.mjs';
const file=name=>fileURLToPath(new URL(`../samples/${name}`,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const chunk=(name,data)=>{const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);out.write(name,4,'ascii');data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
function png({width=1,height=1,pixels=Buffer.from([0,1,2,3,255]),before=[],after=[]}={}) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),...before,chunk('IDAT',deflateSync(pixels)),...after,chunk('IEND',Buffer.alloc(0))]);
}
const quickFile=file('Quick Win.rp'), quick=inspectRpSemantics(quickFile);
const image=quick.diagrams.flatMap(d=>d.widgets).find(w=>w.imageRecovery?.status==='validated-embedded-png');
function sourceFixture() {
  const objects=inspectRpObjects(quickFile),pack=objects.packages.find(p=>p.objects.some(o=>o.id===image.id));
  const widget=pack.objects.find(o=>o.id===image.id),style=pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference);
  const part=inspectRpFile(quickFile).entries.find(p=>p.path===pack.path);
  return {widget,style,part,size:structuredClone(image.storedGeometry.size),recovery:structuredClone(image.styleRecovery)};
}
function run(f,budget={used:0}){return recoverEmbeddedImage(f.widget,f.style,f.size,f.recovery,f.part,budget);}
const set=(m,k,v)=>{const pair=m.$map.find(x=>x[0]===k);if(pair)pair[1]=v;else m.$map.push([k,v]);};

test('independent RGBA PNG validates exact bytes and pixels without target or browser execution',()=>{
  const b=png();assert.deepEqual(inspectStaticPng(b),{mime:'image/png',width:1,height:1,bitDepth:8,colorType:6,decodedBytes:b.length,sha256:hash(b),chunks:['IHDR','IDAT','IEND']});
});
test('PNG rejects truncation, corrupt CRC, appended bytes and executable carriers',()=>{
  const b=png();for(let n=0;n<b.length;n++)assert.throws(()=>inspectStaticPng(b.subarray(0,n)));
  const bad=Buffer.from(b);bad[20]^=1;assert.throws(()=>inspectStaticPng(bad),/CRC/);
  assert.throws(()=>inspectStaticPng(Buffer.concat([b,Buffer.from('<script>')])));
  assert.throws(()=>inspectStaticPng(Buffer.from('<svg onload="alert(1)">'+'.'.repeat(100))),/Only embedded PNG/);
});
test('PNG enforces file/pixel/inflation budgets and rejects unknown filters',()=>{
  assert.throws(()=>inspectStaticPng(Buffer.alloc(IMAGE_LIMITS.bytes+1)),/byte limit/);
  assert.throws(()=>inspectStaticPng(png({width:8193})),/pixel\/dimension/);
  assert.throws(()=>inspectStaticPng(png({width:8192,height:8192})),/pixel\/dimension/);
  assert.throws(()=>inspectStaticPng(png({pixels:Buffer.alloc(1024*1024)})),/oversized/);
  assert.throws(()=>inspectStaticPng(png({pixels:Buffer.from([5,0,0,0,0])})),/filter/);
});
test('PNG orientation, animation and unobserved metadata remain unsupported',()=>{
  for(const name of ['eXIf','acTL','zTXt','iCCP'])assert.throws(()=>inspectStaticPng(png({before:[chunk(name,Buffer.alloc(8))]})),/Unsupported PNG chunk/);
});
test('official Quick Win maps local IMAGE stream to original package bytes, never thumbnails',()=>{
  assert.equal(quick.fileSha256,'04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051');
  assert.equal(quick.diagrams.flatMap(d=>d.widgets).filter(w=>w.imageRecovery?.status==='validated-embedded-png').length,2);
  const recovered=image.imageRecovery,b=Buffer.from(recovered.dataUrl.split(',')[1],'base64');
  assert.equal(hash(b),'12212b85d5f88d3b5a83ceccddfb912750c8f5d2cbc49552585dc2701d8dc178');
  assert.equal(recovered.source.stream.offset,46910);assert.equal(recovered.source.stream.length,15232);
  assert.match(recovered.source.packagePath,/\/package$/);assert.equal(recovered.width,1200);assert.equal(recovered.height,900);
});
test('second fixed-hash official RP corroborates PNG mapping and rejects rounded image clipping',()=>{
  const ux=inspectRpSemantics(file('UX Prototyping.rp'));assert.equal(ux.fileSha256,'1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72');
  const supported=ux.diagrams.flatMap(d=>d.widgets).filter(w=>w.imageRecovery?.status==='validated-embedded-png');
  assert.equal(supported.length,2);assert.equal(supported[0].imageRecovery.width,1064);assert.equal(supported[0].imageRecovery.height,912);
  assert.ok(ux.diagrams.flatMap(d=>d.widgets).some(w=>w.imageRecovery?.reason?.includes('corner clipping')));
});
test('image ranges, source SHA-256 and cumulative budget are checked before data URLs are emitted',()=>{
  for(const mode of ['range','hash','size']){const f=sourceFixture(),entry=get(f.style.properties,'PropList').find(e=>(get(e,'DOAName')&0xfffffff)===27),stream=get(get(entry,'Value'),'Stream').$bytes;
    if(mode==='range')stream.offset=f.part.data.length;if(mode==='hash')stream.sha256='0'.repeat(64);if(mode==='size')stream.length=IMAGE_LIMITS.bytes+1;
    assert.equal(run(f).status,'unsupported-image');
  }
  assert.match(run(sourceFixture(),{used:IMAGE_LIMITS.dataUrlCharacters}).reason,/budget/);
  const budget={used:0};const r=run(sourceFixture(),budget);assert.equal(budget.used,r.dataUrl.length);
});
test('unknown fit, aspect ratio, preserved corners, source extensions and image state fail closed',()=>{
  for(const mode of ['fit','aspect','corners','extension','state','filter','unresolved']) {
    const f=sourceFixture();
    if(mode==='fit')set(f.widget.properties,'fit-to-image',true);
    if(mode==='aspect')f.size.value.Width++;
    if(mode==='corners')set(get(f.widget.properties,'PreserveCornersRectangle'),'Width',1);
    if(mode==='extension'){const entry=get(f.style.properties,'PropList').find(e=>(get(e,'DOAName')&0xfffffff)===27);set(get(entry,'Value'),'Extension','.svg');}
    if(mode==='state')set(f.widget.properties,'Selected',true);
    if(mode==='filter')set(f.recovery.imageProperties[90].value,'On',true);
    if(mode==='unresolved')f.recovery.imageProperties[30].determined=false;
    assert.equal(run(f).status,'unsupported-image',mode);
  }
});
