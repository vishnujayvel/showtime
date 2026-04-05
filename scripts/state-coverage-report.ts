#!/usr/bin/env bun
/**
 * state-coverage-report.ts
 *
 * Imports the showMachine from the codebase and generates a living Markdown report
 * showing which states, transitions, and guards are connected, tested, and working.
 *
 * Usage: bun run scripts/state-coverage-report.ts
 * Output: docs/plans/state-coverage-report.md
 */

import { resolve, join } from 'path'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'

// ─── Root directory ───
const ROOT = resolve(import.meta.dir, '..')

// ─── Mock browser globals needed by showMachine ───
// showMachine.ts uses `window.showtime?.logEvent` in the logDroppedEvent action
// and `import.meta.env.DEV` for dev-mode logging. Neither is needed for static analysis.
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = { showtime: { logEvent: () => {} } }
}

// ─── Import the machine and graph utilities ───
import { showMachine } from '../src/renderer/machines/showMachine'
import { toDirectedGraph } from '@xstate/graph'
import type { DirectedGraphNode, DirectedGraphEdge } from '@xstate/graph'

// ─── Types ───

interface StateInfo {
  /** Full dotted path, e.g. "phase.writers_room.energy" */
  path: string
  /** Number of outgoing transitions (edges from this node) */
  transitionCount: number
  /** Events that can be sent from this state */
  events: string[]
  /** Whether tests reference this state */
  testedTransitions: number
  /** Is this a leaf (atomic) state? */
  isLeaf: boolean
}

interface TransitionInfo {
  source: string
  target: string
  event: string
  guard: string | null
}

// ─── Helpers: Recursively collect all states ───

function collectStates(node: DirectedGraphNode, parentPath: string = ''): StateInfo[] {
  const results: StateInfo[] = []
  const myPath = parentPath ? `${parentPath}.${node.stateNode.key}` : node.stateNode.key

  // Collect events from direct edges
  const events = node.edges.map((e) => e.label.text)
  const isLeaf = node.children.length === 0

  results.push({
    path: myPath,
    transitionCount: node.edges.length,
    events: [...new Set(events)],
    testedTransitions: 0, // filled in later
    isLeaf,
  })

  for (const child of node.children) {
    results.push(...collectStates(child, myPath))
  }
  return results
}

// ─── Helpers: Recursively collect all transitions (edges) ───

function collectTransitions(node: DirectedGraphNode, parentPath: string = ''): TransitionInfo[] {
  const results: TransitionInfo[] = []
  const myPath = parentPath ? `${parentPath}.${node.stateNode.key}` : node.stateNode.key

  for (const edge of node.edges) {
    const g = edge.transition.guard
    let guardName: string | null = null
    if (g) {
      if (typeof g === 'string') {
        guardName = g
      } else if (typeof g === 'function') {
        guardName = 'inline'
      } else if (typeof g === 'object' && g !== null) {
        guardName = (g as any).type ?? (g as any).name ?? 'inline'
      }
    }
    results.push({
      source: myPath,
      target: resolveTargetPath(edge),
      event: edge.label.text,
      guard: guardName,
    })
  }

  for (const child of node.children) {
    results.push(...collectTransitions(child, myPath))
  }
  return results
}

function resolveTargetPath(edge: DirectedGraphEdge): string {
  try {
    const targetNode = edge.target
    // The target stateNode has a full `id` like "show.phase.live.act_active"
    return targetNode.id || '(unknown)'
  } catch {
    return '(unknown)'
  }
}

// ─── Load and scan all test files for event/state coverage ───

function loadTestFiles(): { filename: string; content: string }[] {
  const testDir = join(ROOT, 'src', '__tests__')
  const files: { filename: string; content: string }[] = []

  if (existsSync(testDir)) {
    for (const f of readdirSync(testDir)) {
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) {
        files.push({
          filename: f,
          content: readFileSync(join(testDir, f), 'utf-8'),
        })
      }
    }
  }

  // Also check e2e tests
  const e2eDir = join(ROOT, 'e2e')
  if (existsSync(e2eDir)) {
    for (const f of readdirSync(e2eDir)) {
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) {
        files.push({
          filename: `e2e/${f}`,
          content: readFileSync(join(e2eDir, f), 'utf-8'),
        })
      }
    }
  }

  return files
}

