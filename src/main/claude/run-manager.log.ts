/**
 * Run Manager Logger — scoped logging helper for Claude subprocess management.
 *
 * Extracted to allow sharing between run-manager.ts and vcr-cassette.ts.
 */
import { log as _log } from '../logger'

export function log(msg: string): void {
  _log('RunManager', msg)
}
