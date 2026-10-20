import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

type Data = Record<string, any>;
function fixture(): Data {
  const style = {fontFamily:'Arial',fontSize:14,fontWeight:400,fontStyle:'normal',color:'#123456',underline:false,strikethrough:false};
  return {status:'partial-read-only-recovery',recoveryVersion:1,fileSha256:'c'.repeat(64),packageFailures:[],semanticFailures:[],diagrams:[{rootType:'Axure:Page',packageId:'b'.repeat(32),name:'Decorations',widgets:[{
    status:'stored-fields-recovered',id:'a'.repeat(32),type:'Axure:DiagramObject:VectorShape',typeCandidate:{type:'box'},label:'Decorations',
    storedGeometry:{location:{determined:true,overridden:true,value:{X:20,Y:30}},size:{determined:true,overridden:true,value:{Width:160,Height:40}},rotation:null,transform:null,adaptiveStyleCount:0,isComputedLayout:false},
    storedFlags:{AutoFitWidth:false,AutoFitHeight:false,'fit-to-content':false,'is-fixed':false,'is-percent-width':false,IsContained:false,IsLocked:false,Disabled:false,VisibleFromSettings:true},
    text:{status:'stored-rich-text-as-plain',text:'Literal [[name]]'},styleRecovery:{style:{underline:true,strikethrough:true},visible:true},
    richTextRecovery:{status:'supported-rich-text',richText:{expressionMode:'literal',paragraphs:[{runs:[{text:'Literal [[name]]',style}],textAlign:'left',lineHeightPx:'normal'}]},text:'Literal [[name]]',source:{kind:'native-rp11-paragraph-runs',runStyleSchemaVersion:2,paragraphCount:1,runCount:1,normalizedBoundaryLF:0,nativeSizeDivisor:.75,nativeLineSpacingDivisor:.75,nativeFontMetricsVerified:false}},
  }]}]};
}
const item=(source:Data)=>source.diagrams[0].widgets[0];
const run=(source:Data)=>item(source).richTextRecovery.richText.paragraphs[0].runs[0];
const state=(sourceState:string,sourceProperties:number[],style:Data)=>({status:'supported-state-style',sourceState,sourceStyleId:'d'.repeat(32),sourceProperties,style});
function addStates(source:Data) {
  const states:Data={mouseover:state('MouseOver',[5],{underline:false}),mousedown:state('MouseDown',[95],{strikethrough:false}),focused:state('Focused',[5,95],{underline:true,strikethrough:true}),disabled:state('Disabled',[],{})};
  item(source).interactionStyleRecovery={status:'recovered-interaction-styles',cacheChainComplete:true,states,unhandledStates:[]};return states;
}
describe('native text-decoration protocol',()=>{
  it.each([[false,false],[true,false],[false,true],[true,true]])('preserves literal run decorations %s/%s, explicit clearing and save/reopen', (underline,strikethrough)=>{
    const source=fixture();Object.assign(run(source).style,{underline,strikethrough});const before=JSON.stringify(source);
    const result=importRpSemantics(source),w=result.document.pages[0].widgets[0];
    expect(w.style).toMatchObject({underline:true,strikethrough:true});
    expect(w.richText!.paragraphs[0].runs[0].style).toEqual(run(source).style);
    expect(w.text).toBe('Literal [[name]]');expect(w.richText!.expressionMode).toBe('literal');
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);expect(JSON.stringify(source)).toBe(before);
  });
  it.each(['missing version','old version','missing underline','missing strike','numeric underline','string strike','unknown style','inherited underline'])(
    'rejects malformed or stale native rich protocol atomically: %s',kind=>{
      const source=fixture(),r=item(source).richTextRecovery,s=run(source).style;
      if(kind==='missing version')delete r.source.runStyleSchemaVersion;
      if(kind==='old version')r.source.runStyleSchemaVersion=1;
      if(kind==='missing underline')delete s.underline;
      if(kind==='missing strike')delete s.strikethrough;
      if(kind==='numeric underline')s.underline=1;
      if(kind==='string strike')s.strikethrough='false';
      if(kind==='unknown style')s.letterSpacing=.4;
      if(kind==='inherited underline'){delete s.underline;Object.setPrototypeOf(s,{underline:false});}
      const result=importRpSemantics(source);expect(result.report).toMatchObject({widgetsImported:0,widgetsSkipped:1});
    });
  it('allows legacy saved documents with omitted decorations without silently accepting the old native worker protocol',()=>{
    const source=fixture(),doc=importRpSemantics(source).document;
    delete doc.pages[0].widgets[0].richText!.paragraphs[0].runs[0].style!.underline;
    delete doc.pages[0].widgets[0].richText!.paragraphs[0].runs[0].style!.strikethrough;
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('keeps one-property resets, both-together and empty state distinct without completing absent properties',()=>{
    const source=fixture();addStates(source);
    item(source).selectionRecovery={status:'supported-selection',selected:false,selectionGroup:'',selectedStyle:{underline:false,strikethrough:true},baseStyleRecovery:item(source).styleRecovery};
    const result=importRpSemantics(source),w=result.document.pages[0].widgets[0];
    expect(w.selectedStyle).toEqual({underline:false,strikethrough:true});expect(w.mouseOverStyle).toEqual({underline:false});
    expect(w.mouseDownStyle).toEqual({strikethrough:false});expect(w.focusedStyle).toEqual({underline:true,strikethrough:true});expect(w.disabledStyle).toEqual({});
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });
  it.each(['wrong key','omitted key','extra key','duplicate key','invalid boolean','unknown inheritance'])(
    'omits only malformed decoration state, preserving independent states: %s',kind=>{
      const source=fixture(),states=addStates(source),s=states.mouseover;
      if(kind==='wrong key')s.sourceProperties=[95];
      if(kind==='omitted key')s.sourceProperties=[];
      if(kind==='extra key')s.style.strikethrough=false;
      if(kind==='duplicate key')s.sourceProperties=[5,5];
      if(kind==='invalid boolean')s.style.underline=0;
      if(kind==='unknown inheritance'){item(source).interactionStyleRecovery.cacheChainComplete=false;s.independentOfInheritedBase=true;}
      const result=importRpSemantics(source),w=result.document.pages[0].widgets[0];expect(result.report.widgetsImported).toBe(1);expect(w.mouseOverStyle).toBeUndefined();
      if(kind!=='unknown inheritance')expect(w.mouseDownStyle).toEqual({strikethrough:false});
      expect(result.report.issues.some(i=>i.code==='interaction-style-omitted')).toBe(true);
    });
  it('accepts the full eighteen-property state including both decorations and four-side padding',()=>{
    const source=fixture(),states=addStates(source);
    states.focused=state('Focused',[1,2,5,6,7,8,9,10,11,12,13,14,15,20,70,95,1001,1002],{
      fontFamily:'Arial',fontSize:14,underline:false,color:'#123456',fill:'#ffffff',stroke:'#000000',textAlign:'left',verticalAlign:'middle',textPadding:[1,2,3,4],strokeWidth:1,lineHeight:'normal',opacity:.8,strikethrough:true,fontWeight:400,fontStyle:'normal',
    });
    expect(importRpSemantics(source).document.pages[0].widgets[0].focusedStyle).toEqual(states.focused.style);
  });
});
