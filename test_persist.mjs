import { showMachine, createInitialContext } from './src/renderer/machines/showMachine.ts'

const ctx = createInitialContext()
ctx.showDate = new Date().toISOString().slice(0, 10)

// Test 1: What does a saved state value look like for writers_room?
const testState1 = {
  phase: { writers_room: 'energy' },
  animation: 'idle'
}
console.log('Input state for writers_room:', JSON.stringify(testState1))

try {
  const resolved1 = showMachine.resolveState({
    value: testState1,
    context: { ...createInitialContext(), ...ctx }
  })
  console.log('Resolved value:', JSON.stringify(resolved1.value))
  console.log('Resolved context keys:', Object.keys(resolved1.context))
} catch (e) {
  console.error('Error resolving writers_room:', e.message)
}

// Test 2: What about live phase?
const testState2 = {
  phase: { live: { act_active: 'beat_check' } },
  animation: 'idle'
}
console.log('\nInput state for live:', JSON.stringify(testState2))

try {
  const resolved2 = showMachine.resolveState({
    value: testState2,
    context: { ...createInitialContext(), ...ctx }
  })
  console.log('Resolved value:', JSON.stringify(resolved2.value))
} catch (e) {
  console.error('Error resolving live:', e.message)
}

// Test 3: What if we save/restore with the actual snapshot?
const { createActor } = await import('xstate')
const actor = createActor(showMachine)
actor.start()
actor.send({ type: 'ENTER_WRITERS_ROOM' })
const snap = actor.getSnapshot()
console.log('\n\nActual snapshot value from actor:', JSON.stringify(snap.value))
console.log('Actual snapshot context showDate:', snap.context.showDate)

// Try to restore
try {
  const resolved3 = showMachine.resolveState({
    value: snap.value,
    context: { ...createInitialContext(), ...snap.context }
  })
  console.log('Re-resolved value:', JSON.stringify(resolved3.value))
} catch (e) {
  console.error('Error re-resolving:', e.message)
}

actor.stop()
