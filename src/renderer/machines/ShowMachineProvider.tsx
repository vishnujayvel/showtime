/**
 * React integration layer for the XState show machine.
 *
 * Provides:
 * - ShowMachineProvider — wraps app with machine actor context
 * - useShowActor — access the raw actor ref for sending events
 * - useShowSelector — select derived state from the machine
 * - useShowPhase — shortcut for current ShowPhase
 * - useShowSend — shortcut for the send function
 *
 * This is the primary API for reading show state in React components.
 */
import React, { createContext, useContext, useCallback } from 'react'
import { useSelector } from '@xstate/react'
import { showActor } from './showActor'
import {
  getPhaseFromState,
  getWritersRoomStep,
  isAnimationActive,
  getOverlayFromState,
  type OverlayState,
  type ShowMachineContext,
  type ShowMachineEvent,
  type ShowMachineActor,
} from './showMachine'
import type {
  ShowPhase,
  EnergyLevel,
  Act,
  ShowVerdict,
  ViewTier,
  WritersRoomStep,
} from '../../shared/types'

// ─── Context ───

const ShowActorContext = createContext<ShowMachineActor>(showActor as unknown as ShowMachineActor)

// ─── Provider ───

interface ShowMachineProviderProps {
  children: React.ReactNode
}

export function ShowMachineProvider({ children }: ShowMachineProviderProps) {
  return (
    <ShowActorContext.Provider value={showActor as unknown as ShowMachineActor}>
      {children}
    </ShowActorContext.Provider>
  )
}

// ─── Hooks ───

/** Access the raw show machine actor ref */
export function useShowActor(): ShowMachineActor {
  return useContext(ShowActorContext)
}

/** Select derived state from the show machine with automatic re-rendering */
export function useShowSelector<T>(selector: (state: ReturnType<ShowMachineActor['getSnapshot']>) => T): T {
  const actor = useShowActor()
  return useSelector(actor as any, selector as any) as T
}

/** Get the current send function (stable reference) */
export function useShowSend() {
  const actor = useShowActor()
  return useCallback((event: ShowMachineEvent) => actor.send(event), [actor])
}

// ─── Convenience Selectors ───

/** Current top-level ShowPhase */
export function useShowPhase(): ShowPhase {
  return useShowSelector((state) => getPhaseFromState(state.value as Record<string, unknown>))
}

/** Current Writer's Room substep (null if not in writer's room) */
export function useWritersRoomStep(): WritersRoomStep | null {
  return useShowSelector((state) => getWritersRoomStep(state.value as Record<string, unknown>))
}

/** Whether cold open animation is active */
export function useColdOpenActive(): boolean {
  return useShowSelector((state) => isAnimationActive(state.value as Record<string, unknown>, 'cold_open'))
}

/** Whether going live animation is active */
export function useGoingLiveActive(): boolean {
  return useShowSelector((state) => isAnimationActive(state.value as Record<string, unknown>, 'going_live'))
}

/** Current overlay state (none, history, settings, onboarding) */
export function useOverlay(): OverlayState {
  return useShowSelector((state) => getOverlayFromState(state.value as Record<string, unknown>))
}

// ─── Context Value Selectors (read from machine context) ───

export function useShowContext<T>(selector: (ctx: ShowMachineContext) => T): T {
  return useShowSelector((state) => selector(state.context))
}

/** All convenience selectors as a namespace for easy import */
export const showSelectors = {
  phase: (state: ReturnType<ShowMachineActor['getSnapshot']>): ShowPhase =>
    getPhaseFromState(state.value as Record<string, unknown>),

  energy: (state: ReturnType<ShowMachineActor['getSnapshot']>): EnergyLevel | null =>
    state.context.energy,

  acts: (state: ReturnType<ShowMachineActor['getSnapshot']>): Act[] =>
    state.context.acts,

  currentActId: (state: ReturnType<ShowMachineActor['getSnapshot']>): string | null =>
    state.context.currentActId,

  currentAct: (state: ReturnType<ShowMachineActor['getSnapshot']>): Act | undefined =>
    state.context.acts.find((a) => a.id === state.context.currentActId),

  beatsLocked: (state: ReturnType<ShowMachineActor['getSnapshot']>): number =>
    state.context.beatsLocked,

  beatThreshold: (state: ReturnType<ShowMachineActor['getSnapshot']>): number =>
    state.context.beatThreshold,

  timerEndAt: (state: ReturnType<ShowMachineActor['getSnapshot']>): number | null =>
    state.context.timerEndAt,

  timerPausedRemaining: (state: ReturnType<ShowMachineActor['getSnapshot']>): number | null =>
    state.context.timerPausedRemaining,

  verdict: (state: ReturnType<ShowMachineActor['getSnapshot']>): ShowVerdict | null =>
    state.context.verdict,

  viewTier: (state: ReturnType<ShowMachineActor['getSnapshot']>): ViewTier =>
    state.context.viewTier,

  beatCheckPending: (state: ReturnType<ShowMachineActor['getSnapshot']>): boolean =>
    state.context.beatCheckPending,

  celebrationActive: (state: ReturnType<ShowMachineActor['getSnapshot']>): boolean =>
    state.context.celebrationActive,

  showDate: (state: ReturnType<ShowMachineActor['getSnapshot']>): string =>
    state.context.showDate,

  showStartedAt: (state: ReturnType<ShowMachineActor['getSnapshot']>): number | null =>
    state.context.showStartedAt,

  writersRoomStep: (state: ReturnType<ShowMachineActor['getSnapshot']>): WritersRoomStep =>
    state.context.writersRoomStep,

  writersRoomEnteredAt: (state: ReturnType<ShowMachineActor['getSnapshot']>): number | null =>
    state.context.writersRoomEnteredAt,

  breathingPauseEndAt: (state: ReturnType<ShowMachineActor['getSnapshot']>): number | null =>
    state.context.breathingPauseEndAt,

  coldOpenActive: (state: ReturnType<ShowMachineActor['getSnapshot']>): boolean =>
    isAnimationActive(state.value as Record<string, unknown>, 'cold_open'),

  goingLiveActive: (state: ReturnType<ShowMachineActor['getSnapshot']>): boolean =>
    isAnimationActive(state.value as Record<string, unknown>, 'going_live'),

  isExpanded: (state: ReturnType<ShowMachineActor['getSnapshot']>): boolean =>
    state.context.viewTier !== 'micro',

  overlay: (state: ReturnType<ShowMachineActor['getSnapshot']>): OverlayState =>
    getOverlayFromState(state.value as Record<string, unknown>),
}
