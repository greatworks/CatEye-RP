import { describe, expect, it, vi } from 'vitest';
import { createSelectionPointerSession, type SelectionPointerRequest } from '../src/runtime/selection-pointer-session';

const request=(x:number):SelectionPointerRequest=>({point:{x,y:0},modifiers:{control:false,alt:false,shift:false}});
function fixture(){
  type State={width:number;fit:boolean;frames:number[]};
  const baseline:State={width:100,fit:true,frames:[]};
  let visible=baseline,owned=baseline,current=true;
  let resolve!:(value:{prepared:{originalWidth:number};state:State})=>void,reject!:(error:unknown)=>void;
  const preparation=new Promise<{prepared:{originalWidth:number};state:State}>((yes,no)=>{resolve=yes;reject=no});
  const history:State[]=[],planned:number[]=[];
  const plan=vi.fn((_prepared:{originalWidth:number},state:State,input:SelectionPointerRequest)=>{
    planned.push(input.point.x);
    return {width:_prepared.originalWidth+input.point.x,fit:state.fit&&input.point.x===0,frames:[...state.frames,input.point.x]};
  });
  const failed=vi.fn(),publish=vi.fn((state:State)=>{visible=owned=state});
  const session=createSelectionPointerSession({
    prepare:()=>preparation,plan,isCurrent:()=>current&&visible===owned,publish,
    complete:()=>{if(visible!==baseline)history.push(baseline)},
    rollback:()=>{if(visible===owned)visible=owned=baseline},failed,
  });
  return {session,baseline,history,planned,plan,failed,publish,
    get visible(){return visible},invalidate(){current=false},
    replace(){visible={width:999,fit:false,frames:[]}},
    ready(){resolve({prepared:{originalWidth:100},state:baseline})},reject,
  };
}
async function prepared(){const f=fixture();f.ready();await Promise.resolve();await Promise.resolve();await Promise.resolve();return f;}

describe('asynchronous selection pointer gesture coordination',()=>{
  it('replays ordered out-and-back frames after fonts without resetting persistent frame state',async()=>{
    const f=fixture();f.session.update(request(40));f.session.update(request(0));f.session.finish();
    expect(f.session.phase).toBe('finishing');expect(f.visible).toBe(f.baseline);expect(f.history).toEqual([]);
    f.ready();const result=await f.session.done;
    expect(result.status).toBe('completed');expect(f.planned).toEqual([40,0]);
    // This service deliberately models a persistent fit transition: the
    // coordinator must not reset it just because geometry returns to its start.
    expect(f.visible).toEqual({width:100,fit:false,frames:[40,0]});
    expect(f.history).toEqual([f.baseline]);expect(f.publish).toHaveBeenCalledTimes(1);
  });
  it('uses the immutable original for every ready frame and creates history only on release',async()=>{
    const f=await prepared();f.session.update(request(20));f.session.update(request(35));
    expect(f.visible.width).toBe(135);expect(f.visible.frames).toEqual([20,35]);expect(f.history).toEqual([]);
    f.session.update(request(42));f.session.finish();await f.session.done;
    expect(f.visible.width).toBe(142);expect(f.history).toEqual([f.baseline]);
    f.session.finish();f.session.update(request(80));f.session.cancel();expect(f.history).toHaveLength(1);expect(f.visible.width).toBe(142);
  });
  it('does not retain mutable pointer event payloads while preparation is pending',async()=>{
    const f=fixture(),input=request(17);f.session.update(input);input.point.x=600;input.modifiers.alt=true;f.session.finish();f.ready();await f.session.done;
    expect(f.visible.width).toBe(117);expect(f.plan.mock.calls[0][2].modifiers.alt).toBe(false);
  });
  it('cancel before preparation rejects late results without publication or undo',async()=>{
    const f=fixture();f.session.update(request(80));f.session.finish();f.session.cancel();f.ready();
    expect((await f.session.done).status).toBe('cancelled');await Promise.resolve();await Promise.resolve();
    expect(f.visible).toBe(f.baseline);expect(f.plan).not.toHaveBeenCalled();expect(f.history).toEqual([]);
  });
  it('cancel restores its own preview but never replaces a foreign document',async()=>{
    const owned=await prepared();owned.session.update(request(25));owned.session.cancel();
    expect(owned.visible).toBe(owned.baseline);expect(owned.history).toEqual([]);
    const foreign=await prepared();foreign.session.update(request(25));foreign.replace();foreign.session.cancel();
    expect(foreign.visible.width).toBe(999);expect(foreign.history).toEqual([]);
  });
  it('context invalidation during a preparation wait cancels the finishing gesture',async()=>{
    const f=fixture();f.session.update(request(20));f.session.finish();f.invalidate();f.ready();
    expect((await f.session.done).status).toBe('cancelled');expect(f.publish).not.toHaveBeenCalled();expect(f.history).toEqual([]);
  });
  it('a later planning failure rolls back all previews and does not leave an undo entry',async()=>{
    const f=await prepared();f.session.update(request(10));f.plan.mockImplementationOnce(()=>{throw Error('Unavailable metrics')});
    f.session.update(request(20));expect((await f.session.done).status).toBe('failed');
    expect(f.visible).toBe(f.baseline);expect(f.failed).toHaveBeenCalledTimes(1);expect(f.history).toEqual([]);
  });
  it('font errors fail once, while an error after explicit cancel does not resurrect the gesture',async()=>{
    const f=fixture();f.session.finish();f.reject(Error('Font unavailable'));expect((await f.session.done).status).toBe('failed');expect(f.failed).toHaveBeenCalledTimes(1);
    const cancelled=fixture();cancelled.session.cancel();cancelled.reject(Error('Late font rejection'));
    await cancelled.session.done;await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(cancelled.session.phase).toBe('cancelled');expect(cancelled.failed).not.toHaveBeenCalled();
  });
  it('a press and release with no frames remains a no-op',async()=>{
    const f=fixture();f.session.finish();f.ready();await f.session.done;
    expect(f.plan).not.toHaveBeenCalled();expect(f.publish).not.toHaveBeenCalled();expect(f.history).toEqual([]);
  });
});