function isEventTestedInFiles(
  event: string,
  statePath: string,
  testFiles: { filename: string; content: string }[]
): { tested: boolean; files: string[] } {
  const matchingFiles: string[] = []

  // Simplify state path for matching: "show.phase.live.act_active" -> check for "act_active", "live"
  const stateSegments = statePath.split('.').filter(s => s !== 'show')

  for (const tf of testFiles) {
    // Check if event type string is mentioned
    const hasEvent = tf.content.includes(`'${event}'`) || tf.content.includes(`"${event}"`)
    if (!hasEvent) continue

    // Check if any part of the state path is mentioned (flexible match)
    const hasState = stateSegments.some(seg =>
      tf.content.includes(`'${seg}'`) || tf.content.includes(`"${seg}"`) || tf.content.includes(seg)
    )

    if (hasEvent && hasState) {
      matchingFiles.push(tf.filename)
    }
  }

  return { tested: matchingFiles.length > 0, files: matchingFiles }
}

function isEventTestedAnywhere(
  event: string,
  testFiles: { filename: string; content: string }[]
): { tested: boolean; files: string[] } {
  const matchingFiles: string[] = []
  for (const tf of testFiles) {
    if (tf.content.includes(`'${event}'`) || tf.content.includes(`"${event}"`)) {
      matchingFiles.push(tf.filename)
    }
  }
  return { tested: matchingFiles.length > 0, files: [...new Set(matchingFiles)] }
}

function isGuardTestedInFiles(
  guardName: string,
  testFiles: { filename: string; content: string }[]
): { tested: boolean; files: string[] } {
  const matchingFiles: string[] = []
  for (const tf of testFiles) {
    // Guard testing is indirect — look for the guard name or related behavior
    if (tf.content.includes(guardName)) {
      matchingFiles.push(tf.filename)
    }
  }
  return { tested: matchingFiles.length > 0, files: [...new Set(matchingFiles)] }
}

// ─── Build the report ───

