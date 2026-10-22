/** Browser coordination for one selection resize gesture. Native geometry and
 * text-cache transitions belong to the injected synchronous planner. In
 * particular, queued frames are replayed in order, not assumed interchangeable.
 */
export interface SelectionPointerRequest {
  /** Absolute diagram coordinates captured at the move event, before snapping. */
  point: { x: number; y: number };
  modifiers: { control: boolean; alt: boolean; shift: boolean };
}
export type SelectionPointerPhase = 'preparing' | 'active' | 'finishing' | 'completed' | 'cancelled' | 'failed';
export type SelectionPointerCompletion<State> =
  | { status: 'completed'; state: State }
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown };
export function createSelectionPointerSession<Prepared, State>(options: {
  prepare(): Promise<{ prepared: Prepared; state: State }>;
  plan(prepared: Prepared, state: State, request: SelectionPointerRequest): State;
  /** Includes gesture identity, context and ownership of the last publication. */
  isCurrent(): boolean;
  publish(state: State): void;
  complete(state: State): void;
  /** The host restores the baseline only if it still owns the visible document. */
  rollback(): void;
  failed(error: unknown): void;
}) {
  let phase: SelectionPointerPhase = 'preparing';
  let ready: { prepared: Prepared; state: State } | undefined;
  const pending: SelectionPointerRequest[] = [];
  let resolveDone!: (result: SelectionPointerCompletion<State>) => void;
  const done = new Promise<SelectionPointerCompletion<State>>(resolve => { resolveDone = resolve; });
  const terminal = () => phase === 'completed' || phase === 'cancelled' || phase === 'failed';
  function cancel() {
    if (terminal()) return;
    phase = 'cancelled'; pending.length = 0;
    try { options.rollback(); } finally { resolveDone({ status: 'cancelled' }); }
  }
  function fail(error: unknown) {
    if (terminal()) return;
    phase = 'failed'; pending.length = 0;
    try { options.rollback(); options.failed(error); }
    finally { resolveDone({ status: 'failed', error }); }
  }
  function current() {
    if (terminal()) return false;
    if (options.isCurrent()) return true;
    cancel(); return false;
  }
  function flush() {
    if (!ready || !current()) return;
    try {
      let changed = false;
      // Each frame consumes the previous accepted layout state, while the
      // prepared original geometry remains immutable in the native adapter.
      while (pending.length) {
        if (!current()) return;
        ready.state = options.plan(ready.prepared, ready.state, pending.shift()!);
        changed = true;
      }
      if (!current()) return;
      if (changed) options.publish(ready.state);
      if (phase === 'finishing' && current()) {
        options.complete(ready.state);
        phase = 'completed'; resolveDone({ status: 'completed', state: ready.state });
      }
    } catch (error) { fail(error); }
  }
  function copy(request: SelectionPointerRequest): SelectionPointerRequest {
    return { point: { ...request.point }, modifiers: { ...request.modifiers } };
  }
  function update(request: SelectionPointerRequest) {
    if (terminal() || phase === 'finishing' || !current()) return;
    pending.push(copy(request)); flush();
  }
  function finish() {
    if (terminal() || phase === 'finishing' || !current()) return;
    phase = 'finishing'; flush();
  }
  void Promise.resolve().then(() => options.prepare()).then(result => {
    if (!current()) return;
    ready = result;
    if (phase === 'preparing') phase = 'active';
    flush();
  }).catch(fail);
  return { update, finish, cancel, done, get phase() { return phase; } };
}
