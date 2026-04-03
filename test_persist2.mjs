import { showMachine, createInitialContext } from './src/renderer/machines/showMachine.ts'
import { createActor } from 'xstate'

const ctx = createInitialContext()
ctx.showDate = new Date().toISOString().slice(0, 10)

// Create actor and reach live phase
const actor = createActor(showMachine)
actor.start()
actor.send({ type: 'ENTER_WRITERS_ROOM' })
actor.send({ type: 'SET_LINEUP', lineup: {
  acts: [
    { name: 'Act 1', sketch: 'S1', durationMinutes: 5 },
    { name: 'Act 2', sketch: 'S2', durationMinutes: 5 },
  ],
  beatThreshold: 1,
  openingNote: 'Test',
}})
actor.send({ type: 'START_SHOW' })

const snapLive = actor.getSnapshot()
console.log('Live snapshot value:', JSON.stringify(snapLive.value))
console.log('Live context: currentActId=', snapLive.context.currentActId, 'acts=', snapLive.context.acts.length)

// Try to resolve it back
try {
  const resolved = showMachine.resolveState({
    value: snapLive.value,
    context: { ...createInitialContext(), ...snapLive.context }
  })
  console.log('Successfully resolved live state')
  console.log('Resolved value:', JSON.stringify(resolved.value))
} catch (e) {
  console.error('Error resolving live state:', e.message)
}

// Now test: what if context.showDate doesn't match?
console.log('\n\nTest: mismatched showDate')
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const mismatchContext = { ...snapLive.context, showDate: tomorrow }
console.log('Current showDate in context:', mismatchContext.showDate)
console.log('Today:', new Date().toISOString().slice(0, 10))

// This simulates what getPersistedSnapshot does
try {
  const resolved2 = showMachine.resolveState({
    value: snapLive.value,
    context: { ...createInitialContext(), ...mismatchContext }
  })
  console.log('Resolved with future date')
} catch (e) {
  console.error('Error:', e.message)
}

actor.stop()
