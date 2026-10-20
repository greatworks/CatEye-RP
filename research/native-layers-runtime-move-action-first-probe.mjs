import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {layerHarness} from './native-layers-runtime-probe.mjs';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=x=>createHash('sha256').update(x).digest('hex'),ranges=[];
function lines(first,last){const code=fs.readFileSync(path.join(root,'action.js'),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file:'action.js',first,last,sha256:hash(code)});return code}
const setup=`var SAFARI=false,IOS=false,SHARE_APP=false;$ax.splice=(a,i,n)=>a.splice(i,n);function $jobjAll(id){return $jobj(id)}
${lines(2,349)}
${lines(757,1041)}
`;
const group=`add('g',{left:100,top:100,width:120,height:60},{type:'layer'},'base');add('a',{left:100,top:100,width:20,height:20},{type:'vectorShape'},'g');add('b',{left:140,top:100,width:40,height:30},{type:'vectorShape'},'g');`;
const results=[];
for(const [mode,x,y] of [['location','130','120'],['delta','30','20']]){
 let observed,error;
 try{observed=layerHarness(setup+group+`_addMove('g',{srcElement:'g',idToResizeMoveState:{g:{}}},{moveType:${JSON.stringify(mode)},xValue:{value:${JSON.stringify(x)}},yValue:{value:${JSON.stringify(y)}},options:{}},{easing:'none',duration:0,stop:{instant:true}});flush();return currentState();`);assert.equal(observed.moveInfo.b.x,30);assert.equal(observed.moveInfo.b.y,20);assert.equal(observed.nodes.b.left,170)}catch(e){error=String(e.stack)}
 results.push({mode,x,y,passed:!error,observed,...(error?{error}:{})});
}
const report={capturedAt:new Date().toISOString(),kind:'Original _addMove -> _getMoveLoc -> public moveBy -> MoveWidget/PrepareForMove, with original queue inside the existing in-memory NodeVM facade.',correction:'The earlier direct MoveWidget(to=true) result is not the Move To action result. Original Layer action first converts To into one delta and invokes moveBy; member movement information therefore shares that delta. No implementation bug is established by the direct-API case.',sources:JSON.parse(fs.readFileSync('research/native-layers-runtime-second-probes.json','utf8')).sources,ranges,script:{path:'research/native-layers-runtime-move-action-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results};
const out=process.argv[2]??'research/native-layers-runtime-move-action-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,failures:results.filter(x=>!x.passed)},null,2));if(report.summary.failed)process.exitCode=1;
