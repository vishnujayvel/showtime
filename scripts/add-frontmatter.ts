#!/usr/bin/env npx tsx
/**
 * Batch-add frontmatter to all docs that don't have it.
 * Uses the first heading as the title and sets status to 'current'.
 *
 * Run: npx tsx scripts/add-frontmatter.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative } from 'path'

const DOCS_DIR = join(import.meta.dirname || __dirname, '..', 'docs')
const TODAY = new Date().toISOString().slice(0, 10)

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

function hasFrontmatter(content: string): boolean {
  return content.startsWith('---\n')
}

function extractTitle(content: string): string {
  // Try first # heading
  const match = content.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim()

  // Fallback: use first non-empty line
  const lines = content.split('\n').filter(l => l.trim())
  return lines[0]?.replace(/^#+\s*/, '').trim() || 'Untitled'
}

function inferStatus(filePath: string): string {
  const rel = relative(DOCS_DIR, filePath)
  if (rel.includes('plans/backlog')) return 'archived'
  if (rel.includes('adrs/')) return 'current'
  return 'current'
}

const files = findMarkdownFiles(DOCS_DIR)
let added = 0
let skipped = 0

for (const file of files) {
  const rel = relative(DOCS_DIR, file)

  // Skip index.md (VitePress)
  if (rel.endsWith('index.md')) {
    skipped++
    continue
  }

  const content = readFileSync(file, 'utf-8')

  if (hasFrontmatter(content)) {
    skipped++
    continue
  }

  const title = extractTitle(content)
  const status = inferStatus(file)

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `status: ${status}`,
    `last-verified: ${TODAY}`,
    '---',
    '',
  ].join('\n')

  writeFileSync(file, frontmatter + content)
  console.log(`✅ ${rel} — "${title}"`)
  added++
}

console.log(`\nDone: ${added} frontmatter added, ${skipped} skipped (already have or index.md)`)
