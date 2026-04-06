#!/usr/bin/env npx tsx
/**
 * Doc frontmatter linter.
 *
 * Checks all .md files in docs/ for valid YAML frontmatter with required fields.
 * Run: npx tsx scripts/lint-docs.ts
 *
 * Required fields: title, status
 * Optional fields: description, created, last-verified, anchored-to, verified-by
 *
 * Exit codes:
 *   0 — all docs pass
 *   1 — errors found (missing frontmatter or required fields)
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const DOCS_DIR = join(import.meta.dirname || __dirname, '..', 'docs')
const VALID_STATUSES = ['current', 'stale', 'draft', 'archived']

interface LintResult {
  file: string
  errors: string[]
  warnings: string[]
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.vitepress') {
      files.push(...findMarkdownFiles(fullPath))
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null

  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      fields[key] = value
    }
  }
  return fields
}

function lintFile(filePath: string): LintResult {
  const rel = relative(DOCS_DIR, filePath)
  const content = readFileSync(filePath, 'utf-8')
  const errors: string[] = []
  const warnings: string[] = []

  // Skip index.md files (VitePress config pages)
  if (rel.endsWith('index.md')) {
    return { file: rel, errors, warnings }
  }

  const fm = parseFrontmatter(content)
  if (!fm) {
    errors.push('Missing frontmatter (---)')
    return { file: rel, errors, warnings }
  }

  if (!fm.title) errors.push('Missing required field: title')
  if (!fm.status) {
    errors.push('Missing required field: status')
  } else if (!VALID_STATUSES.includes(fm.status)) {
    errors.push(`Invalid status "${fm.status}" — must be one of: ${VALID_STATUSES.join(', ')}`)
  }

  if (!fm['last-verified']) {
    warnings.push('Missing optional field: last-verified')
  } else {
    const verifiedDate = new Date(fm['last-verified'])
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    if (verifiedDate < thirtyDaysAgo) {
      warnings.push(`last-verified is older than 30 days (${fm['last-verified']})`)
    }
  }

  return { file: rel, errors, warnings }
}

// Run
const files = findMarkdownFiles(DOCS_DIR)
const results = files.map(lintFile)

let errorCount = 0
let warnCount = 0

for (const r of results) {
  if (r.errors.length === 0 && r.warnings.length === 0) continue

  console.log(`\n${r.file}`)
  for (const e of r.errors) {
    console.log(`  ❌ ${e}`)
    errorCount++
  }
  for (const w of r.warnings) {
    console.log(`  ⚠️  ${w}`)
    warnCount++
  }
}

console.log(`\n${files.length} docs checked: ${errorCount} errors, ${warnCount} warnings`)

if (errorCount > 0) {
  console.log('\nFix errors before committing. Add frontmatter with at least title and status fields.')
  process.exit(1)
}
