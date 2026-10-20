import { describe, it, expect } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

type Data = Record<string, any>;
function fixture(): Data {
  return {status:'partial-read-only-recovery',recoveryVersion:1,fileSha256:'c'.repeat(64),packageFailures:[],semanticFailures:[],diagrams:[{rootType:'Axure:Page',packageId:'b'.repeat(32),name:'Font style',widgets:[{
    status:'stored-fields-recovered',id:'a'.repeat(32),type:'Axure:DiagramObject:VectorShape',typeCandidate:{type:'box'},label:'Typography',
    storedGeometry:{location:{determined:true,overridden:true,value:{X:20,Y:30}},size:{determined:true,overridden:true,value:{Width:160,Height:40}},rotation:null,transform:null,adaptiveStyleCount:0,isComputedLayout:false},
    storedFlags:{AutoFitWidth:false,AutoFitHeight:false,'fit-to-content':false,'is-fixed':false,'is-percent-width':false,IsContained:false,IsLocked:false,Disabled:false,VisibleFromSettings:true},
    text:{status:'stored-plain-text',text:'Normal reset'},styleRecovery:{style:{fontStyle:'normal'},visible:true},
    selectionRecovery:{status:'supported-selection',selected:false,selectionGroup:'',selectedStyle:{fontStyle:'normal'},baseStyleRecovery:{style:{fontStyle:'normal'},visible:true}},
    interactionStyleRecovery:{status:'recovered-interaction-styles',cacheChainComplete:true,baseStyleRecovery:{style:{fontStyle:'normal'}},unhandledStates:[],states:{
      mouseover:{sourceState:'MouseOver',status:'supported-state-style',sourceStyleId:'d'.repeat(32),sourceProperties:[1002],style:{fontStyle:'italic'},provenance:{fontStyle:{kind:'stored-active-state-style',property:'FONT_STYLE'}}},
      mousedown:{sourceState:'MouseDown',status:'no-state-style'},focused:{sourceState:'Focused',status:'no-state-style'},disabled:{sourceState:'Disabled',status:'no-state-style'},
    }},
  }]}]};
}
const sourceWidget=(source:Data)=>source.diagrams[0].widgets[0];
describe('strict native font style conversion',()=>{
  it('preserves independent base, explicit selected normal reset, hover italic and save/reopen data',()=>{
    const source=fixture(),before=JSON.stringify(source),result=importRpSemantics(source),widget=result.document.pages[0].widgets[0];
    expect(widget).toMatchObject({style:{fontStyle:'normal'},selectedStyle:{fontStyle:'normal'},mouseOverStyle:{fontStyle:'italic'}});
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document); expect(JSON.stringify(source)).toBe(before);
    expect(result.report).toMatchObject({widgetsImported:1,widgetsSkipped:0});
  });
  it.each(['oblique','none',0,1,null,'italic; color:red'])('rejects unsupported base font style %s',value=>{
    const source=fixture(),w=sourceWidget(source); delete w.selectionRecovery;delete w.interactionStyleRecovery;w.styleRecovery.style.fontStyle=value;
    expect(importRpSemantics(source).report).toMatchObject({widgetsImported:0,widgetsSkipped:1});
  });
  it.each(['oblique','none',0,1,null,'italic; color:red'])('omits unsupported state font style %s atomically',value=>{
    const source=fixture();sourceWidget(source).interactionStyleRecovery.states.mouseover.style.fontStyle=value;
    const result=importRpSemantics(source);expect(result.document.pages[0].widgets[0].mouseOverStyle).toBeUndefined();
    expect(result.document.pages[0].widgets[0].selectedStyle).toEqual({fontStyle:'normal'});expect(result.report.widgetsSkipped).toBe(0);
  });
  it('does not accept fontStyle without its source property or with an unresolved base',()=>{
    for(const mutation of ['source','base']) {
      const source=fixture(),recovery=sourceWidget(source).interactionStyleRecovery;
      if(mutation==='source') recovery.states.mouseover.sourceProperties=[];
      else {recovery.cacheChainComplete=false;recovery.states.mouseover.independentOfInheritedBase=true;}
      expect(importRpSemantics(source).document.pages[0].widgets[0].mouseOverStyle).toBeUndefined();
    }
  });
  it('accepts the complete sixteen-property explicit patch without injecting extra fields',()=>{
    const source=fixture(),state=sourceWidget(source).interactionStyleRecovery.states.mouseover;
    state.sourceProperties=[1,2,6,7,8,9,10,11,12,13,14,15,20,70,1001,1002];
    state.style={fontFamily:'Roboto',fontSize:14,color:'#000000',fill:'#ffffff',stroke:'#123456',textAlign:'left',verticalAlign:'top',textPadding:[1,2,3,4],strokeWidth:1,lineHeight:'normal',opacity:1,fontWeight:400,fontStyle:'italic'};
    expect(importRpSemantics(source).document.pages[0].widgets[0].mouseOverStyle).toEqual(state.style);
  });
});
