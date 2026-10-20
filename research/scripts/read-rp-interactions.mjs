/** Static, evidence-bound interaction reader. See ../rp-interaction-evidence.md.
 * No expression evaluation, target execution, or partial-event recovery.
 */
const ZERO = '0'.repeat(32), GUID = /^[a-f0-9]{32}$/;
const ADAPTIVE_BASE = '19e82109f102476f933582835c373474';
// Axure.Constants.IxEventType, not the unrelated legacy RPEventType enum.
const EVENTS = new Map([[16,'click'],[17,'doubleClick'],[18,'mouseEnter'],[20,'mouseLeave'],[48,'focus'],[49,'blur'],[50,'change'],[51,'change'],[52,'selectedChange'],[53,'select'],[54,'unselect'],[55,'errorSet'],[56,'errorRemoved'],[279,'rotate'],[288,'load'],[289,'itemLoad'],[320,'load'],[338,'adaptiveViewChange']]);
// RP11 AnimationEasing enum -> FJMQ/AJCR (first character lowercased).
const ROTATE_EASINGS = ['none','swing','linear','easeInCubic','easeOutCubic','easeInOutCubic','easeOutBounce','easeOutElastic','easeInSine','easeInQuad','easeInQuart','easeInQuint','easeInExpo','easeInCirc','easeInBack','easeInElastic','easeInBounce','easeOutSine','easeOutQuad','easeOutQuart','easeOutQuint','easeOutExpo','easeOutCirc','easeOutBack','easeInOutSine','easeInOutQuad','easeInOutQuart','easeInOutQuint','easeInOutExpo','easeInOutCirc','easeInOutBack','easeInOutElastic','easeInOutBounce'];
const ROTATE_ANCHORS = ['top left','top','top right','left','center','right','bottom left','bottom','bottom right'];
const ROTATE_TARGETS = ['VectorShape','ImageBox','ImageMapRegion','DynamicPanel','Layer'];
const MOVE_MODES = ['location','delta','drag','dragX','dragY','locationBeforeDrag','withThis','sizeDeltaX','sizeDeltaY'];
const MOVE_TRAJECTORIES = ['straight','arcClockwise','arcAntiClockwise'];
const MOTION_BUILTINS = ['this','target','window','dragx','dragy'];
// A bounded grammar for the witnessed numeric StringLiteral inputs. This is
// validation, not execution of Axure's parser or conversion of its result type.
// The exact original text is retained; primitive STO replacement returns text.
function motionSyntax(text, bindings) {
  const source = text.trim(), identifiers = [];
  if (!source.startsWith('[[')) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(source) || !Number.isFinite(Number(source))) fail('Unsupported motion numeric literal');
    return identifiers;
  }
  if (!source.endsWith(']]')) fail('Motion input requires a complete expression');
  const input=source.slice(2,-2).trim(), tokens=[], re=/\s*(?:(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?|([A-Za-z_][A-Za-z0-9_]*)|([()+\-*/.,]))/y;
  let at=0, index=0;
  while(at<input.length){re.lastIndex=at;const m=re.exec(input);if(!m)fail('Unsupported motion expression token');tokens.push(m[1]!==undefined?{kind:'number',value:Number(m[1]+(m[2]??''))}:m[3]?{kind:'name',value:m[3]}:{kind:'symbol',value:m[4]});at=re.lastIndex;if(tokens.length>256)fail('Motion expression token limit');}
  const has=value=>tokens[index]?.value===value, take=value=>{if(tokens[index++]?.value!==value)fail(`Expected motion token ${value}`);};
  function atom(depth){
    if(depth>32)fail('Motion expression depth limit');
    const t=tokens[index++];if(!t)fail('Incomplete motion expression');let kind='scalar',name;
    if(t.kind==='number'){if(!Number.isFinite(t.value))fail('Nonfinite motion literal');}
    else if(t.value==='+'||t.value==='-'){atom(depth+1);}
    else if(t.value==='('){expr(0,depth+1);take(')');}
    else if(t.kind==='name'){
      name=t.value.toLowerCase();if(!MOTION_BUILTINS.includes(name)&&!bindings.has(name))fail(`Unbound motion expression name ${t.value}`);
      if(MOTION_BUILTINS.includes(name))identifiers.push(name);
      kind=['dragx','dragy'].includes(name)?'scalar':'object';
    }else fail('Invalid motion expression atom');
    while(has('.')){
      take('.');const p=tokens[index++];if(p?.kind!=='name')fail('Invalid motion property');
      if(p.value==='toFixed'){
        if(kind!=='scalar')fail('Motion toFixed requires a scalar');take('(');const n=tokens[index++];if(n?.kind!=='number'||!Number.isInteger(n.value)||n.value<0||n.value>100)fail('Invalid motion toFixed precision');take(')');
      }else{
        if(kind!=='object'||!['x','y','width','height','left','right','top','bottom'].includes(p.value)||(name==='window'&&!['width','height'].includes(p.value)))fail(`Unsupported motion geometry property ${p.value}`);
      }
      kind='scalar';
    }
    if(kind==='object')fail('Motion geometry object must have a scalar property');
  }
  const precedence={'+':1,'-':1,'*':2,'/':2};
  function expr(min,depth){atom(depth);while(precedence[tokens[index]?.value]>=min){const op=tokens[index++].value;expr(precedence[op]+1,depth+1);}}
  expr(0,0);if(index!==tokens.length)fail('Trailing motion expression tokens');return identifiers;
}
// Numeric comparisons are deliberately withheld until the importer/runtime can
// preserve Axure's coercion rules. Native equality also needs its explicit mode.
const COMPARISONS = new Map([[3,'equals'],[4,'notEquals']]);
const fail = message => { throw new Error(message); };
// Keep this reader independent: read-rp-semantics imports it for its post-pass.
function property(map, key) {
  if (!map || !Array.isArray(map.$map)) fail(`Missing property map for ${key}`);
  const entries = map.$map.filter(pair => Array.isArray(pair) && pair[0] === key);
  if (entries.length > 1) fail(`Ambiguous duplicate property ${key}`);
  return entries[0]?.[1];
}
const list = (value, name, limit = 1000) => { if (!Array.isArray(value) || value.length > limit) fail(`Invalid or oversized ${name}`); return value; };
const bool = (value, name) => { if (typeof value !== 'boolean') fail(`Invalid ${name}`); return value; };
const string = (value, name, limit = 10000) => { if (typeof value !== 'string' || value.length > limit) fail(`Invalid or oversized ${name}`); return value; };
function props(object, allowed) {
  const entries = object?.properties?.$map;
  if (!Array.isArray(entries)) fail('Missing object property map');
  const seen = new Set();
  for (const pair of entries) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || seen.has(pair[0])) fail('Ambiguous object property map');
    seen.add(pair[0]);
    if (allowed && !allowed.includes(pair[0])) fail(`Unsupported ${object.type} property ${pair[0]}`);
  }
  return key => property(object.properties, key);
}
function reference(value, tag, name) {
  if (!value || value.referenceTag !== tag || typeof value.$reference !== 'string' || !GUID.test(value.$reference)) fail(`Invalid ${name} reference`);
  return value.$reference;
}
function zeroReference(value, name, tag = 3) { if (reference(value, tag, name) !== ZERO) fail(`Unsupported nonempty ${name}`); }
function zeroGuid(value, name) { if (value?.$guid !== ZERO) fail(`Unsupported nonempty ${name}`); }

