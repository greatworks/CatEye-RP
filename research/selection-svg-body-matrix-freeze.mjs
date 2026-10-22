import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const probePath='research/selection-svg-body-matrix-probes.json',reproductionPath='research/selection-svg-body-matrix-reproduction.json';
const probe=JSON.parse(fs.readFileSync(probePath)),repro=JSON.parse(fs.readFileSync(reproductionPath));
assert.equal(probe.passed,18);assert.equal(probe.failed,0);assert.deepEqual(probe.results,repro.results);
const target='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const targetHash='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';assert.equal(sha(target),targetHash);
const baseline='research/selection-adaptive-verification.json';assert.equal(sha(baseline),'ff2b41d7ff4eef54e8acf46126ebb2347a84392082915d3d9e5c321d8e863a68');
const report=`# Selection SVG body matrix and graphics-state closure

Date: 2026-10-21. Scope: ordinary unrotated, no-shadow selection indicator, an initially empty graphics command list, and tJ0X's AHJC=true SVG mode. AxureRP11.dll 11.0.0.4150 SHA-256: ${targetHash}. **Only metadata/CIL was read and retained instructions were interpreted. The original DLL and GUI were never executed.** No product/tests/configuration or prior frozen artifacts were changed.

## Result

The isolated command/matrix/state chain is closed for this scope: **18/18 cases, 52 retained methods reached**, with an independent exclusive-output reproduction producing identical result/trace records. y5p9 records a positive global indicator-location translation; pHbZ evaluates that transform; aHb9/qHbu supply an equal negative origin translation. Their net matrix is identity. **Crop padding is absent from all inputs to this chain.** Neither a padding compensation translation nor a changed viewBox follows from these methods.

The matrix result is a contract for the path writer, not a claim that a complete native SVG or original pixels were generated in this probe. The paint agent independently owns M5do/I5dz path transforms and final group serialization; the parent owns the browser overflow/crop check.

## Matrix direction and representation

The native Wbe7 fields correspond to SVG matrix(a b c d e f) as:

| SVG component | Native field |
|---|---|
| a | qbMB |
| b | jbMr |
| c | ibMV |
| d | SbMF |
| e | TbMj |
| f | NbMb |

The matrix represents x'=a*x+c*y+e, y'=b*x+d*y+f. Wbe7.op_Multiply 100688897 calls abe0 100688896 and computes **left times right**, using column-vector composition. For example its e output is left.c*right.f + left.a*right.e + left.e. Its a output is left.c*right.b + left.a*right.a. These are interpreted native arithmetic instructions, not a substituted multiplication formula.

pHbZ 100723595 obtains bHJ5.XHJn, applies OfType<CHJ7> in source order, then Vb2m(identity, lambda). Lambda 100723618 computes acc * record.rHJh.GHSm. Thus the resulting path matrix is M1*M2*...*Mn. A noncommuting control with Scale(2,3) followed by Translate(5,7), with a non-transform record between them, yields [2,0,0,3,10,21]; this distinguishes the order from both reversed multiplication and an unfiltered fold.

For indicator origin O=(ix,iy) and initial identity graphics state:

- y5p9(gfx,O,1,NaN) -> pHbZ(gfx) = T(+ix,+iy).
- aHb9(gfx,O) sets VHJI=1 and BHJg=O.
- qHbu(gfx) = T(-ix,-iy) * CHJR. In the scoped unrotated case CHJR=I, so the wrapper is T(-ix,-iy).
- When a local path receives the command matrix and is nested inside the origin wrapper, finalMatrix = wrapper * pathMatrix = T(-O)*T(+O)=I.

Therefore the downstream writer must combine these as outer * inner; it must not apply the positive translation twice. Padding and crop dimensions do not participate in these equations. The b14/b18, stroke0/1/3 and left/right cases reuse logical origins from the already closed selection placement evidence; width/stroke/padding are annotations in this matrix probe, not additional matrix arguments. The completed path writer must still confirm that its path transform is this pHbZ matrix and its wrapper is this qHbu matrix before asserting a full exported body placement.

## Construction, filtering and state lifecycle

- y5p9 100720505 calls gfx.Save at IL207, calls virtual h3j1(point) at IL251 only when point differs from zero, optionally applies opacity/rotation, and returns a scope holding the TrapSave callback. A NaN rotation skips W3j5. With AHJC=true, dHbV.SetOpacity returns immediately through B3FT; no opacity grouping record is created.
- dHbV.h3j1 100723593 constructs CHSU 100723776 and passes it to KHbO 100723583. CHSU stores the point in BHS4 and GHSm=Ubem(x,y). KHbO creates CHJ7 100723628, assigns its rHJh to that transform and appends it to the current XHJn list. The coordinate fields remain the positive global indicator location.
- Generic Wbi3 specification 721424779 resolves to method 100689072. Its actual iterator is <OfType>d__4, with MoveNext 100689490. The iterator is replayed, including filtering, yield/resume and source-order traversal; it is not replaced with a JavaScript filter.
- Generic Vb2m specification 721424780 resolves to method 100689169. Its actual enumerator loop and callback invocation are replayed. The matrix lambda 100723618 and all Wbe7 setters/getters/identity/translation/multiplication are replayed as retained instructions.
- Save 100723581 calls bHJZ.Copy 100723638. Copy constructs a new bHJZ and a new list from XHJn. This is a shallow list copy: command object references are preserved, but a later append to the active list does not change the saved list. The probe asserts the original saved list stays empty after an ordinary translation.
- TrapSave callback 100720599 calls virtual B3Fo with the saved state. dHbV.B3Fo 100723579 invokes JHbU first, assigns bHJ5 to the saved state, and clears cached QHJ6.u1b9. Its no-opacity branch is replayed through the actual NotIn iterator and OfType<nHJa>; it finds no opacity records and requires no XML group operation. Nested saves restore T(105,65) -> T(100,72) -> identity correctly.
- The general disposable wrapper is not executed: the probe invokes the retained TrapSave callback directly from the returned scope object. Normal successful save/restore is closed; exceptional unwinding and nonordinary opacity/group side effects are not.

## Source method identifiers

| Role | IDs |
|---|---|
| Selection graphics scope and restore callback | y5p9 100720505; <TrapSave>b__0 100720599 |
| Virtual bindings | Save 100721058 -> dHbV.Save 100723581; h3j1 100721066 -> 100723593; SetOpacity 100721068 -> 100723588; B3Fo 100721057 -> 100723579 |
| Transform / command construction | CHSU.ctor 100723776; yHSe.ctor 100723753; KHbO 100723583; CHJ7.ctor 100723628; gHJi.ctor 100723625 |
| Graphics state | bHJZ.Copy 100723638; bHJZ.ctor 100723641; B3Fo 100723579; JHbU 100723589; B3FT 100723590; b3Fw 100723591 |
| Command fold | pHbZ 100723595; Wbi3 100689072; OfType.MoveNext 100689490; Vb2m 100689169; lambda 100723618 |
| Restore list helpers | obiD/NotIn 100689076; NotIn.MoveNext 100689457; Sb73/ToList 100689134; Sbhg/Contains 100689190 |
| Matrix arithmetic | identity dbez 100688888; translation Ubem 100688895; multiply 100688897 -> abe0 100688896; scalar getters/setters 100688876–100688887 |
| Origin wrapper | aHb9 100723479; qHbu 100723482; OHbT 100723480; eHbt 100723481; CHb2 100723538 |

New retained instruction files are selection-svg-body-matrix-command-cil.json, dependencies-cil.json, arithmetic-cil.json, restore-cil.json, restore-iterator-cil.json and reference-contains-cil.json. Existing line-style-svg-writer-cil.json and selection-layout-border-asset-cil.json supply the writer/scope methods. Token extraction uses a new PEReader-only script, selection-svg-body-matrix-extract-tokens.ps1; it resolves MethodSpecification targets and records the generic signatures. The original extraction script and vendor assembly remain unchanged.

## Explicit facades and limitations

- dHbV object initialization is supplied as the retained constructor's scoped field shape: empty XHJn, AHJC=true, identity CHJR and zero BHJg. The full XML/XDocument constructor is not run.
- Module bootstrap DkYN is omitted; frozen module constant field values are loaded from gradient-angle-flow-init-cil.json. This is not execution of the original module initializer.
- CLR object creation, list add/copy, array enumerators, delegate invocation, fixed current managed thread ID and primitive point reads are explicit JavaScript facades. Generic OfType and NotIn state machines, aggregate control flow and native matrix arithmetic are retained-CIL execution in the interpreter.
- Sbhg/Contains is a reference-membership facade for the opaque command objects in these cases. Its retained method 100689190 is included: it delegates to collection Contains when available. No general user-defined equality behavior is claimed. In the no-opacity restore branch any such selection is subsequently filtered to nHJa, of which the controlled state contains none.
- CLR exception/finally unwinding is not generically emulated. Successful normal branches are followed; the saved callback is explicitly invoked. Nonidentity upstream graphics, rotation, nonordinary opacity, gradient/clip groups and reset paths that perform XML group synchronization are outside the scope.
- The 12 size/stroke/side cases do not execute XNUc or UJ0a again. The marker padding values are derived from the earlier frozen bounds evidence and never alter command construction. This is deliberate separation of asset crop from body transform.
- No full SVG path, XML serialization, browser layout or screenshot is produced by this matrix probe. Native body painted extents and default viewport clipping require the independent writer/CSS evidence; original GUI comparison remains false.

## Reusable interface and reproduction

selection-svg-body-matrix-api.mjs imports the inert setup of the exact hash-pinned probe and writes nothing. It exports run, graphics, point, matrix, components, multiply, identity, callback, resetTrace and getTrace. Native matrix objects retain their original field names; components converts them to SVG [a,b,c,d,e,f]. Example:

\`\`\`js
const g = graphics(), origin = point(ix, iy);
const scope = run(100720505, [g, origin, 1, NaN]);
const inner = run(100723595, [g]);
run(100723479, [g, origin]);
const outer = run(100723482, [g]);
components(multiply(outer, inner)); // [1, 0, 0, 1, 0, 0]
callback(scope);                   // retained successful restore callback
\`\`\`

The original probe has been run once and its result is frozen with exclusive creation. To replay without overwriting old output, run:

\`\`\`powershell
node research/selection-svg-body-matrix-replay.mjs unique-run-suffix
\`\`\`

The wrapper limits output to a new selection-svg-body-matrix-*.json path and refuses an existing file. The already executed reproduction suffix produced identical result/trace records to the original. A separate API smoke check confirmed positive [1,0,0,1,100,72], negative [1,0,0,1,-100,-72], identity net matrix and restored identity state. No failed probe or extraction attempts occurred in this stage.

Parent baseline selection-adaptive-verification.json remains SHA-256 ff2b41d7ff4eef54e8acf46126ebb2347a84392082915d3d9e5c321d8e863a68. The new manifest freezes this report, probe/reproduction/API and every source used by the matrix claim.
`;
const reportPath='research/selection-svg-body-matrix-evidence.md';fs.writeFileSync(reportPath,report,{flag:'wx'});
const extra=['research/selection-svg-bounds-evidence.md','research/selection-svg-bounds-probes.json','research/selection-layout-render-writer-cil.json','research/selection-layout-border-render-entry-cil.json','research/scripts/inspect-rp-serialization.ps1',baseline];
const owned=fs.readdirSync('research').filter(n=>n.startsWith('selection-svg-body-matrix-')).map(n=>'research/'+n);
const all=[...probe.sources.map(s=>s.path),...extra,...owned];const paths=[...new Map(all.map(p=>[fs.realpathSync(p).toLowerCase(),p.replaceAll('\\','/')])).values()].sort();
const manifest={date:'2026-10-21',target:{path:target,sha256:targetHash},scope:'Ordinary retained-CIL matrix/state closure; no vendor execution or final pixel claim',passed:18,failed:0,reproductionIdentical:true,files:paths.map(path=>({path,sha256:sha(path)}))};
const manifestPath='research/selection-svg-body-matrix-manifest.json';fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
for(const record of manifest.files)assert.equal(sha(record.path),record.sha256);
console.log(JSON.stringify({files:manifest.files.length,verified:manifest.files.length,reportSha256:sha(reportPath),probeSha256:sha(probePath),manifestSha256:sha(manifestPath)},null,2));