function buildReport(): string {
  const graph = toDirectedGraph(showMachine)
  const allStates = collectStates(graph)
  const allTransitions = collectTransitions(graph)
  const testFiles = loadTestFiles()

  // Named guards from machine setup
  const KNOWN_GUARDS = [
    'hasActs',
    'hasCurrentAct',
    'hasNextAct',
    'noNextAct',
    'hasConfirmedLineup',
    'hasTimerRunning',
    'hasPausedTimer',
  ]

  // Also count inline guards from transitions
  const inlineGuardCount = allTransitions.filter(
    (t) => t.guard === 'inline'
  ).length

  // ─── Compute test coverage per state ───
  for (const state of allStates) {
    let tested = 0
    for (const event of state.events) {
      // Skip wildcard and xstate internals — they're catch-all handlers, not testable transitions
      if (event === '*' || event.startsWith('xstate.')) continue
      const result = isEventTestedInFiles(event, state.path, testFiles)
      if (result.tested) tested++
    }
    // Adjust event count to exclude wildcards for fair coverage reporting
    state.events = state.events.filter((e) => e !== '*' && !e.startsWith('xstate.'))
    state.testedTransitions = tested
  }

  // ─── Compute unique events ───
  const allEvents = [...new Set(allTransitions.map((t) => t.event))].sort()

  // ─── Leaf states only for the matrix ───
  const leafStates = allStates.filter((s) => s.isLeaf)

  // ─── State-to-events map for transition matrix ───
  // Build: for each leaf state, which events have actual transitions?
  const stateEventMap = new Map<string, Set<string>>()
  for (const t of allTransitions) {
    if (!stateEventMap.has(t.source)) stateEventMap.set(t.source, new Set())
    stateEventMap.get(t.source)!.add(t.event)
  }

  // Also check parent states — events on parents are available to children
  // Build a parent-child map
  const parentEventsForState = (statePath: string): Set<string> => {
    const events = new Set<string>()
    const parts = statePath.split('.')
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('.')
      const parentEvents = stateEventMap.get(prefix)
      if (parentEvents) {
        for (const e of parentEvents) events.add(e)
      }
    }
    return events
  }

  // ─── Wildcard detection ───
  // The root machine has `on: { '*': { actions: 'logDroppedEvent' } }`
  const hasWildcard = allTransitions.some((t) => t.event === '*')

  // ─── Build sections ───

  const lines: string[] = []
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  lines.push('# State Machine Coverage Report')
  lines.push('')
  lines.push(`> Generated: ${now}`)
  lines.push('> Source: `src/renderer/machines/showMachine.ts`')
  lines.push('> Run: `bun run scripts/state-coverage-report.ts`')
  lines.push('')

  // ─── Section 1: State Tree ���──
  lines.push('## 1. State Tree')
  lines.push('')
  lines.push('Every state and substate in the machine, with transition and test counts.')
  lines.push('')
  lines.push('```')
  for (const state of allStates) {
    const depth = state.path.split('.').length - 1
    const indent = '  '.repeat(depth)
    const uniqueEvents = state.events.length
    const icon = state.testedTransitions >= uniqueEvents && uniqueEvents > 0
      ? '\u2705'
      : state.testedTransitions > 0
        ? '\u26a0\ufe0f'
        : uniqueEvents === 0
          ? '\u2796'
          : '\u274c'
    const suffix = state.isLeaf ? '' : ' (compound)'
    lines.push(
      `${indent}${icon} ${state.path}${suffix} \u2014 ${uniqueEvents} events, ${state.testedTransitions} tested`
    )
  }
  lines.push('```')
  lines.push('')

  // ─── Section 2: Transition Matrix ───
  lines.push('## 2. Transition Matrix')
  lines.push('')
  lines.push('Event x Leaf-State. Each cell shows whether a transition exists and whether it has test coverage.')
  lines.push('')
  lines.push('Legend:')
  lines.push('- `Y` = transition exists and has test coverage')
  lines.push('- `!` = transition exists but no test coverage found')
  lines.push('- `.` = no transition (event not handled in this state)')
  lines.push('- `W` = caught by wildcard handler only')
  lines.push('')

  // Abbreviate state names for the matrix header
  const abbreviate = (path: string): string => {
    const parts = path.split('.')
    // Take last 2 segments for readability
    return parts.slice(-2).join('.')
  }

  // Build the matrix — events are rows, states are columns
  // But we need to keep it readable, so let's do a grouped format instead

  // Group leaf states by top-level phase
  const phaseGroups = new Map<string, typeof leafStates>()
  for (const state of leafStates) {
    const parts = state.path.split('.')
    // Skip the root "show" node if present
    const phasePart = parts.find((p) =>
      ['no_show', 'cold_open', 'writers_room', 'going_live', 'live', 'intermission', 'director', 'strike', 'animation'].includes(p)
    ) ?? parts[1] ?? parts[0]
    if (!phaseGroups.has(phasePart)) phaseGroups.set(phasePart, [])
    phaseGroups.get(phasePart)!.push(state)
  }

  // Filter out machine-internal events and sort meaningfully
  const meaningfulEvents = allEvents.filter((e) => e !== '*' && e !== 'xstate.init')

  for (const [phase, states] of phaseGroups) {
    lines.push(`### ${phase}`)
    lines.push('')

    // Column headers
    const stateHeaders = states.map((s) => abbreviate(s.path))
    const headerRow = `| Event | ${stateHeaders.join(' | ')} |`
    const separatorRow = `| --- | ${stateHeaders.map(() => '---').join(' | ')} |`
    lines.push(headerRow)
    lines.push(separatorRow)

    for (const event of meaningfulEvents) {
      const cells: string[] = []
      let anyHit = false

      for (const state of states) {
        const availableEvents = parentEventsForState(state.path)
        const directEvents = stateEventMap.get(state.path) ?? new Set()
        const hasDirectTransition = directEvents.has(event)
        const hasParentTransition = availableEvents.has(event)

        if (hasDirectTransition || hasParentTransition) {
          anyHit = true
          const coverage = isEventTestedInFiles(event, state.path, testFiles)
          cells.push(coverage.tested ? '`Y`' : '`!`')
        } else if (hasWildcard) {
          cells.push('`W`')
        } else {
          cells.push('`.`')
        }
      }

      // Only include rows where at least one state handles the event
      if (anyHit) {
        lines.push(`| ${event} | ${cells.join(' | ')} |`)
      }
    }
    lines.push('')
  }

  // ─── Section 3: Guard Coverage ───
  lines.push('## 3. Guard Coverage')
  lines.push('')
  lines.push('Named guards defined in the machine and their test coverage.')
  lines.push('')

  // Determine which named guards are actually used in transitions
  const usedNamedGuards = new Set(
    allTransitions.filter((t) => t.guard && t.guard !== 'inline').map((t) => t.guard!)
  )

  for (const guardName of KNOWN_GUARDS) {
    const isUsed = usedNamedGuards.has(guardName)
    const result = isGuardTestedInFiles(guardName, testFiles)
    const usedTag = isUsed ? '' : ' (defined but unused in transitions)'
    const icon = !isUsed
      ? '\u2796'
      : result.tested
        ? '\u2705'
        : '\u26a0\ufe0f'
    const where = !isUsed
      ? usedTag
      : result.tested
        ? ` \u2014 tested in: ${result.files.join(', ')}`
        : ' \u2014 no test found'
    lines.push(`- ${icon} \`${guardName}\`${where}`)
  }

  lines.push('')
  lines.push(`Additionally, there are **${inlineGuardCount}** inline guards (anonymous arrow functions in transitions).`)
  lines.push('Inline guards are tested indirectly through their transition tests.')
  lines.push('')

  // ─── Section 4: Dead End Analysis ──���
  lines.push('## 4. Dead End Analysis')
  lines.push('')
  lines.push('States with limited or no outgoing transitions (potential UX traps).')
  lines.push('')

  const deadEnds = leafStates.filter((s) => {
    const available = parentEventsForState(s.path)
    // Exclude wildcard-only states
    const meaningful = [...available].filter((e) => e !== '*' && e !== 'xstate.init')
    return meaningful.length <= 1
  })

  if (deadEnds.length === 0) {
    lines.push('No dead-end states found. All leaf states have multiple exit paths.')
  } else {
    for (const state of deadEnds) {
      const available = parentEventsForState(state.path)
      const meaningful = [...available].filter((e) => e !== '*' && e !== 'xstate.init')
      const exitEvents = meaningful.length > 0 ? meaningful.join(', ') : 'none'
      lines.push(`- \u26a0\ufe0f \`${state.path}\` \u2014 exits: ${exitEvents}`)
    }
  }
  lines.push('')

  // ─── Section 5: Connectivity Report ───
  lines.push('## 5. Connectivity Report')
  lines.push('')

  const totalStates = allStates.length
  const totalLeafStates = leafStates.length
  const totalTransitions = allTransitions.filter((t) => t.event !== '*' && t.event !== 'xstate.init').length
  const totalEvents = meaningfulEvents.length

  // Reachability analysis via BFS from initial state
  const reachable = new Set<string>()
  const initialPath = allStates[0]?.path ?? 'show'

  // Find initial leaf states (the machine starts in no_show + idle for animation)
  const initialLeaves = leafStates.filter((s) =>
    s.path.includes('no_show') || s.path.includes('idle')
  )
  const queue = initialLeaves.map((s) => s.path)
  for (const q of queue) reachable.add(q)

  // BFS through transitions
  const visited = new Set<string>(queue)
  while (queue.length > 0) {
    const current = queue.shift()!
    // Find transitions from this state or its ancestors
    for (const t of allTransitions) {
      if (t.event === '*') continue
      // Check if this transition applies to current state
      if (current.startsWith(t.source) || current === t.source) {
        // Find the target leaf state(s)
        const targetLeaves = leafStates.filter((s) =>
          s.path.includes(t.target.replace('show.', '')) || t.target.includes(s.path.replace('show.', ''))
        )
        for (const tl of targetLeaves) {
          if (!visited.has(tl.path)) {
            visited.add(tl.path)
            reachable.add(tl.path)
            queue.push(tl.path)
          }
        }
      }
    }
  }

  const unreachable = leafStates.filter((s) => !reachable.has(s.path))

  // States with only one meaningful exit
  const singleExitStates = leafStates.filter((s) => {
    const available = parentEventsForState(s.path)
    const meaningful = [...available].filter((e) => e !== '*' && e !== 'xstate.init' && e !== 'SET_VIEW_TIER')
    return meaningful.length === 1
  })

  lines.push('| Metric | Count |')
  lines.push('| --- | --- |')
  lines.push(`| Total states (all) | ${totalStates} |`)
  lines.push(`| Leaf (atomic) states | ${totalLeafStates} |`)
  lines.push(`| Total transitions | ${totalTransitions} |`)
  lines.push(`| Unique events | ${totalEvents} |`)
  lines.push(`| Reachable leaf states from initial | ${reachable.size} / ${totalLeafStates} |`)
  lines.push(`| Unreachable leaf states | ${unreachable.length} |`)
  lines.push(`| States with only one exit | ${singleExitStates.length} |`)
  lines.push('')

  if (unreachable.length > 0) {
    lines.push('### Unreachable States')
    lines.push('')
    for (const s of unreachable) {
      lines.push(`- \`${s.path}\``)
    }
    lines.push('')
  }

  if (singleExitStates.length > 0) {
    lines.push('### States With Only One Exit (potential UX traps)')
    lines.push('')
    for (const s of singleExitStates) {
      const available = parentEventsForState(s.path)
      const meaningful = [...available].filter((e) => e !== '*' && e !== 'xstate.init' && e !== 'SET_VIEW_TIER')
      lines.push(`- \`${s.path}\` \u2014 only exit: ${meaningful.join(', ')}`)
    }
    lines.push('')
  }

  // ─── Section 6: Test Coverage Cross-Reference ───
  lines.push('## 6. Test Coverage Cross-Reference')
  lines.push('')
  lines.push('For each event type, which test files reference it.')
  lines.push('')

  let coveredEvents = 0
  let uncoveredEvents = 0

  lines.push('| Event | Covered | Test Files |')
  lines.push('| --- | --- | --- |')

  for (const event of meaningfulEvents) {
    const result = isEventTestedAnywhere(event, testFiles)
    if (result.tested) {
      coveredEvents++
      lines.push(`| \`${event}\` | \u2705 | ${result.files.join(', ')} |`)
    } else {
      uncoveredEvents++
      lines.push(`| \`${event}\` | \u274c | \u2014 |`)
    }
  }
  lines.push('')

  const coveragePct = meaningfulEvents.length > 0
    ? ((coveredEvents / meaningfulEvents.length) * 100).toFixed(1)
    : '0.0'

  lines.push(`**Event coverage: ${coveredEvents}/${meaningfulEvents.length} (${coveragePct}%)**`)
  lines.push('')

  // ─── Summary ───
  lines.push('## Summary')
  lines.push('')

  const totalTestedTransitions = allStates.reduce((sum, s) => sum + s.testedTransitions, 0)
  const totalUniqueEvents = allStates.reduce((sum, s) => sum + s.events.length, 0)
  const stateCoveragePct = totalUniqueEvents > 0
    ? ((totalTestedTransitions / totalUniqueEvents) * 100).toFixed(1)
    : '0.0'

  lines.push(`| Metric | Value |`)
  lines.push(`| --- | --- |`)
  lines.push(`| Machine | \`showMachine\` (XState v5, parallel) |`)
  lines.push(`| Top-level regions | phase, animation |`)
  lines.push(`| Total states | ${totalStates} |`)
  lines.push(`| Leaf states | ${totalLeafStates} |`)
  lines.push(`| Total transitions | ${totalTransitions} |`)
  lines.push(`| Named guards | ${KNOWN_GUARDS.length} |`)
  lines.push(`| Inline guards | ${inlineGuardCount} |`)
  lines.push(`| Event types | ${meaningfulEvents.length} |`)
  lines.push(`| Event test coverage | ${coveragePct}% |`)
  lines.push(`| State-event test coverage | ${stateCoveragePct}% |`)
  lines.push(`| Reachability | ${reachable.size}/${totalLeafStates} leaf states reachable |`)
  lines.push('')

  // ─── Section 7: Shadow State Detection ───
  lines.push('## 7. Shadow State Detection')
  lines.push('')
  lines.push('Scans `App.tsx` for `useState` patterns that control view rendering outside XState.')
  lines.push('These are bugs — every full-screen view must be a machine state. See CLAUDE.md rule.')
  lines.push('')

  const appPath = join(ROOT, 'src', 'renderer', 'App.tsx')
  try {
    const appSrc = readFileSync(appPath, 'utf-8')
    const shadowPattern = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState[<(]/g
    let match: RegExpExecArray | null
    const shadows: string[] = []
    while ((match = shadowPattern.exec(appSrc)) !== null) {
      const varName = match[1]
      // Check if this useState controls view rendering (look for conditional renders)
      if (appSrc.includes(`if (${varName})`) || appSrc.includes(`${varName} &&`) || appSrc.includes(`${varName} ?`)) {
        shadows.push(varName)
      }
    }
    if (shadows.length > 0) {
      lines.push(`**⚠️ ${shadows.length} shadow state(s) found:**`)
      lines.push('')
      for (const s of shadows) {
        lines.push(`- \`${s}\` — controls rendering in App.tsx but is NOT in the XState machine`)
      }
      lines.push('')
      lines.push('**Action:** Move these into the XState machine as proper states or a parallel region.')
    } else {
      lines.push('✅ No shadow states detected. All view routing goes through XState.')
    }
  } catch {
    lines.push('⚠️ Could not read App.tsx for shadow state detection.')
  }
  lines.push('')

  return lines.join('\n')
}

// ─── Main ───

try {
  const report = buildReport()
  const outputPath = join(ROOT, 'docs', 'plans', 'state-coverage-report.md')
  writeFileSync(outputPath, report, 'utf-8')
  console.log(`Report written to ${outputPath}`)
  console.log(`${report.split('\n').length} lines generated.`)
} catch (err) {
  console.error('Failed to generate report:', err)
  process.exit(1)
}
