import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { type CommentHit, findComments, type SourceLanguage } from './find-comments.ts'

export type LocatedHit = CommentHit & { readonly path: string }

const SKIP_DIRECTORY_NAMES = new Set(['node_modules', 'dist', '.git', '.cursor'])
const FIXTURE_DIRECTORY = 'scripts/comment-check/fixtures'

export function collectCommentHits(entries: readonly string[]): readonly LocatedHit[] {
  const hits: LocatedHit[] = []
  for (const entry of entries) {
    const info = statSync(entry)
    if (info.isDirectory()) {
      if (isFixtureDirectory(entry)) continue
      for (const file of listSources(entry)) appendHits(hits, entry, file)
      continue
    }
    if (info.isFile()) appendHits(hits, undefined, entry)
  }
  return hits
}

function appendHits(hits: LocatedHit[], root: string | undefined, file: string): void {
  const language = languageFor(file)
  if (!language) return
  const text = readFileSync(file, 'utf8')
  const path = (root === undefined ? file : relative(root, file)).split(sep).join('/')
  for (const hit of findComments(text, language)) hits.push({ ...hit, path })
}

function listSources(root: string): string[] {
  const files: string[] = []
  const directories = [root]
  while (directories.length > 0) {
    const directory = directories.pop()
    if (directory === undefined) continue
    const names = readdirSync(directory)
    names.sort()
    for (const name of names) {
      if (SKIP_DIRECTORY_NAMES.has(name)) continue
      const full = join(directory, name)
      if (isFixtureDirectory(full)) continue
      const info = statSync(full)
      if (info.isDirectory()) {
        directories.push(full)
        continue
      }
      if (info.isFile() && languageFor(full)) files.push(full)
    }
  }
  files.sort()
  return files
}

function languageFor(file: string): SourceLanguage | undefined {
  switch (extname(file)) {
    case '.ts':
    case '.mts':
    case '.cts':
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js'
    case '.tsx':
    case '.jsx':
      return 'jsx'
    default:
      return undefined
  }
}

function isFixtureDirectory(directory: string): boolean {
  const normalized = directory.split(sep).join('/').replace(/\/+$/, '')
  return normalized === FIXTURE_DIRECTORY || normalized.endsWith(`/${FIXTURE_DIRECTORY}`)
}
