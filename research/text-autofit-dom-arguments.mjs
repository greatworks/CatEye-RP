import fs from 'node:fs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const file='research/rotation-runtime-shape-writer-cil.json',methods=readJson(file).Types.flatMap(t=>t.Methods);
const records=[
 {method:'nNPR',callIL:395,range:[242,400],kind:'ordinary owner',args:{id:'arg3',class:'wNxE(shape,disabled,selected,error,[]) + " transition notrs"',label:'shape.oIYX',title:'shape.IJpz',displayGate:'local2 from CNPv',selectionGroup:'MNP1(context,shape.vJqV)',closeImmediately:false,attributes:'zNPc(arg2 rectangle,xNKd(),true,null)' }},
 {method:'nNPR',callIL:988,range:[916,993],kind:'closed background child',args:{id:'arg3 + "_div"',class:'join state/id classes constructed in local3',label:null,title:null,displayGate:true,selectionGroup:null,closeImmediately:true,attributes:'zNPc(arg2 rectangle,xNKd(),false,null)'}},
 {method:'sNP3',callIL:2538,range:[2346,2543],kind:'ordinary image-path owner, optional compound class',args:{id:'arg3',class:'optional "compound " + wNxE(shape,disabled,selected,error,[]) + " transition notrs"',label:'shape.oIYX',title:'shape.IJpz',displayGate:'local14 from CNPv',selectionGroup:'MNP1(context,shape.vJqV)',closeImmediately:false,attributes:'zNPc(arg2 rectangle,xNKd(),true,local10 metadata)'}},
 {method:'sNP3',callIL:3639,range:[3481,3644],kind:'compound vector-piece child, NOT ordinary owner',args:{id:'local8[local40]',class:'"ax_vector_shape" plus optional generated id class',label:'shape.oIYX',title:'shape.IJpz',displayGate:true,selectionGroup:'MNP1(context,shape.vJqV)',closeImmediately:false,attributes:'local42: WidgetTopLeftX/Y,WidgetTopRightX/Y,WidgetBottomLeftX/Y,WidgetBottomRightX/Y'},laterCloseIL:3871},
];
for(const record of records){const m=methods.find(m=>m.Name===record.method);record.token=m.Token;record.instructions=m.Instructions.filter(i=>i.Offset>=record.range[0]&&i.Offset<=record.range[1]);if(m.Instructions.find(i=>i.Offset===record.callIL).Operand!==100699506)throw Error('Call mismatch');}
const report={method:'Human-readable parameter provenance beside exact retained instruction slices; interpretation labels are not claimed original parameter names.',source:{file,sha256:sha256(file)},records};
fs.writeFileSync('research/text-autofit-dom-arguments.json',JSON.stringify(report,null,2)+'\n');
console.log('4 exact DNCg call-site slices retained');
