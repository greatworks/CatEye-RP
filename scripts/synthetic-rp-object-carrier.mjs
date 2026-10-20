import { gzipSync } from 'node:zlib';

// Test-only inverse of the admitted reader carriers. These independently encoded
// bytes are NOT emitted by Axure and do not establish native write-back support.
// Finite number tags are selected here; the decoded reader does not retain them.
export function encodeSyntheticObjectPackage(pack) {
  const strings=[],guids=[],seenStrings=new Set(),seenGuids=new Set();
  const addString=s=>{if(s===null)return;if(typeof s!=='string')throw Error('Expected fixture string');if(!seenStrings.has(s)){seenStrings.add(s);strings.push(s);}};
  const addGuid=s=>{if(typeof s!=='string'||! /^[a-f0-9]{32}$/.test(s))throw Error('Expected fixture GUID');if(s!=='0'.repeat(32)&&!seenGuids.has(s)){seenGuids.add(s);guids.push(s);}};
  const scan=v=>{
    if(v===null)return; // observed string table index0, not a new null value tag
    if(typeof v==='string')return addString(v);
    if(typeof v==='number'||typeof v==='boolean')return;
    if(Array.isArray(v)){v.forEach(scan);return;}
    if(!v||typeof v!=='object')throw Error('Unrepresentable synthetic value');
    if(v.$map){for(const [k,x]of v.$map){scan(k);scan(x);}return;}
    if(v.$guid!==undefined)return addGuid(v.$guid);
    if(v.$reference!==undefined){addGuid(v.$reference);if(v.name!==undefined)addString(v.name);return;}
    if(v.$number!==undefined||v.$int64!==undefined)return;
    if(v.$namedValue!==undefined){addString(v.$namedValue);scan(v.properties);return;}
    if(v.$pluginValue!==undefined){addString(v.prefix);addString(v.$pluginValue);scan(v.properties);return;}
    throw Error('Unsupported synthetic carrier, including opaque byte payloads');
  };
  addGuid(pack.rootId);addGuid(pack.packageId);
  for(const o of pack.objects){addGuid(o.id);addString(o.type);scan(o.properties);}
  const i32=n=>{const b=Buffer.alloc(4);b.writeInt32LE(n);return b;},cat=(...parts)=>Buffer.concat(parts);
  const s=s=>{if(s===null)return i32(0);const index=strings.indexOf(s);if(index<0)throw Error('Missing fixture string');return i32(index+1);},g=id=>i32(id==='0'.repeat(32)?0:guids.indexOf(id)+1);
  const value=v=>{
    if(v===null)return cat(i32(8),s(null));
    if(typeof v==='string')return cat(i32(8),s(v));
    if(typeof v==='boolean')return cat(i32(25),Buffer.from([Number(v)]));
    if(typeof v==='number'){
      if(Number.isInteger(v)&&v>=-2147483648&&v<=2147483647)return cat(i32(5),i32(v));
      const b=Buffer.alloc(8);b.writeDoubleLE(v);return cat(i32(6),b);
    }
    if(Array.isArray(v))return cat(i32(2),i32(v.length),...v.map(value));
    if(v.$map)return cat(i32(1),i32(v.$map.length),...v.$map.flatMap(([k,x])=>[value(k),value(x)]));
    if(v.$guid!==undefined)return cat(i32(17),g(v.$guid));
    if(v.$reference!==undefined){
      if(![3,16,19,20,21,22].includes(v.referenceTag))throw Error('Unsupported synthetic reference tag');
      return cat(i32(v.referenceTag),...([16,19].includes(v.referenceTag)?[s(v.name)]:[]),g(v.$reference));
    }
    if(v.$number!==undefined){const b=Buffer.alloc(v.numberTag===7?4:8);if(v.numberTag===7)b.writeFloatLE(Number(v.$number));else if(v.numberTag===6)b.writeDoubleLE(Number(v.$number));else throw Error('Unsupported number tag');return cat(i32(v.numberTag),b);}
    if(v.$int64!==undefined){const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(v.$int64));return cat(i32(29),b);}
    if(v.$namedValue!==undefined)return cat(i32(23),s(v.$namedValue),value(v.properties));
    if(v.$pluginValue!==undefined)return cat(i32(24),s(v.prefix),s(v.$pluginValue),value(v.properties));
    throw Error('Unrepresentable synthetic value');
  };
  const guidBytes=id=>{const b=Buffer.alloc(16);b.writeUInt32LE(parseInt(id.slice(0,8),16),0);b.writeUInt16LE(parseInt(id.slice(8,12),16),4);b.writeUInt16LE(parseInt(id.slice(12,16),16),6);Buffer.from(id.slice(16),'hex').copy(b,8);return b;};
  return cat(...[27,...pack.version,50001,31,strings.length].map(i32),...strings.flatMap(v=>{const b=Buffer.from(v,'utf8');return[i32(b.length),b];}),i32(30),i32(guids.length),...guids.map(guidBytes),i32(26),i32(15),g(pack.rootId),i32(18),g(pack.packageId),...pack.objects.map(o=>cat(i32(9),g(o.id),s(o.type),value(o.properties))),i32(28));
}

export function encodeSyntheticRpContainer(packages) {
  const root={children:{},parts:{}},segments=[];let offset=0;
  for(const pack of packages){
    const names=pack.path.split('/');if(names.some(n=>!n||n==='.'||n==='..'||['__proto__','prototype','constructor'].includes(n)))throw Error('Invalid fixture package path');
    let node=root;for(const name of names.slice(0,-1)){node.children??={};node.children[name]??={children:{},parts:{}};node=node.children[name];}
    const part=names.at(-1);if(Object.hasOwn(node.parts,part))throw Error('Duplicate fixture part');node.parts[part]=offset;
    const data=gzipSync(encodeSyntheticObjectPackage(pack)),header=Buffer.alloc(8);header.writeUInt32LE(data.length,4);const segment=Buffer.concat([header,data]);segments.push(segment);offset+=segment.length;
  }
  const json=Buffer.from(JSON.stringify({root})),extra=[];let remaining=json.length-15;
  if(remaining>=0){while(remaining>=255){extra.push(255);remaining-=255;}extra.push(remaining);}
  const block=Buffer.concat([Buffer.from([Math.min(json.length,15)<<4,...extra]),json]);
  const varint=n=>{const bytes=[];do{bytes.push((n&127)|(n>=128?128:0));n>>>=7;}while(n);return Buffer.from(bytes);};
  const index=Buffer.concat([Buffer.from([1]),varint(json.length),varint(block.length),block]),header=Buffer.alloc(8);header.writeUInt16LE(0xefac);header.writeUInt16LE(11,2);header.writeUInt32LE(index.length,4);
  return Buffer.concat([header,index,...segments]);
}
