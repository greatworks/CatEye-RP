import { gzipSync } from 'node:zlib';

// Test-only, independently encoded fixture. It is NOT an Axure-produced document
// and does not establish native write-back compatibility or Axure acceptance.
export function makeSyntheticEmptyRp() {
  const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
  const cat = (...buffers) => Buffer.concat(buffers);
  const strings = ['Axure:Page','Axure:Diagram','diagram','diagram-objects','Axure:DesignDocument','Axure:PackageInfo','package-id','package-name','SYNTHETIC empty page'];
  const str = s => cat(i32(8), i32(strings.indexOf(s) + 1));
  const map = entries => cat(i32(1), i32(entries.length), ...entries.flat());
  const ref = n => cat(i32(3), i32(n));
  // Repeated-byte GUIDs avoid relying on an implicit host byte order.
  const guids = [1,2,3,4,5].map(n => Buffer.alloc(16, n * 17));
  const header = cat(...[27,11,0,0,0,50001,31,strings.length].map(i32), ...strings.map(s => { const b=Buffer.from(s); return cat(i32(b.length),b); }), i32(30), i32(guids.length), ...guids);
  const object = (id,type,props) => cat(i32(9),i32(id),i32(strings.indexOf(type)+1),map(props));
  const pack = (rootId,packageId,objects) => cat(header,...[26,15,rootId,18,packageId].map(i32),...objects,i32(28));
  const page = pack(1,2,[object(1,'Axure:Page',[[str('diagram'),ref(3)]]),object(3,'Axure:Diagram',[[str('diagram-objects'),cat(i32(2),i32(0))]])]);
  const doc = pack(4,4,[object(4,'Axure:DesignDocument',[]),object(5,'Axure:PackageInfo',[[str('package-id'),cat(i32(19),i32(1),i32(2))],[str('package-name'),str('SYNTHETIC empty page')]])]);
  const segment = bytes => { const data=gzipSync(bytes), h=Buffer.alloc(8);h.writeUInt32LE(data.length,4);return cat(h,data); };
  const pageSegment=segment(page), docSegment=segment(doc);
  const json=Buffer.from(JSON.stringify({root:{children:{['2'.repeat(32)]:{parts:{package:0}}},parts:{DesignDocument:pageSegment.length}}}));
  const extra=[];let remaining=json.length-15;while(remaining>=255){extra.push(255);remaining-=255;}extra.push(remaining);
  const block=cat(Buffer.from([0xf0,...extra]),json);
  const varint=n=>{const b=[];do{b.push((n&127)|(n>=128?128:0));n>>>=7;}while(n);return Buffer.from(b);};
  const index=cat(Buffer.from([1]),varint(json.length),varint(block.length),block), outer=Buffer.alloc(8);
  outer.writeUInt16LE(0xefac);outer.writeUInt16LE(11,2);outer.writeUInt32LE(index.length,4);
  return cat(outer,index,pageSegment,docSegment);
}
