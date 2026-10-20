import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import type { Condition, Interaction } from '../src/model/types';

const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
const read = (name: string) => JSON.parse(execFileSync(process.execPath, [script, fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const required = read('complex-interactions-required-fields.rp');
const signup = (source: typeof required) => source.diagrams[0].widgets.find((w: { text?: { text?: string } }) => w.text?.text === 'Sign Up');
const click = (source: typeof required) => signup(source).interactionRecovery.events[0];

describe('native RP interaction conversion', () => {
  it('recovers complete Required Fields events, password, variables and Case Behavior; survives serialization', async () => {
    const before = JSON.stringify(required), { document, report } = importRpSemantics(required);
    expect(JSON.stringify(required)).toBe(before);
    expect(report).toMatchObject({ widgetsImported: 7, widgetsSkipped: 0, eventsImported: 3, eventsSkipped: 0, casesImported: 4, actionsImported: 4, variablesImported: 1, interactionTreesSkipped: 0 });
    expect(document.variables).toEqual({ OnLoadVariable: '' }); expect(document.caseSelection).toBe('auto');
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    const page = document.pages[0], email = page.widgets.find(w => w.name === 'Email Field')!, password = page.widgets.find(w => w.name === 'Password Field')!, error = page.widgets.find(w => w.name === 'Error Message')!, button = page.widgets.find(w => w.text === 'Sign Up')!;
    expect(password.inputType).toBe('password');
    expect(button.interactions.map(i => [i.name, i.isNewIfGroup])).toEqual([['Successful Signup', false], ['Unsuccessful Signup', false]]);
    expect(button.interactions[0].conditions).toEqual([email, password].map(w => ({ source: 'widgetText', key: w.id, operator: 'notEquals', value: '', comparisonMode: 'axure' })));
    const runtime = createOfflineRuntime(document); await runtime.start();
    try {
      await runtime.trigger(button.id, 'click'); expect(runtime.state().widgetOverrides[error.id]?.hidden).toBe(false);
      await runtime.trigger(email.id, 'focus'); expect(runtime.state().widgetOverrides[error.id]?.hidden).toBe(true);
      runtime.input(email.id, 'valid@example.test'); runtime.input(password.id, 'FaLsE');
      await runtime.trigger(button.id, 'click'); expect(runtime.state().pageId).toBe(page.id); expect(runtime.state().widgetOverrides[error.id]?.hidden).toBe(false);
      await runtime.trigger(password.id, 'focus'); expect(runtime.state().widgetOverrides[error.id]?.hidden).toBe(true);
      runtime.input(password.id, 'secret'); await runtime.trigger(button.id, 'click');
      expect(runtime.state().pageId).toBe(document.pages[1].id); expect(runtime.state().caseMenus ?? []).toEqual([]);
    } finally { runtime.dispose(); }
  });

  it('drops an entire IF/ELSE event on a missing target, unknown action, condition or absent comparison mode', () => {
    const mutations = [
      (s: typeof required) => { click(s).cases[1].actions[0].targetSourceId = 'f'.repeat(32); },
      (s: typeof required) => { click(s).cases[1].actions.push({ sourceId: 'f'.repeat(32), type: 'runScript' }); },
      (s: typeof required) => { click(s).cases[0].conditions[0].operator = 'greater'; },
      (s: typeof required) => { click(s).cases[0].conditions[0].targetSourceId = signup(s).id; },
      (s: typeof required) => { delete click(s).cases[0].conditions[0].comparisonMode; },
      (s: typeof required) => { click(s).cases[0].conditions[0].value = '[[OnLoadVariable]]'; },
      (s: typeof required) => { click(s).cases[1].enabled = undefined; },
      (s: typeof required) => { click(s).cases[0].actions[0].targetPackageId = 'f'.repeat(32); },
    ];
    for (const mutate of mutations) {
      const source = structuredClone(required); mutate(source);
      const result = importRpSemantics(source);
      expect(result.report).toMatchObject({ eventsImported: 2, eventsSkipped: 1, casesImported: 2, actionsImported: 2 });
      expect(result.document.pages[0].widgets.find(w => w.text === 'Sign Up')?.interactions).toEqual([]);
      expect(result.report.issues.filter(i => i.code === 'interaction-event-skipped')).toHaveLength(1);
    }
  });

  it('does not bind a missing target to a same-ID object in another package or an ambiguous local duplicate', () => {
    for (const duplicate of [false, true]) {
      const source = structuredClone(required), input = source.diagrams[0].widgets.find((w: { label: string }) => w.label === 'Password Field');
      if (duplicate) source.diagrams[0].widgets.push(structuredClone(input));
      else { source.diagrams[0].widgets = source.diagrams[0].widgets.filter((w: { id: string }) => w.id !== input.id); source.diagrams[1].widgets.push(input); }
      const result = importRpSemantics(source);
      expect(result.document.pages[0].widgets.find(w => w.text === 'Sign Up')?.interactions).toEqual([]);
      expect(result.report.eventsSkipped).toBeGreaterThan(0);
    }
  });

  it('requires known Case Behavior and validates the complete variable collection without partial writes', () => {
    let source = structuredClone(required); source.documentSettingsRecovery.caseSelection.sourceValue = 'UnwitnessedString';
    let result = importRpSemantics(source); expect(result.document.caseSelection).toBeUndefined(); expect(result.report).toMatchObject({ eventsImported: 0, eventsSkipped: 3 });
    for (const invalid of ['constructor', 'onloadvariable', '\u0000bad']) {
      source = structuredClone(required); source.documentSettingsRecovery.variables.variables.push({ id: 'f'.repeat(32), name: invalid, value: 'x' });
      result = importRpSemantics(source); expect(result.document.variables).toEqual({}); expect(result.report.variablesImported).toBe(0);
    }
  });

  it('rejects package identity collisions across Page and PanelState before any target map can overwrite a widget', () => {
    const source = structuredClone(required), collision = structuredClone(source.diagrams[1]);
    collision.rootType = 'Axure:PanelState'; collision.name = 'State sharing a page package identity';
    source.diagrams.push(collision);
    expect(() => importRpSemantics(source)).toThrow(/重复的页面或面板状态包标识/);
  });

  it('rejects malformed whole trees and over-limit cases without leaking partial events', () => {
    let source = structuredClone(required); signup(source).interactionRecovery.events.push(structuredClone(click(source)));
    let result = importRpSemantics(source); expect(result.report.interactionTreesSkipped).toBe(1); expect(result.document.pages[0].widgets.find(w => w.text === 'Sign Up')?.interactions).toEqual([]);
    source = structuredClone(required); click(source).cases = Array(101).fill(click(source).cases[0]);
    result = importRpSemantics(source); expect(result.report.eventsSkipped).toBe(1); expect(result.report.eventsImported).toBe(2);
  });

  it('retains disabled cases and ordered multi-target actions with distinct generated IDs', () => {
    const source = structuredClone(required); click(source).cases[0].enabled = false;
    click(source).cases[1].actions.push(structuredClone(click(source).cases[1].actions[0]));
    const { document } = importRpSemantics(source), cases = document.pages[0].widgets.find(w => w.text === 'Sign Up')!.interactions;
    expect(cases[0].enabled).toBe(false); expect(cases[1].actions).toHaveLength(2);
    expect(cases[1].actions[0].id).not.toBe(cases[1].actions[1].id);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it('preserves UX page links scoped by package even when native widget/event IDs are reused', async () => {
    const { document, report } = importRpSemantics(read('UX Prototyping.rp'));
    const links = document.pages.flatMap(p => p.widgets.filter(w => w.interactions.some(i => i.actions.some(a => a.type === 'openPage'))).map(w => ({ page: p, widget: w })));
    expect(links).toHaveLength(6);
    expect(report).toMatchObject({ eventsImported: 6, eventsSkipped: 9, casesImported: 6, actionsImported: 6, variablesImported: 1 });
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    for (const { page, widget } of links) {
      const runtime = createOfflineRuntime(document, page.id); await runtime.start();
      try { await runtime.trigger(widget.id, 'click'); expect(runtime.state().pageId).toBe(widget.interactions[0].actions[0].targetId); }
      finally { runtime.dispose(); }
    }
  });

  it('recovers both Tab Menu actions, separate selected styles and inherited child coordinates', async () => {
    const { document, report } = importRpSemantics(read('the-basics-tab-menu.rp'));
    expect(report).toMatchObject({ eventsImported: 2, eventsSkipped: 0, casesImported: 2, actionsImported: 4, widgetsImported: 3, widgetsSkipped: 0, nestedWidgetsImported: 2 });
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    const [a,b,panel] = document.pages[0].widgets, runtime = createOfflineRuntime(document);
    expect(runtime.widget(a).style.fill).toBe('#81d3f8'); expect(a.style.fill).toBe('#ffffff');
    expect(runtime.widget(panel)).toMatchObject({width:300,height:170});
    await runtime.trigger(b.id, 'click'); expect(runtime.widget(panel).activeStateId).toBe(panel.states![1].id);
    expect(runtime.widget(a)).toMatchObject({selected:false,style:{fill:'#ffffff'}}); expect(runtime.widget(b)).toMatchObject({selected:true,style:{fill:'#81d3f8'}});
    await runtime.trigger(a.id, 'click'); expect(runtime.widget(panel).activeStateId).toBe(panel.states![0].id);
    expect(runtime.widget(a).selected).toBe(true); expect(runtime.widget(b).selected).toBe(false);
    expect(runtime.state().caseMenus ?? []).toEqual([]);
  });
  it('refuses partial fit panels, unknown inherited geometry and unrepresentable selected styles atomically', () => {
    for (const mutate of [
      (s: typeof required) => { s.diagrams.find((d: any)=>d.rootType==='Axure:PanelState').widgets[0].typeCandidate = null; },
      (s: typeof required) => { s.diagrams.find((d: any)=>d.rootType==='Axure:PanelState').widgets[0].styleRecovery.cacheChainComplete = false; },
      (s: typeof required) => { s.diagrams.find((d: any)=>d.rootType==='Axure:PanelState').widgets[0].styleRecovery.boundsRecovery.outerShadowAbsent = false; },
    ]) {
      const source = read('the-basics-tab-menu.rp'); mutate(source); const { document, report } = importRpSemantics(source);
      expect(document.pages[0].widgets.some(w=>w.type==='panel')).toBe(false);
      expect(document.pages[0].widgets.every(w=>w.interactions.length===0)).toBe(true);
      expect(report.eventsSkipped).toBe(2); expect(report.nestedWidgetsImported).toBe(0);
    }
    const source = read('the-basics-tab-menu.rp'), tabs = source.diagrams.find((d: any)=>d.rootType==='Axure:Page').widgets;
    tabs[0].selectionRecovery = {status:'unsupported-selection',reason:'Unknown selected shadow'};
    const result = importRpSemantics(source);
    expect(result.document.pages[0].widgets.every(w=>w.interactions.length===0)).toBe(true); expect(result.report.eventsSkipped).toBe(2);
  });
  it('rejects both group-dependent events when a source member is omitted, ambiguous or of unknown membership', () => {
    for (const mutation of ['omitted','ambiguous','unknown'] as const) {
      const source = read('the-basics-tab-menu.rp'), page = source.diagrams.find((d: any)=>d.rootType==='Axure:Page');
      if (mutation === 'omitted') page.widgets[0].typeCandidate = null;
      if (mutation === 'ambiguous') page.widgets.push(structuredClone(page.widgets[0]));
      if (mutation === 'unknown') page.widgets[0].selectionGroups = {status:'unknown-selection-groups'};
      const { document, report } = importRpSemantics(source);
      expect(document.pages[0].widgets.every(w=>w.interactions.length===0)).toBe(true);
      expect(report.eventsImported).toBe(0); expect(report.eventsSkipped).toBeGreaterThanOrEqual(2);
      expect(parseDocument(serializeDocument(document))).toEqual(document);
    }
  });
  it('audits implicit selection peers inside retained and rejected panel states', () => {
    for (const rejectPanel of [false,true]) {
      const source = read('the-basics-tab-menu.rp'), page = source.diagrams.find((d: any)=>d.rootType==='Axure:Page');
      for (const tab of page.widgets.slice(0,2)) tab.interactionRecovery.events[0].cases[0].actions = tab.interactionRecovery.events[0].cases[0].actions.filter((a: any)=>a.type==='setSelected');
      const child = source.diagrams.find((d: any)=>d.rootType==='Axure:PanelState').widgets[0];
      child.selectionGroups = {status:'known-selection-groups',selectionGroup:'Tab Control Group'};
      child.selectionRecovery = {status:'unsupported-selection',reason:'Unmapped member appearance'};
      if (rejectPanel) child.typeCandidate = null;
      const { document, report } = importRpSemantics(source);
      expect(document.pages[0].widgets.some(w=>w.type==='panel')).toBe(!rejectPanel);
      expect(report).toMatchObject({eventsImported:0,eventsSkipped:2});
      expect(report.issues.some(i=>i.code==='interaction-event-skipped'&&i.message.includes('选中组'))).toBe(true);
    }
  });
  it('keeps selection group audits scoped to the source page and group namespace', () => {
    for (const otherPage of [false,true]) {
      const source = read('the-basics-tab-menu.rp'), page = source.diagrams.find((d: any)=>d.rootType==='Axure:Page');
      const peer = structuredClone(page.widgets[0]); peer.id = 'f'.repeat(32); peer.typeCandidate = null; delete peer.interactionRecovery;
      if (otherPage) source.diagrams.push({...structuredClone(page),packageId:'e'.repeat(32),widgets:[peer]});
      else { peer.type = 'Axure:DiagramObject:RadioButton'; peer.selectionGroups = {status:'known-selection-groups',selectionGroup:'',radioGroup:'Tab Control Group'}; page.widgets.push(peer); }
      const { report } = importRpSemantics(source);
      expect(report).toMatchObject({eventsImported:2,eventsSkipped:0});
    }
  });
  it('rejects non-string selection values atomically and keeps the imported document serializable', () => {
    for (const value of [true,false,1,null,{},['true'],'TRUE']) {
      const source = read('the-basics-tab-menu.rp'), tab = source.diagrams.find((d: any)=>d.rootType==='Axure:Page').widgets[0];
      tab.interactionRecovery.events[0].cases[0].actions.find((a: any)=>a.type==='setSelected').value = value;
      const { document, report } = importRpSemantics(source);
      expect(report).toMatchObject({eventsImported:1,eventsSkipped:1});
      expect(document.pages[0].widgets[0].interactions).toEqual([]);
      expect(parseDocument(serializeDocument(document))).toEqual(document);
    }
  });
  it('recovers six real radio initial states/groups while retaining unsupported panel and animation diagnostics', () => {
    const { document, report } = importRpSemantics(read('Quick Win.rp'));
    const radios = document.pages.flatMap(p=>p.widgets).filter(w=>w.type==='radio');
    expect(radios.map(w=>[w.checked,w.radioGroup??''])).toEqual([[true,''],[false,''],[false,'Duration Radio Group'],[true,'Duration Radio Group'],[true,'Duration Moving'],[false,'Duration Moving']]);
    expect(report).toMatchObject({widgetsImported:35,widgetsSkipped:7,eventsImported:0,eventsSkipped:4});
    expect(document.pages.flatMap(p=>p.widgets).filter(w=>w.rotation!==0).map(w=>[w.id,w.rotation])).toEqual([['rp-w-c6428b5a8ae84f939ae7fb9ac0cddb61-d5ce2b2bc1164f779e7741c0c5b157ac',89.13596303062127],['rp-w-990b0f0c6fe44617900b184763aaff5b-e0ec8c4a97a64a7bb438c52361e183bb',89.13596303062127]]);
    expect(report.issues.some(i=>i.code==='widget-skipped'&&i.message.includes('自动文字尺寸'))).toBe(true);
  });
});

describe('string comparison mode recovered from native runtime evidence', () => {
  const samples: [string, string, boolean][] = [['false', '', true], ['FaLsE', '0', true], ['false', ' ', true], ['TRUE', '1', true], ['true', '01', true], ['true', 'true', true], ['false', 'true', false], ['0', '', false], ['01', '1', false], [' True ', 'true', false], ['ABC', 'abc', false], ['abc', 'abc', true], ['false', 'NaN', false]];
  it.each(samples)('compares %j and %j with native boolean-string coercion = %s while legacy mode stays literal', (left, right, equal) => {
    const doc = createDocument(), input = createWidget('input', 0, 0); input.text = left; doc.pages[0].widgets.push(input);
    const runtime = createOfflineRuntime(doc);
    const condition: Condition = { source: 'widgetText', key: input.id, operator: 'equals', value: right, comparisonMode: 'axure' };
    const interaction: Interaction = { id: 'test-case', name: 'test', event: 'click', enabled: true, conditionMode: 'all', conditions: [condition], actions: [] };
    try {
      expect(runtime.matches(interaction)).toBe(equal);
      condition.operator = 'notEquals'; expect(runtime.matches(interaction)).toBe(!equal);
      delete condition.comparisonMode; expect(runtime.matches(interaction)).toBe(left !== right);
    } finally { runtime.dispose(); }
  });
});