export function recoverInteractionMap({ owner, objects, packageId }) {
  try {
    if (!(objects instanceof Map) || !owner || typeof packageId !== 'string') fail('Owner, local object Map, and packageId are required');
    const local = (value, expected) => {
      const id = reference(value, 3, expected ?? 'local object'), object = objects.get(id);
      if (!object || object.id !== id || (expected && object.type !== expected)) fail(`Unresolved or wrong-type ${expected ?? 'object'} ${id} in package ${packageId}`);
      return object;
    };
    const op = props(owner), mapRef = op(owner.type.startsWith('Axure:DiagramObject:') ? 'InteractionMap' : 'interactionmap');
    if (mapRef === undefined || reference(mapRef, 3, 'interaction map') === ZERO) return { status: 'decoded-interaction-tree', events: [] };
    const map = local(mapRef, 'Axure:InteractionTreeMap'), mp = props(map, ['node-table','tree','PackageMode']);
    if (mp('PackageMode') !== false) fail('Unsupported interaction PackageMode');
    const table = list(mp('node-table')?.$map, 'interaction node-table'), bindings = new Map(), members = new Set();
    for (const pair of table) {
      if (!Array.isArray(pair) || pair.length !== 2) fail('Invalid node-table entry');
      const node = local(pair[0], 'Axure:Node'), member = local(pair[1]);
      if (bindings.has(node.id) || members.has(member.id)) fail('Duplicate node-table node or member');
      bindings.set(node.id, member); members.add(member.id);
    }
    const tree = local(mp('tree'), 'Axure:Tree'), tp = props(tree, ['children','tree']);
    if (reference(tp('tree'), 3, 'tree identity') !== tree.id) fail('Mismatched tree identity');
    const seen = new Set();
    function walk(ref, parent, depth) {
      if (depth > 16 || seen.size >= 1000) fail('Interaction tree depth/node limit');
      const node = local(ref, 'Axure:Node'), np = props(node, ['children','parent-node','tree']);
      if (seen.has(node.id)) fail('Repeated or cyclic interaction node');
      seen.add(node.id);
      if (reference(np('parent-node'), 3, 'node parent') !== parent || reference(np('tree'), 3, 'node tree') !== tree.id) fail('Interaction node parent/tree mismatch');
      const member = bindings.get(node.id); if (!member) fail('Unbound interaction node');
      return { member, children: list(np('children'), 'node children').map(child => walk(child, node.id, depth + 1)) };
    }
    const eventNodes = list(tp('children'), 'tree children', 100).map(ref => walk(ref, tree.id, 0));
    if (seen.size !== bindings.size) fail('Unreachable interaction node-table entries');

    const literal = ref => {
      const object = local(ref, 'Axure:Expr:StringLiteral'), p = props(object, ['value','variable-identifiers','repeater-scope','TargetRepeaterScope']);
      if (list(p('variable-identifiers'), 'literal variable-identifiers').length) fail('Unsupported literal variable bindings');
      zeroReference(p('repeater-scope'), 'literal repeater-scope'); zeroReference(p('TargetRepeaterScope'), 'literal TargetRepeaterScope');
      return string(p('value'), 'StringLiteral value');
    };
    const target = (ref, allowThis = false) => {
      const object = local(ref, 'Axure:DiagramObjectPath'), p = props(object, ['rdo-path','repeater-path','object-id','is-dummy']);
      if (list(p('rdo-path'), 'rdo-path').length || list(p('repeater-path'), 'repeater-path').length || p('is-dummy') !== false) fail('Unsupported compound or dummy widget path');
      let id = reference(p('object-id'), 22, 'widget target');
      if (id === ZERO) {
        if (owner.type === 'Axure:DiagramObject:Hyperlink') fail('Hyperlink This target semantics are not established');
        // CIL IxAction.KN8A resolves the zero sentinel to ThisObject; the Tab
        // sample witnesses it in SetCheckState. Keep other action paths narrow.
        if (!allowThis || objects.get(owner.id) !== owner || !owner.type.startsWith('Axure:DiagramObject:')) fail('Unsupported This widget target');
        id = owner.id;
      }
      const widget = objects.get(id);
      if (!widget?.type.startsWith('Axure:DiagramObject:')) fail(`Widget target ${id} is not local to package ${packageId}`);
      return id;
    };
    const motionTarget = ref => {
      const path=local(ref,'Axure:DiagramObjectPath'), raw=property(path.properties,'object-id');
      const sourceId=target(ref,true);
      // Do not replace This with an ordinary identity: it is an event context.
      return reference(raw,22,'motion widget target')===ZERO?{kind:'this'}:{kind:'widget',sourceId};
    };
    const motionExpression = (ref, direction = false) => {
      const object=local(ref,direction?'Axure:Expr:BoundaryDirectionLiteral':'Axure:Expr:StringLiteral');
      const p=props(object,['value','variable-identifiers','scope','repeater-scope','TargetRepeaterScope',...(direction?['boundaryDirection']:[])]);
      zeroReference(p('repeater-scope'),'motion repeater-scope');zeroReference(p('TargetRepeaterScope'),'motion TargetRepeaterScope');
      const text=string(p('value'),'motion StringLiteral value',4100), scope=p('scope');
      if(scope!==undefined&&(!scope||Array.isArray(scope)||Object.keys(scope).length!==1||!Object.hasOwn(scope,'$map')))fail('Invalid motion scope map');
      const entries=scope===undefined?[]:list(scope.$map,'motion local scope',128), bindings=new Map();
      for(const pair of entries){
        if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||pair[0].length>128||!/^[A-Za-z][A-Za-z0-9_]*$/.test(pair[0]))fail('Invalid motion local alias');
        const name=pair[0].toLowerCase();if(bindings.has(name)||MOTION_BUILTINS.includes(name)||['constructor','prototype','__proto__'].includes(name))fail('Duplicate or reserved motion local alias');
        const call=local(pair[1],'Axure:Expr:FCall'),cp=props(call,['function-name','args']),args=list(cp('args'),'motion GetWidget args');
        if(cp('function-name')!=='GetWidget'||args.length!==1)fail('Motion binding requires exactly GetWidget(one path)');
        const path=local(args[0],'Axure:Expr:DiagramObjectPathLiteral'),lp=props(path,['value']);
        bindings.set(name,{kind:'widget',targetSourceId:target(lp('value'))});
      }
      const expected=motionSyntax(text,bindings).sort(), actual=[], ids=new Set(), storedIds=new Set();
      if(expected.includes('this')&&(owner.type==='Axure:DiagramObject:Hyperlink'||!owner.type.startsWith('Axure:DiagramObject:')))fail('Motion This expression requires an ordinary widget owner');
      for(const r of list(p('variable-identifiers'),'motion variable-identifiers',256)){
        const o=local(r,'Axure:Expr:TextVariableIdentifier'),ip=props(o,['Id','Name','Expr','TargetOverride']);
        const id=ip('Id');if(!id||Object.keys(id).length!==1||typeof id.$guid!=='string'||!GUID.test(id.$guid)||id.$guid===ZERO||storedIds.has(id.$guid)||ids.has(o.id))fail('Invalid or duplicate motion variable identity');
        storedIds.add(id.$guid);ids.add(o.id);
        const name=string(ip('Name'),'motion variable name',128).toLowerCase();
        if(!MOTION_BUILTINS.includes(name)||reference(ip('Expr'),3,'motion variable expression')!==object.id||ip('TargetOverride')!==false)fail('Unsupported motion variable binding');
        actual.push(name);
      }
      if(JSON.stringify(actual.sort())!==JSON.stringify(expected))fail('Motion variable identities do not match the expression');
      return {text,...(bindings.size?{bindings:Object.fromEntries(bindings)}:{})};
    };
    const motionBoundary = ref => {
      if(reference(ref,3,'motion boundary')===ZERO)return undefined;
      const seen=new Set();
      function visit(r,depth){
        if(depth>32||seen.size>=100)fail('Motion boundary depth/node limit');
        const o=local(r,'Axure:Expr:BinaryExpr');if(seen.has(o.id))fail('Repeated or cyclic motion boundary');seen.add(o.id);
        const p=props(o,['left-expr','right-expr','operation']),operation=p('operation');
        if(operation===1||operation===2)return{kind:operation===1?'and':'or',left:visit(p('left-expr'),depth+1),right:visit(p('right-expr'),depth+1)};
        const operator=new Map([[5,'>'],[6,'<'],[7,'>='],[8,'<=']]).get(operation);if(!operator)fail('Unsupported motion boundary comparison');
        const leftObject=local(p('left-expr'),'Axure:Expr:BoundaryDirectionLiteral'),direction=property(leftObject.properties,'boundaryDirection');
        if(!['left','right','top','bottom'].includes(direction))fail('Unsupported motion boundary direction');
        return{kind:'compare',operator,direction,left:motionExpression(p('left-expr'),true),right:motionExpression(p('right-expr'))};
      }
      return visit(ref,0);
    };
    const condition = ref => {
      if (reference(ref, 3, 'condition') === ZERO) return { conditionMode: 'all', conditions: [] };
      let junction;
      const conditions = [], seenExpressions = new Set();
      function visit(ref, depth) {
        if (depth > 32 || conditions.length >= 100) fail('Condition depth/leaf limit');
        const object = local(ref, 'Axure:Expr:BinaryExpr');
        if (seenExpressions.has(object.id)) fail('Repeated or cyclic condition expression');
        seenExpressions.add(object.id);
        const p = props(object, ['left-expr','right-expr','operation']), operation = p('operation');
        if (operation === 1 || operation === 2) {
          if (junction !== undefined && junction !== operation) fail('Unsupported mixed AND/OR condition');
          junction = operation; visit(p('left-expr'), depth + 1); visit(p('right-expr'), depth + 1); return;
        }
        const operator = COMPARISONS.get(operation); if (!operator) fail(`Unsupported condition comparison ${operation}`);
        const call = local(p('left-expr'), 'Axure:Expr:FCall'), cp = props(call, ['function-name','args']);
        const functionName = cp('function-name');
        if (!['GetWidgetText','GetSelectedOption'].includes(functionName)) fail(`Unsupported condition function ${functionName}`);
        const args = list(cp('args'), `${functionName} args`); if (args.length !== 1) fail(`${functionName} requires one argument`);
        const pathLiteral = local(args[0], 'Axure:Expr:DiagramObjectPathLiteral'), lp = props(pathLiteral, ['value']);
        // Eight shipped Subject Droplist conditions use the zero/This path.
        const targetSourceId = target(lp('value'), functionName === 'GetSelectedOption');
        if (functionName === 'GetSelectedOption' && !['Axure:DiagramObject:ComboBox','Axure:DiagramObject:ListBox'].includes(objects.get(targetSourceId).type)) fail('GetSelectedOption target is not a native select');
        const right = local(p('right-expr'));
        let value;
        if (functionName === 'GetSelectedOption' && right.type === 'Axure:Expr:OptionLiteral') {
          const rp = props(right, ['Option']), option = local(rp('Option'), 'Axure:SelectObject'), op = props(option, ['object','selected']);
          bool(op('selected'), 'OptionLiteral selected');
          // OptionLiteral.get_TextValue -> Option.ltft; only its literal string branch.
          value = string(op('object'), 'OptionLiteral object', 2000);
        } else value = literal(p('right-expr'));
        conditions.push({ source: functionName === 'GetSelectedOption' ? 'selectedOption' : 'widgetText', targetSourceId, operator, value, comparisonMode:'axure' });
      }
      visit(ref, 0);
      return { conditionMode: junction === 2 ? 'any' : 'all', conditions };
    };
    const passiveNumber = (p, key) => { if (!Number.isFinite(p(key)) || p(key) < 0 || p(key) > 60000) fail(`Invalid ${key}`); };
    const requireValues = (p, fields) => { for (const [key, expected] of Object.entries(fields)) if (p(key) !== expected) fail(`Unsupported active option ${key}`); };
    const fadeInfo = ref => {
      const info = local(ref, 'Axure:FadeWidgetInfo'), p = props(info, ['duration','fade-action-type','easing','DurationHide','EasingHide','BringToFront','show-type','compress-easing','compress-duration','compress-distance-type','custom-compress-value','page-background','page-background-blur','animation-hide','animation-show','scale','scale-hide','scale-anchor','scale-hide-anchor']);
      requireValues(p, { easing:0, EasingHide:0, BringToFront:false, 'show-type':0, 'compress-easing':0, 'compress-distance-type':0, 'page-background':0, 'animation-hide':0, 'animation-show':0, scale:0, 'scale-hide':0, 'scale-anchor':'center', 'scale-hide-anchor':'center' });
      for (const key of ['duration','DurationHide','compress-duration']) passiveNumber(p, key);
      const blur = p('page-background-blur');
      if (property(blur, 'On') !== false) fail('Unsupported background blur');
      if (literal(p('custom-compress-value')) !== '') fail('Unsupported custom compression expression');
      const mode = p('fade-action-type');
      if (!Number.isInteger(mode) || mode < 0 || mode > 2) fail('Unknown fade-action-type');
      const type = ['hide','show','toggle'][mode];
      return { type };
    };
    const panelInfo = ref => {
      const info = local(ref, 'Axure:SetPanelStateInfo'), p = props(info, ['set-state-type','diagram-id','state-value','loop','show-when-set','compress','compress-easing','compress-duration','vertical','custom-compress-value','compress-distance-type','exit-easing','exit-duration','enter-easing','enter-duration','repeat','repeat-interval','repeat-skip-first','animation-enter','animation-exit','enter-scale','enter-anchor','exit-scale','exit-anchor']);
      requireValues(p, { loop:false, 'show-when-set':false, compress:false, 'compress-easing':0, 'compress-duration':0, vertical:false, 'compress-distance-type':0, 'exit-easing':0, 'enter-easing':0, repeat:false, 'repeat-skip-first':true, 'animation-enter':0, 'animation-exit':0, 'enter-scale':0, 'enter-anchor':'center', 'exit-scale':0, 'exit-anchor':'center' });
      for (const key of ['exit-duration','enter-duration','repeat-interval']) passiveNumber(p, key);
      if (literal(p('custom-compress-value')) !== '') fail('Unsupported panel compression expression');
      literal(p('state-value')); // Validate the stored inactive fallback; Diagram mode uses diagram-id.
      if (p('set-state-type') !== 0) fail(`Unsupported unwitnessed panel state mode ${p('set-state-type')}`);
      const id = reference(p('diagram-id'), 22, 'panel state package'); if (id === ZERO) fail('Missing panel state package');
      return { type:'setState', targetPackageId:id };
    };
    const action = node => {
      if (node.children.length) fail('Action node has unexpected children');
      const object = node.member, p = props(object);
      if (bool(p('Disabled'), 'action Disabled')) fail('Disabled action cannot be represented without losing its editable state');
      if(object.type==='Axure:InteractionMoveWidgetAction'||object.type==='Axure:InteractionSetWidgetSizeAction'){
        const move=object.type==='Axure:InteractionMoveWidgetAction',infoKey=move?'MoveInfos':'SetSizeInfos';
        props(object,['Disabled','panelobjectpaths','WidgetPaths',infoKey]);
        const paths=list(p('WidgetPaths'),'motion WidgetPaths',200),infos=list(p(infoKey),infoKey,200),legacy=list(p('panelobjectpaths'),'motion panelobjectpaths',200);
        if(!paths.length||paths.length!==infos.length||paths.length!==legacy.length||paths.some((r,i)=>reference(r,3,'WidgetPaths')!==reference(legacy[i],3,'panelobjectpaths')))fail('Mismatched motion target/settings arrays');
        const targets=paths.map((path,index)=>{
          const target=motionTarget(path),info=local(infos[index],move?'Axure:MoveWidgetInfo':'Axure:SetWidgetSizeInfo');
          const ip=props(info,move?['Duration','Easing','XValue','YValue','MoveType','MoveTrajectory','BoundaryCondition','scope']:['width','height','anchor','easing','duration']);
          const e=ip(move?'Easing':'easing'),durationKey=move?'Duration':'duration';
          if(!Number.isInteger(e)||!ROTATE_EASINGS[e])fail('Unsupported motion easing');passiveNumber(ip,durationKey);
          const common={easing:ROTATE_EASINGS[e],duration:ip(durationKey)};
          if(!move){const anchor=ip('anchor');if(!ROTATE_ANCHORS.includes(anchor))fail('Unsupported Size anchor');return{target,width:motionExpression(ip('width')),height:motionExpression(ip('height')),anchor,...common};}
          const m=ip('MoveType'),t=ip('MoveTrajectory');if(!Number.isInteger(m)||!MOVE_MODES[m]||!Number.isInteger(t)||!MOVE_TRAJECTORIES[t])fail('Unsupported Move mode or trajectory');
          // MoveInfo.scope is generator scratch state, distinct from the local
          // scope stored on each StringLiteral. No nonempty saved witness exists.
          const scope=ip('scope');if(!scope||Array.isArray(scope)||Object.keys(scope).length!==1||!Object.hasOwn(scope,'$map')||list(scope.$map,'MoveInfo scope').length)fail('Unsupported or invalid MoveInfo scope');
          const boundary=motionBoundary(ip('BoundaryCondition'));
          return{target,mode:MOVE_MODES[m],x:motionExpression(ip('XValue')),y:motionExpression(ip('YValue')),trajectory:MOVE_TRAJECTORIES[t],...common,...(boundary?{boundary}:{})};
        });
        return[{sourceId:object.id,type:move?'move':'resize',[move?'move':'resize']:{targets}}];
      }
      if (object.type === 'Axure:InteractionRotateWidgetAction') {
        props(object, ['Disabled','panelobjectpaths','Paths','Infos']);
        const paths=list(p('Paths'),'Rotate Paths',200), infos=list(p('Infos'),'Rotate Infos',200), legacy=list(p('panelobjectpaths'),'panelobjectpaths',200);
        if (!paths.length || paths.length!==infos.length || paths.length!==legacy.length || paths.some((ref,i)=>reference(ref,3,'Paths')!==reference(legacy[i],3,'panelobjectpaths'))) fail('Mismatched Rotate target/settings arrays');
        const seen=new Set();
        return paths.map((path,index)=>{
          // Two shipped UI Load actions witness zero/This for Rotate itself.
          const targetSourceId=target(path,true), nativeType=objects.get(targetSourceId).type;
          if (seen.has(targetSourceId)) fail('Duplicate Rotate target'); seen.add(targetSourceId);
          if (!ROTATE_TARGETS.some(type=>nativeType===`Axure:DiagramObject:${type}`)) fail(`Unsupported Rotate target type ${nativeType}`);
          const info=local(infos[index],'Axure:RotateWidgetInfo'), ip=props(info,['Clockwise','Duration','Degree','RotateType','Easing','OffsetX','OffsetY','Anchor']);
          const mode=ip('RotateType'), easing=ip('Easing'), anchor=ip('Anchor');
          if (mode!==0 && mode!==1) fail('Unsupported RotateType');
          if (!Number.isInteger(easing) || !ROTATE_EASINGS[easing]) fail('Unsupported Rotate Easing');
          if (!ROTATE_ANCHORS.includes(anchor)) fail('Unsupported Rotate Anchor');
          passiveNumber(ip,'Duration');
          const numeric=key=>{const value=literal(ip(key));if(!/^[\s]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\s]*$/.test(value)||!Number.isFinite(Number(value)))fail(`Unsupported Rotate ${key} expression or numeric literal`);return value;};
          return {sourceId:object.id,type:'rotate',targetSourceId,rotate:{mode:mode===0?'to':'by',degrees:numeric('Degree'),clockwise:bool(ip('Clockwise'),'Clockwise'),anchor,offsetX:numeric('OffsetX'),offsetY:numeric('OffsetY'),easing:ROTATE_EASINGS[easing],duration:ip('Duration')}};
        });
      }
      if (object.type === 'Axure:InteractionSetAdaptiveView') {
        const ap = props(object, ['Disabled','set_adaptive_view_id','set_adaptive_view_to_auto']);
        const value = ap('set_adaptive_view_id');
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, '$guid') || typeof value.$guid !== 'string' || !GUID.test(value.$guid)) fail('Invalid adaptive view GUID');
        const auto = bool(ap('set_adaptive_view_to_auto'), 'adaptive view auto');
        // IxSetAdaptiveViewAction reader/writer 100705052/51 and getter
        // 100705050: the bool takes precedence, and Base is not Guid.Empty.
        // Named/zero/unresolved GUIDs belong to the importing Page's set. Do
        // not guess generated ordinal IDs or drop a terminal runtime action.
        const adaptiveView = auto ? { kind:'auto' } : value.$guid === ADAPTIVE_BASE ? { kind:'base' } : { kind:'nativeGuid', guid:value.$guid };
        return [{ sourceId:object.id, type:'setAdaptiveView', adaptiveView }];
      }
      if (object.type === 'Axure:InteractionSetFocusOnWidgetAction') {
        props(object, ['Disabled', 'panelobjectpaths', 'SelectTextOnFocus']);
        const paths = list(p('panelobjectpaths'), 'focus panelobjectpaths', 200);
        if (paths.length !== 1) fail('SetFocus recovery requires exactly one complete target path');
        const targetSourceId = target(paths[0], true), targetType = objects.get(targetSourceId).type;
        if (!['Axure:DiagramObject:TextBox', 'Axure:DiagramObject:TextArea','Axure:DiagramObject:ComboBox','Axure:DiagramObject:ListBox'].includes(targetType)) fail('SetFocus target is not a supported form control');
        return [{ sourceId: object.id, type: 'setFocus', targetSourceId, selectText: bool(p('SelectTextOnFocus'), 'SelectTextOnFocus') }];
      }
      if (object.type === 'Axure:InteractionLinkWindowAction') {
        props(object, ['Disabled','target','link-type']);
        const windowMode = p('link-type');
        if (![1,2].includes(windowMode)) fail(`Unsupported link window mode ${windowMode}`);
        const destination = local(p('target'), 'Axure:InteractionTarget'), dp = props(destination, ['target-type','target-page-id','target-literal']);
        if (dp('target-type') === 0) {
          const page = dp('target-page-id');
          zeroReference(page, 'external URL page', 19);
          if (page.name !== 'Axure:Page') fail('Unknown external URL inactive page type');
          const value = literal(dp('target-literal'));
          if (value.length > 4096 || value !== value.trim() || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value) || value.includes('[[')) fail('External URL must be literal HTTP(S)');
          let url; try { url = new URL(value); } catch { fail('Invalid external URL'); }
          if (!url.hostname || url.username || url.password) fail('External URL must have a host without credentials');
          return [{sourceId:object.id,type:'openUrl',value,windowTarget:windowMode===1?'current':'new'}];
        }
        if (windowMode !== 1) fail('Unsupported link window mode: new-window native page navigation is not mapped');
        if (dp('target-type') !== 1) fail(`Unsupported link target type ${dp('target-type')}`);
        const ref = dp('target-page-id'), id = reference(ref, 19, 'page package');
        if (ref.name !== 'Axure:Page' || id === ZERO) fail('Invalid destination Page package');
        literal(dp('target-literal'));
        return [{ sourceId:object.id, type:'openPage', targetPackageId:id }];
      }
      if (object.type === 'Axure:InterationActionSetFunction') {
        props(object, ['Disabled','action','SetFunction']);
        const functionName = p('SetFunction'), error = functionName === 'SetErrorState';
        if (!error && functionName !== 'SetCheckState') fail(`Unsupported SetFunction ${functionName}`);
        const block = local(p('action'), 'Axure:Expr:Block'), bp = props(block, ['subexpressions']);
        const calls = list(bp('subexpressions'), `${functionName} block`, 200);
        if (!calls.length) fail(`Empty ${functionName} block`);
        return calls.map(ref => {
          const call = local(ref, 'Axure:Expr:FCall'), cp = props(call, ['function-name','args']);
          if (cp('function-name') !== functionName) fail(`Unsupported ${functionName} block function ${cp('function-name')}`);
          const args = list(cp('args'), `${functionName} args`);
          if (args.length !== 2) fail(`${functionName} requires two arguments`);
          const path = local(args[0], 'Axure:Expr:DiagramObjectPathLiteral'), pp = props(path, ['value']);
          const targetSourceId = target(pp('value'), true), widgetType = objects.get(targetSourceId).type;
          // Native panels/layers propagate selection into their children and
          // tree nodes have their own selection engine. Neither is represented
          // by the current normalized ordinary-widget action.
          const supported = error ? ['VectorShape','ImageBox','TextBox','TextArea','CheckBox','RadioButton','ComboBox','ListBox','DynamicPanel','Layer'] : ['VectorShape','ImageBox','TextBox','CheckBox','RadioButton'];
          if (!supported.some(type => widgetType === `Axure:DiagramObject:${type}`)) fail(`Unsupported ${functionName} widget type ${widgetType}`);
          const value = literal(args[1]);
          if (!['true','false','toggle'].includes(value)) fail(`Unsupported ${functionName} literal ${JSON.stringify(value)}`);
          return { sourceId:object.id, type:error?'setError':'setSelected', targetSourceId, value };
        });
      }
      const fade = object.type === 'Axure:InteractionFadeWidgetAction', panel = object.type === 'Axure:InteractionSetPanelStateAction';
      if (!fade && !panel) fail(`Unsupported action type ${object.type}`);
      const pathsKey = fade ? 'WidgetPaths' : 'PanelPaths', infosKey = fade ? 'FadeInfos' : 'SetStateInfos';
      props(object, ['Disabled','panelobjectpaths',pathsKey,infosKey]);
      const paths = list(p(pathsKey), pathsKey, 200), infos = list(p(infosKey), infosKey, 200), legacy = list(p('panelobjectpaths'), 'panelobjectpaths', 200);
      if (!paths.length || paths.length !== infos.length || paths.length !== legacy.length || paths.some((ref,i)=>reference(ref,3,pathsKey)!==reference(legacy[i],3,'panelobjectpaths'))) fail('Mismatched action target/settings arrays');
      return paths.map((path, index) => {
        const targetSourceId = target(path);
        if (panel && objects.get(targetSourceId).type !== 'Axure:DiagramObject:DynamicPanel') fail('SetPanelState target is not a DynamicPanel');
        const value = fade ? fadeInfo(infos[index]) : panelInfo(infos[index]);
        if (panel && !list(property(objects.get(targetSourceId).properties,'panel-diagrams'),'target panel states').some(ref=>ref?.referenceTag===19 && ref.name==='Axure:PanelState' && ref.$reference===value.targetPackageId)) fail('Requested state does not belong to the target panel');
        return { sourceId:object.id, targetSourceId, ...value };
      });
    };
    return { status:'decoded-interaction-tree', events:eventNodes.map(node => {
      const object = node.member;
      let nativeEventType;
      try {
        if (object.type !== 'Axure:InteractionEvent') fail(`Tree root member is ${object.type}, not an InteractionEvent`);
        const p = props(object, ['Disabled','event-type','master-containing-raised-event','raised-event-id','variable-id']);
        nativeEventType = p('event-type'); const event = EVENTS.get(nativeEventType); if (!event) fail(`Unsupported native event type ${nativeEventType}`);
        if (nativeEventType === 338 && owner.type !== 'Axure:Page') fail('OnAdaptiveViewChange is supported only on a Page owner');
        if (nativeEventType === 279 && !ROTATE_TARGETS.some(type=>owner.type===`Axure:DiagramObject:${type}`)) fail('OnRotate requires a supported native rotating widget owner');
        const disabled = bool(p('Disabled'), 'event Disabled');
        zeroReference(p('master-containing-raised-event'), 'master-containing-raised-event', 16);
        zeroGuid(p('raised-event-id'), 'raised-event-id'); zeroGuid(p('variable-id'), 'event variable-id');
        const cases = node.children.map(c => {
          if (c.member.type !== 'Axure:InteractionCase') fail(`Event contains ${c.member.type}, not an InteractionCase`);
          const cp = props(c.member, ['Disabled','Description','Condition','IsNewIfGroup']);
          const caseDisabled = bool(cp('Disabled'), 'case Disabled');
          const actions = c.children.flatMap(action); if (actions.length > 200) fail('Flattened action count exceeds 200');
          return { id:c.member.id, name:string(cp('Description'),'case Description',200), enabled:!disabled&&!caseDisabled, isNewIfGroup:bool(cp('IsNewIfGroup'),'IsNewIfGroup'), ...condition(cp('Condition')), actions };
        });
        return { status:'supported-event', id:object.id, nativeEventType, event, cases };
      } catch (error) { return { status:'unsupported-event', id:object.id, ...(nativeEventType===undefined?{}:{nativeEventType}), reason:error.message }; }
    }) };
  } catch (error) { return { status:'unsupported-interaction-tree', reason:error.message, events:[] }; }
}
