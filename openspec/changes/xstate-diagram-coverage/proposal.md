# XState Machine Diagram + Transition Gap Analysis

**Issue:** #133
**Type:** Feature (analysis + code fixes + tests)

## Problem

The XState v5 show machine was ported from imperative Zustand logic — it wasn't designed from scratch with proper state invariants. Three issues need addressing:

1. **No visual diagram** — 800-line machine with 8 phases, 4 substates, parallel animation region, 20+ guarded transitions. No visual reference for contributors.
2. **No coverage matrix** — Unknown which transitions are tested vs untested.
3. **Known transition gaps** identified in CodeRabbit reviews:
   - `LOCK_BEAT`/`SKIP_BEAT` handled at `live` parent level — accepts from `act_active` when should only fire from `beat_check`
   - `SET_ENERGY`/`SET_LINEUP`/`SET_WRITERS_ROOM_STEP` at `writers_room` parent level — bypasses substate guards when child guard fails (XState v5 event bubbling)
   - No `START_ACT` event in the type union (referenced in issue but doesn't exist — confirm and close)

## Goals

1. Generate Mermaid stateDiagram-v2 in `docs/plans/show-machine-diagram.md`
2. Build event × state coverage matrix as markdown in `docs/plans/transition-coverage.md`
3. Fix permissive parent-level handlers:
   - Move `LOCK_BEAT`/`SKIP_BEAT` from `live` parent → only `beat_check` substate
   - Remove parent-level `SET_ENERGY`/`SET_LINEUP`/`SET_WRITERS_ROOM_STEP` from `writers_room` (substates already handle them correctly)
4. Add tests for every previously-untested transition path

## Non-Goals

- Interactive Stately.ai visualizer (Mermaid is sufficient and version-controlled)
- Rewriting the machine from scratch
- Adding new events or phases

## Testing Strategy

- Run existing unit tests to confirm no regressions
- Add new tests for each gap fix
- Update the coverage matrix with test status
